import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AuthModule } from '../auth/auth.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [AuthModule, StellarModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
