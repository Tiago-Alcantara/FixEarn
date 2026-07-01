import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { StellarService } from '../stellar/stellar.service';
import { EtherfuseClient } from './etherfuse.client';

@Injectable()
export class RampService {
  private readonly logger = new Logger(RampService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly stellar: StellarService,
    private readonly ef: EtherfuseClient,
  ) {}

  // ── Customer setup ────────────────────────────────────────────────────────

  async listAssets(companyId: string) {
    const stellarAddress = await this.wallet.getAddress(companyId);
    return this.ef.listAssets(stellarAddress);
  }

  async getStatus(companyId: string) {
    const customer = await this.prisma.etherfuseCustomer.findUnique({
      where: { companyId },
    });
    return {
      onboarded: !!customer,
      kycStatus: customer?.kycStatus ?? null,
      ready: customer?.kycStatus === 'approved' && !!customer?.bankAccountId,
      fiatCurrency: this.ef.fiatCurrency,
    };
  }

  /**
   * Prepara a empresa pro ramp no modelo sandbox/org:
   *   1. Registra a wallet Stellar do usuário no org com claimOwnership=true.
   *      Com o KYB do org aprovado, a wallet vira `approved` na hora — sem
   *      KYC/agreements por usuário.
   *   2. Localiza uma conta MXN compliant no org (pra receber/enviar SPEI).
   * Idempotente: pode ser chamado de novo pra ressincronizar.
   */
  async startOnboarding(
    companyId: string,
    email: string,
    displayName: string,
  ): Promise<{ onboardingUrl: string; customerId: string; ready: boolean }> {
    void email;
    void displayName;
    const stellarAddress = await this.wallet.getAddress(companyId);

    const wallet = await this.ef.registerWallet(stellarAddress);
    const bank = await this.ef.findCompliantBank();
    if (!bank && !this.ef.mock) {
      throw new BadRequestException(
        `Nenhuma conta ${this.ef.fiatCurrency} compliant no org Etherfuse. Registre uma conta bancária antes.`,
      );
    }

    const customerId = this.ef.getCustomerId();
    const bankAccountId = bank?.bankAccountId ?? null;

    await this.prisma.etherfuseCustomer.upsert({
      where: { companyId },
      create: {
        companyId,
        customerId,
        bankAccountId,
        walletId: wallet.walletId,
        kycStatus: wallet.kycStatus,
      },
      update: {
        customerId,
        bankAccountId,
        walletId: wallet.walletId,
        kycStatus: wallet.kycStatus,
      },
    });

    return {
      onboardingUrl: '',
      customerId,
      ready: wallet.kycStatus === 'approved' && !!bankAccountId,
    };
  }

  async markKycApproved(companyId: string): Promise<void> {
    // Compat: ressincroniza a partir do estado real da wallet no org.
    await this.startOnboarding(companyId, '', '').catch(() => undefined);
  }

  // ── On-ramp ───────────────────────────────────────────────────────────────

  async startOnramp(
    companyId: string,
    amountFiat: string,
  ): Promise<{
    orderId: string;
    quoteId: string;
    fiatCurrency: string;
    targetAmount: string;
    feeAmount: string;
    depositClabe: string;
    depositBankName: string;
    statusPage: string;
    expiresAt: string;
  }> {
    const customer = await this.requireReadyCustomer(companyId);
    const stellarAddress = await this.wallet.getAddress(companyId);

    const asset = await this.ef.pickAsset(stellarAddress, 'USDC');

    const quote = await this.ef.createQuote({
      customerId: customer.customerId,
      type: 'onramp',
      sourceAsset: this.ef.fiatCurrency,
      targetAsset: asset.identifier,
      sourceAmount: amountFiat,
      walletAddress: stellarAddress,
    });

    const orderId = randomUUID();
    const order = await this.createOnrampOrderWithRetry({
      companyId,
      orderId,
      quoteId: quote.quoteId,
      bankAccountId: customer.bankAccountId!,
      publicKey: stellarAddress,
      amountFiat,
    });

    await this.prisma.rampOrder.create({
      data: {
        companyId,
        orderId,
        type: 'onramp',
        status: order.status,
        amountFiat,
        amountToken: quote.targetAmount,
        depositClabe: order.depositClabe,
      },
    });

    return {
      orderId,
      quoteId: quote.quoteId,
      fiatCurrency: this.ef.fiatCurrency,
      targetAmount: quote.targetAmount,
      feeAmount: quote.feeAmount,
      depositClabe: order.depositClabe ?? '',
      depositBankName: order.depositBankName ?? 'Etherfuse',
      statusPage: order.statusPage ?? '',
      expiresAt: quote.expiresAt,
    };
  }

