import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { SnapshotJob } from './snapshot.job';

@Module({
  imports: [LedgerModule],
  providers: [SnapshotJob],
})
export class JobsModule {}
