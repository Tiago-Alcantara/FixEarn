import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { StellarModule } from '../stellar/stellar.module';
import { EtherfuseClient } from './etherfuse.client';
import { RampService } from './ramp.service';
import { RampController } from './ramp.controller';

@Module({
  imports: [PrismaModule, WalletModule, AuthModule, StellarModule],
  providers: [EtherfuseClient, RampService],
  controllers: [RampController],
})
export class RampModule {}
