import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

/**
 * Bootstrap DI graph test.
 *
 * Compiles the full NestJS module graph without calling `.init()` or `.listen()`,
 * so no real DB connections or network calls are made.
 *
 * This test FAILS when modules are misconfigured (e.g. AuthModule not re-exporting
 * CompanyModule, causing AuthGuard to be unable to resolve CompanyService in
 * consumer modules like WalletModule/DepositModule/etc.).
 *
 * It PASSES after C1 fix: `exports: [PrivyService, AuthGuard, CompanyModule]`
 * in AuthModule.
 */
describe('App DI graph (bootstrap)', () => {
  it('compiles the full module graph without throwing', async () => {
    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).resolves.toBeDefined();
  });
});
