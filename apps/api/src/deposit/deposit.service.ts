import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { parseBaseUnits } from '../common/parse-money';
import { RESERVE_BUFFER_BASE_UNITS } from '../common/reserve';
import { BuildTxResponse, SubmitTxDto, SubmitTxResponse } from '@yield2pay/shared';

// Safety cap on a single deposit. Bound it well above expected deposits
// (10000 XLM); adjust to the real product limit later.
const MAX_DEPOSIT_BASE_UNITS = 100_000_000_000n; // 10000 XLM (7 decimals)

/**
 * A DeFindex/SAC devolve `...Errors.InsufficientBalance` quando o caller não tem
 * saldo suficiente para o transfer (deixaria a conta abaixo da reserva). O erro
 * chega ora como Error, ora como objeto do SDK — checamos a forma textual.
 */
function isInsufficientBalance(e: unknown): boolean {
  let text: string;
  if (e instanceof Error) {
    text = e.message;
  } else {
    try {
      text = JSON.stringify(e);
    } catch {
      text = String(e);
    }
  }
  return typeof text === 'string' && text.includes('InsufficientBalance');
}

@Injectable()
export class DepositService {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * "Deposit" = abastece a carteira do cliente com XLM (sponsor → cliente).
   * NÃO aporta no vault — isso é o `build`/`submit` (aporte). No testnet o
   * sponsor simula o on-ramp; em mainnet será substituído por rampa real.
   * O teto MAX_DEPOSIT_BASE_UNITS protege o sponsor de ser drenado num request.
   */
  async fund(companyId: string, amount: bigint): Promise<SubmitTxResponse> {
    if (amount > MAX_DEPOSIT_BASE_UNITS) {
      throw new BadRequestException('amount exceeds maximum deposit');
    }
    const address = await this.wallet.getAddress(companyId);
    const txHash = await this.stellar.fundClient(address, amount);
    return { txHash };
  }

  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    if (amount > MAX_DEPOSIT_BASE_UNITS) {
      throw new BadRequestException('amount exceeds maximum deposit');
    }
    const address = await this.wallet.getAddress(companyId);
    const balance = await this.stellar.getNativeBalance(address);
    const spendable =
      balance > RESERVE_BUFFER_BASE_UNITS
        ? balance - RESERVE_BUFFER_BASE_UNITS
        : 0n;
    if (amount > spendable) {
      throw new BadRequestException('saldo insuficiente na carteira');
    }
    // Defense-in-depth: o pré-check usa um buffer fixo (RESERVE_BUFFER) que não
    // contabiliza subentries. Se a simulação Soroban ainda falhar por saldo
    // (o SAC exige deixar a reserva base + 0.5 XLM por subentry), traduzimos o
    // InsufficientBalance da DeFindex num 400 amigável em vez de estourar 500.
    let xdr: string;
    try {
      ({ xdr } = await this.vault.buildDeposit(address, amount));
    } catch (e) {
      if (isInsufficientBalance(e)) {
        throw new BadRequestException('saldo insuficiente na carteira');
      }
      throw e;
    }
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async submit(
    companyId: string,
    dto: SubmitTxDto,
  ): Promise<{ txHash: string }> {
    const registered = await this.wallet.getAddress(companyId);
    if (dto.stellarAddress !== registered) {
      throw new ForbiddenException('stellar address does not match registered wallet');
    }
    const { txHash } = await this.stellar.attachAndSubmit(
      dto.xdr,
      dto.stellarAddress,
      dto.signatureHex,
    );
    await this.ledger.recordDeposit(
      companyId,
      parseBaseUnits(dto.amount),
      txHash,
    );
    return { txHash };
  }
}