  async simulateFiatReceived(companyId: string, orderId: string): Promise<void> {
    await this.requireOwnOrder(companyId, orderId);

    // fiat_received só é aceito enquanto a order está em `created`. Se ela já
    // progrediu (funded/completed) — ex.: clique duplo no "Simular Pix" — a
    // Etherfuse responde 404/400. Tratamos como no-op idempotente e apenas
    // ressincronizamos o status local.
    const current = await this.ef.getOrder(orderId);
    let status = current.status;
    if (current.status === 'created') {
      try {
        await this.ef.simulateFiatReceived(orderId);
        status = 'funded';
      } catch (err) {
        // Corrida: outra chamada já avançou a order. Repassa só erros não-4xx.
        if (!(err instanceof HttpException) || err.getStatus() >= 500) throw err;
        status = (await this.ef.getOrder(orderId)).status;
      }
    }

    await this.prisma.rampOrder.update({
      where: { orderId },
      data: { status },
    });
  }

  // ── Claim (entrega do USDC via claimable balance) ─────────────────────────

  /**
   * Retorna a tx de claim (ChangeTrust + ClaimClaimableBalance) pra assinar.
   * `skip: true` quando a order não tem claimable (carteira já com trustline) —
   * o fluxo pula direto pro depósito. O `stellarClaimTransaction` só existe
   * quando a order chega a `completed`.
   */
  async getOrderClaim(
    companyId: string,
    orderId: string,
  ): Promise<{ skip: boolean; xdr?: string; hash?: string }> {
    await this.requireOwnOrder(companyId, orderId);
    const order = await this.ef.getOrder(orderId);
    if (!order.stellarClaimTransaction) return { skip: true };
    const { hash } = this.stellar.hashForSigning(order.stellarClaimTransaction);
    return { skip: false, xdr: order.stellarClaimTransaction, hash };
  }

  /** Anexa a assinatura do usuário na tx de claim e submete (sponsor paga o fee). */
  async submitOrderClaim(
    companyId: string,
    orderId: string,
    dto: { xdr: string; signatureHex: string; stellarAddress: string },
  ): Promise<{ txHash: string }> {
    await this.requireOwnOrder(companyId, orderId);
    const registered = await this.wallet.getAddress(companyId);
    if (dto.stellarAddress !== registered) {
      throw new ForbiddenException(
        'stellar address does not match registered wallet',
      );
    }
    const { txHash } = await this.stellar.attachAndSubmit(
      dto.xdr,
      dto.stellarAddress,
      dto.signatureHex,
    );
    await this.prisma.rampOrder.update({
      where: { orderId },
      data: { status: 'claimed' },
    });
    return { txHash };
  }

  // ── Off-ramp ──────────────────────────────────────────────────────────────

  async startOfframp(
    companyId: string,
    amountToken: string,
  ): Promise<{
    orderId: string;
    quoteId: string;
    fiatCurrency: string;
    targetAmount: string;
    feeAmount: string;
    burnTransaction: string | null;
    statusPage: string;
    expiresAt: string;
  }> {
    const customer = await this.requireReadyCustomer(companyId);
    const stellarAddress = await this.wallet.getAddress(companyId);

    const asset = await this.ef.pickAsset(stellarAddress, 'USDC');

    const quote = await this.ef.createQuote({
      customerId: customer.customerId,
      type: 'offramp',
      sourceAsset: asset.identifier,
      targetAsset: this.ef.fiatCurrency,
      sourceAmount: amountToken,
      walletAddress: stellarAddress,
    });

    const orderId = randomUUID();
    const order = await this.ef.createOrder({
      orderId,
      quoteId: quote.quoteId,
      bankAccountId: customer.bankAccountId!,
      publicKey: stellarAddress,
    });

    await this.prisma.rampOrder.create({
      data: {
        companyId,
        orderId,
        type: 'offramp',
        status: order.status,
        amountToken,
        amountFiat: quote.targetAmount,
        burnTransaction: order.burnTransaction,
      },
    });

    return {
      orderId,
      quoteId: quote.quoteId,
      fiatCurrency: this.ef.fiatCurrency,
      targetAmount: quote.targetAmount,
      feeAmount: quote.feeAmount,
      burnTransaction: order.burnTransaction ?? null,
      statusPage: order.statusPage ?? '',
      expiresAt: quote.expiresAt,
    };
  }

  // ── Burn (off-ramp: queima o USDC pra liberar o Pix) ──────────────────────

  /**
   * Retorna a `burnTransaction` da order de off-ramp pra assinar.
   * `ready: false` enquanto a Etherfuse ainda não montou a tx (carteira precisa
   * ter USDC + trustline + XLM). Pollar até ready.
   */
  async getOrderBurn(
    companyId: string,
    orderId: string,
  ): Promise<{ ready: boolean; xdr?: string; hash?: string }> {
    await this.requireOwnOrder(companyId, orderId);
    const order = await this.ef.getOrder(orderId);
    if (!order.burnTransaction) return { ready: false };
    const { hash } = this.stellar.hashForSigning(order.burnTransaction);
    return { ready: true, xdr: order.burnTransaction, hash };
  }

