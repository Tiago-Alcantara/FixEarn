import { ForbiddenException, Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';
import { parseBaseUnits } from '../common/parse-money';
import { BuildTxResponse, SubmitTxDto } from '@yield2pay/shared';

@Injectable()
export class WithdrawService {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
  ) {}

  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    const address = await this.wallet.getAddress(companyId);
    const { xdr } = await this.vault.buildWithdraw(address, amount);
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
    await this.ledger.recordWithdraw(companyId, parseBaseUnits(dto.amount), txHash);
    return { txHash };
  }
}
