import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DepositService } from './deposit.service';
import { parseBaseUnits } from '../common/parse-money';
import type { SubmitTxDto } from '@fixearn/shared';

@Controller('deposit')
@UseGuards(AuthGuard)
export class DepositController {
  constructor(private readonly deposits: DepositService) {}

  @Post('build')
  build(@Req() req: any, @Body() body: { amount: string }) {
    return this.deposits.build(req.companyId, parseBaseUnits(body.amount));
  }

  @Post('submit')
  submit(@Req() req: any, @Body() body: SubmitTxDto) {
    return this.deposits.submit(req.companyId, body);
  }
}
