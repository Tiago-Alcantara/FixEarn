import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StrKey } from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  async register(companyId: string, stellarAddress: string) {
    if (!StrKey.isValidEd25519PublicKey(stellarAddress)) {
      throw new BadRequestException('invalid stellar address');
    }
    // Fund on-chain first; only persist once the account is live.
    await this.stellar.ensureAccountFunded(stellarAddress);
    return this.prisma.wallet.upsert({
      where: { companyId },
      create: { companyId, stellarAddress },
      update: { stellarAddress },
    });
  }

  async getAddress(companyId: string): Promise<string> {
    const wallet = await this.prisma.wallet.findUnique({ where: { companyId } });
    if (!wallet) throw new NotFoundException('wallet not registered');
    return wallet.stellarAddress;
  }
}
