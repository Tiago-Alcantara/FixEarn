import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VaultModule } from '../vault/vault.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PrismaModule, VaultModule, WalletModule],
  providers: [LedgerService],
  controllers: [LedgerController],
  exports: [LedgerService],
})
export class LedgerModule {}
