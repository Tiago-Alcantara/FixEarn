import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VaultModule } from '../vault/vault.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PrismaModule, VaultModule, WalletModule],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
