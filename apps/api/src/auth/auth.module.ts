import { Module } from '@nestjs/common';
import { PrivyService } from './privy.service';
import { AuthGuard } from './auth.guard';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [CompanyModule],
  providers: [PrivyService, AuthGuard],
  exports: [PrivyService, AuthGuard],
})
export class AuthModule {}
