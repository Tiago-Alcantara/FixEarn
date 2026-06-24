import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [AppConfigModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
