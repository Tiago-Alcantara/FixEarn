# Final Review Fixes Report

Date: 2026-06-24

## Summary

All findings from the whole-branch review were addressed. Full unit test suite: **14 suites / 48 tests — all green**. Build: **clean**. Bootstrap e2e test: **fails before C1 fix, passes after**.

---

## C1 — App does not bootstrap (DI broken)

**Root cause:** `AuthModule` exported `[PrivyService, AuthGuard]` but not `CompanyModule`. When consumer modules (WalletModule, DepositModule, WithdrawModule, BillsModule) import `AuthModule` to get `AuthGuard`, they do not get `CompanyService` which `AuthGuard` depends on.

**Additionally found:** `LedgerModule` (whose controller uses `AuthGuard`) was not importing `AuthModule` at all.

**Changes:**
- `apps/api/src/auth/auth.module.ts`: added `CompanyModule` to `exports: [PrivyService, AuthGuard, CompanyModule]`
- `apps/api/src/ledger/ledger.module.ts`: added `AuthModule` to `imports`

**Test evidence (bootstrap.e2e-spec.ts):**

Before fix — rejected with:
```
Nest can't resolve dependencies of the AuthGuard (PrivyService, ?). Please make sure that the
argument CompanyService at index [1] is available in the WalletModule module.
```
And after WalletModule was fixed (but LedgerModule was not):
```
Nest can't resolve dependencies of the AuthGuard (?, CompanyService). Please make sure that the
argument PrivyService at index [0] is available in the LedgerModule module.
```

After fix — **1 passed, 1 total**.

---

## NEW TEST — bootstrap.e2e-spec.ts

Created `apps/api/test/bootstrap.e2e-spec.ts`. Calls `Test.createTestingModule({ imports: [AppModule] }).compile()` only (no `.init()`/`.listen()`), asserts resolves without throwing. Also updated `apps/api/test/jest-e2e.json` to add `transformIgnorePatterns` (matching the unit jest config) so that ESM packages from `@stellar/stellar-sdk` transitive deps are transpiled correctly — this was a pre-existing gap that blocked all e2e suites.

---

## C2 — BigInt JSON serialization 500s

**Changes:**
- `apps/api/src/main.ts`: added `(BigInt.prototype as any).toJSON = function () { return this.toString(); };` before bootstrap + global `ValidationPipe`
- `apps/api/test/setup-env.ts`: same shim added so tests exercise identical behavior

**Tests:** `apps/api/src/common/parse-money.spec.ts` includes a `BigInt JSON serialization shim` describe block asserting `JSON.stringify({ x: 1n })` → `'{"x":"1"}'`.

---

## I2 — No input validation; raw BigInt() 500s on malformed input

**Changes:**
- Created `apps/api/src/common/parse-money.ts` — `parseBaseUnits(raw)` helper: requires non-null/non-empty, matches `/^\d+$/` regex, rejects `0`. Throws `BadRequestException` on all invalid inputs.
- `apps/api/src/main.ts`: global `ValidationPipe({ whitelist: true, transform: true })`
- `apps/api/src/deposit/deposit.controller.ts`: replaced `BigInt(body.amount)` with `parseBaseUnits(body.amount)`
- `apps/api/src/withdraw/withdraw.controller.ts`: same
- `apps/api/src/deposit/deposit.service.ts`: replaced `BigInt(dto.amount)` with `parseBaseUnits(dto.amount)` in `submit`
- `apps/api/src/bills/bills.service.ts`: replaced `BigInt(dto.monthlyCost)` with `parseBaseUnits(dto.monthlyCost)`

**Tests:** `apps/api/src/common/parse-money.spec.ts` — 8 cases: valid, empty, undefined, null, non-numeric, decimal, zero, negative-sign prefix.

---

## I3 — `Number(amount)` precision ceiling in VaultService

**Changes:**
- `apps/api/src/vault/vault.service.ts`: added `assertSafeInteger(amount)` helper that throws `'amount exceeds safe integer range for SDK'` when `amount > BigInt(Number.MAX_SAFE_INTEGER)`. Called at the top of both `buildDeposit` and `buildWithdraw`.

**Tests:** `apps/api/src/vault/vault.service.spec.ts` — new `buildDeposit / buildWithdraw — safe integer guard (I3)` describe: throws for `MAX_SAFE_INTEGER + 1n` in deposit and withdraw, passes at exactly `MAX_SAFE_INTEGER`.

---

## I4 — Placeholder shares must not ship as real USDC on mainnet

**Changes:**
- `apps/api/src/vault/vault.service.ts`: at top of `getPositionValue`, if `cfg.stellarNetwork === 'public'`, throws `'getPositionValue: shares→USDC conversion not yet implemented; refusing to report placeholder value on mainnet'`.

**Tests:** `apps/api/src/vault/vault.service.spec.ts` — updated existing testnet test + new `'throws on mainnet (I4 guard)'` test verifying the error is thrown and `getVaultBalance` is NOT called.

---

## M3 — Validate stellar address in wallet.service.ts

**Changes:**
- `apps/api/src/wallet/wallet.service.ts`: imported `StrKey` from `@stellar/stellar-sdk`; at start of `register`, throws `BadRequestException('invalid stellar address')` when `!StrKey.isValidEd25519PublicKey(stellarAddress)`.

**Tests:** `apps/api/src/wallet/wallet.service.spec.ts` — added test asserting `BadRequestException` for invalid address, and updated existing register test to use a real valid Stellar public key (`GDUKN35CP3SQ67QMZL5SKCUCX6MB47TX4SZBTS5UHKFMGTF35Z3723DY`).

---

## M5 — Fix .env.example DATABASE_URL port

**Changes:**
- `apps/api/.env.example`: `localhost:5432` → `localhost:5433`

---

## Test Results

```
Test Suites: 14 passed, 14 total
Tests:       48 passed, 48 total
Snapshots:   0 total
Time:        ~2.8 s
```

Build: `pnpm --filter @fixearn/api build` — clean, no errors.

Bootstrap e2e: **fails before C1 fix** (DI error), **passes after** (1 passed, 1 total).

---

## Files Changed

- `apps/api/src/auth/auth.module.ts` — C1: added CompanyModule to exports
- `apps/api/src/ledger/ledger.module.ts` — C1: added AuthModule to imports
- `apps/api/src/main.ts` — C2 BigInt shim + I2 ValidationPipe
- `apps/api/test/setup-env.ts` — C2 BigInt shim for tests
- `apps/api/test/jest-e2e.json` — added transformIgnorePatterns for ESM stellar deps
- `apps/api/test/bootstrap.e2e-spec.ts` — NEW: DI graph bootstrap test
- `apps/api/src/common/parse-money.ts` — NEW: I2 parseBaseUnits helper
- `apps/api/src/common/parse-money.spec.ts` — NEW: I2 + C2 shim tests
- `apps/api/src/deposit/deposit.controller.ts` — I2: use parseBaseUnits
- `apps/api/src/deposit/deposit.service.ts` — I2: use parseBaseUnits for submit
- `apps/api/src/withdraw/withdraw.controller.ts` — I2: use parseBaseUnits
- `apps/api/src/bills/bills.service.ts` — I2: use parseBaseUnits
- `apps/api/src/vault/vault.service.ts` — I3: assertSafeInteger + I4: mainnet guard
- `apps/api/src/vault/vault.service.spec.ts` — I3 + I4 tests
- `apps/api/src/wallet/wallet.service.ts` — M3: StrKey validation
- `apps/api/src/wallet/wallet.service.spec.ts` — M3 test + valid address
- `apps/api/.env.example` — M5: port 5432 → 5433