  /** Anexa a assinatura na burnTransaction e submete (sponsor paga o fee). */
  async submitOrderBurn(
    companyId: string,
    orderId: string,
    dto: { xdr: string; signatureHex: string; stellarAddress: string },
  ): Promise<{ txHash: string }> {
    await this.requireOwnOrder(companyId, orderId);
    const registered = await this.wallet.getAddress(companyId);
    if (dto.stellarAddress !== registered) {
      throw new ForbiddenException(
        'stellar address does not match registered wallet',
      );
    }
    const { txHash } = await this.stellar.attachAndSubmit(
      dto.xdr,
      dto.stellarAddress,
      dto.signatureHex,
    );
    await this.prisma.rampOrder.update({
      where: { orderId },
      data: { status: 'burned' },
    });
    return { txHash };
  }

  // ── Order status ──────────────────────────────────────────────────────────

  async getOrderStatus(companyId: string, orderId: string) {
    const local = await this.requireOwnOrder(companyId, orderId);
    const status = await this.ef.getOrder(orderId);

    if (status.status !== local.status) {
      await this.prisma.rampOrder.update({
        where: { orderId },
        data: { status: status.status },
      });
    }

    return status;
  }

  async listOrders(companyId: string) {
    return this.prisma.rampOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Cria a order de on-ramp. A Etherfuse rejeita com 409 quando já existe uma
   * order de on-ramp *pendente* pro mesmo (bankAccount + amount). Nesse caso,
   * cancela as orders pendentes *da própria empresa* com o mesmo valor e tenta
   * de novo uma vez. Se o conflito for de outra empresa (mesmo bank account do
   * org), não há o que cancelar aqui — repassa uma mensagem limpa.
   */
  private async createOnrampOrderWithRetry(params: {
    companyId: string;
    orderId: string;
    quoteId: string;
    bankAccountId: string;
    publicKey: string;
    amountFiat: string;
  }) {
    try {
      return await this.ef.createOrder({
        orderId: params.orderId,
        quoteId: params.quoteId,
        bankAccountId: params.bankAccountId,
        publicKey: params.publicKey,
      });
    } catch (err) {
      if (!this.isDuplicatePendingOrder(err)) throw err;

      const cancelled = await this.cancelOwnPendingOnramps(
        params.companyId,
        params.amountFiat,
        params.orderId,
      );
      if (cancelled === 0) {
        throw new BadRequestException(
          'Já existe uma ordem de depósito pendente com esse valor. ' +
            'Finalize ou cancele a ordem anterior, ou use um valor diferente.',
        );
      }

      // Uma retentativa após liberar o lock de (bankAccount + amount).
      return this.ef.createOrder({
        orderId: params.orderId,
        quoteId: params.quoteId,
        bankAccountId: params.bankAccountId,
        publicKey: params.publicKey,
      });
    }
  }

  /** 409 da Etherfuse: order de on-ramp pendente duplicada (bankAccount + amount). */
  private isDuplicatePendingOrder(err: unknown): boolean {
    return err instanceof HttpException && err.getStatus() === HttpStatus.CONFLICT;
  }

  /**
   * Cancela as orders de on-ramp da empresa que ainda estão em `created`
   * (canceláveis) com o mesmo valor. Retorna quantas foram efetivamente
   * canceladas. Best-effort: falhas individuais de cancel são logadas e ignoradas.
   */
  private async cancelOwnPendingOnramps(
    companyId: string,
    amountFiat: string,
    excludeOrderId: string,
  ): Promise<number> {
    const pending = await this.prisma.rampOrder.findMany({
      where: {
        companyId,
        type: 'onramp',
        amountFiat,
        status: 'created',
        orderId: { not: excludeOrderId },
      },
    });

    let cancelled = 0;
    for (const o of pending) {
      try {
        await this.ef.cancelOrder(o.orderId);
        await this.prisma.rampOrder.update({
          where: { orderId: o.orderId },
          data: { status: 'cancelled' },
        });
        cancelled++;
      } catch (e) {
        this.logger.warn(
          `Falha ao cancelar order pendente ${o.orderId}: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
    }
    return cancelled;
  }

  private async requireReadyCustomer(companyId: string) {
    const customer = await this.prisma.etherfuseCustomer.findUnique({
      where: { companyId },
    });
    if (!customer) {
      throw new BadRequestException(
        'Etherfuse não configurado. Chame POST /ramp/setup primeiro.',
      );
    }
    if (customer.kycStatus !== 'approved') {
      throw new BadRequestException(
        'Wallet ainda não aprovada no Etherfuse (KYC pendente).',
      );
    }
    if (!customer.bankAccountId) {
      throw new BadRequestException(
        'Nenhuma conta MXN compliant vinculada. Rode POST /ramp/setup novamente.',
      );
    }
    return customer;
  }

  private async requireOwnOrder(companyId: string, orderId: string) {
    const order = await this.prisma.rampOrder.findUnique({ where: { orderId } });
    if (!order || order.companyId !== companyId) {
      throw new NotFoundException('order not found');
    }
    return order;
  }
}
