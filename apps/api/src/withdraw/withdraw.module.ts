import { Module } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';
import { VaultModule } from '../vault/vault.module';
import { StellarModule } from '../stellar/stellar.module';
import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [VaultModule, StellarModule, WalletModule, LedgerModule, AuthModule],
  controllers: [WithdrawController],
  providers: [WithdrawService],
  exports: [WithdrawService],
})
export class WithdrawModule {}
