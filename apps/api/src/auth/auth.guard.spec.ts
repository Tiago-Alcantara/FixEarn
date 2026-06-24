import { AuthGuard } from './auth.guard';
import { UnauthorizedException } from '@nestjs/common';

const ctx = (headers: Record<string, string>) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers, } as any) }),
}) as any;

it('rejects when no bearer token', async () => {
  const guard = new AuthGuard({ verify: jest.fn() } as any, { findOrCreate: jest.fn() } as any);
  await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
});

it('verifies token and attaches companyId', async () => {
  const privy = { verify: jest.fn().mockResolvedValue({ privyUserId: 'did:privy:z' }) };
  const company = { findOrCreate: jest.fn().mockResolvedValue({ id: 'co_9' }) };
  const guard = new AuthGuard(privy as any, company as any);
  const req: any = { headers: { authorization: 'Bearer tok123' } };
  const c = ctx(req.headers);
  (c.switchToHttp().getRequest as any) = () => req;
  const ok = await guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any);
  expect(ok).toBe(true);
  expect(privy.verify).toHaveBeenCalledWith('tok123');
  expect(req.companyId).toBe('co_9');
});
