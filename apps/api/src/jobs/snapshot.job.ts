import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class SnapshotJob {
  private readonly log = new Logger(SnapshotJob.name);
  constructor(private readonly prisma: PrismaService, private readonly ledger: LedgerService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduled() { await this.runOnce(); }

  async runOnce(): Promise<{ count: number }> {
    const companies = await this.prisma.company.findMany({
      where: { wallet: { isNot: null } }, select: { id: true },
    });
    let count = 0;
    for (const c of companies) {
      try { await this.ledger.snapshot(c.id); count++; }
      catch (e) { this.log.error(`snapshot failed for ${c.id}: ${String(e)}`); }
    }
    return { count };
  }
}
