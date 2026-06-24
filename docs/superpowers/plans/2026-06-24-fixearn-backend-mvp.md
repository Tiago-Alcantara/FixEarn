# FixEarn Backend MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the NestJS backend that lets a company deposit USDC into a DeFindex vault via a Privy-signed Stellar transaction, tracks principal vs. accrued yield ("spendable"), and exposes recurring-bill registration — all non-custodial.

**Architecture:** A NestJS monorepo app (`apps/api`) over Postgres (Prisma). The backend builds unsigned Stellar XDR with `@defindex/sdk`, returns the transaction hash for the client's Privy embedded wallet to sign, then attaches the signature and submits via Soroban RPC. Auth is delegated to Privy (`@privy-io/server-auth` token verification). The ledger derives "spendable = current vault value − principal" from on-chain reads plus recorded deposits. Software is one category of a generic `RecurringBill` model.

**Tech Stack:** TypeScript, NestJS 10, Prisma + Postgres, `@defindex/sdk`, `@privy-io/server-auth`, `@stellar/stellar-sdk` (Soroban RPC + XDR signature assembly), Jest + Supertest.

## Global Constraints

- **Language:** TypeScript everywhere, `strict: true`.
- **Monorepo layout:** app lives in `apps/api`; shared types in `packages/shared`. This plan only builds `apps/api` and `packages/shared`.
- **Non-custodial, always:** the backend NEVER holds a private key. It only builds XDR, accepts a client-produced signature, assembles, and submits. No key material is ever stored or logged.
- **Asset:** USDC on Stellar. Single-asset vault → DeFindex `amounts` arrays always have length 1.
- **Network:** value from env `STELLAR_NETWORK` ∈ {`testnet`,`public`}; MVP runs against `testnet`.
- **Money type:** all on-chain amounts handled as integer **stroops/base units** (`bigint` or string), never JS floats. USDC has 7 decimals on Stellar.
- **Naming:** `RecurringBill.type` ∈ {`software`,`utility`,`other`}.
- **No secrets in code:** all keys via env, validated at boot.

---

## File Structure

```
apps/api/
  src/
    main.ts                          # bootstrap
    app.module.ts                    # root module
    config/
      env.ts                         # zod env schema + typed config
      config.module.ts               # NestJS ConfigModule wiring
    prisma/
      prisma.service.ts              # PrismaClient lifecycle
      prisma.module.ts
    auth/
      privy.service.ts               # wraps @privy-io/server-auth verifyAuthToken
      auth.guard.ts                  # extracts+verifies Bearer, attaches companyId
      auth.module.ts
    company/
      company.service.ts             # find-or-create company by privyUserId
      company.module.ts
    wallet/
      wallet.service.ts              # persist/read company stellarAddress
      wallet.controller.ts           # POST /wallet (register address)
      wallet.module.ts
    stellar/
      stellar.service.ts             # XDR parse, hash, attach sig, submit via RPC
      stellar.module.ts
    vault/
      vault.service.ts               # wraps @defindex/sdk
      vault.module.ts
    ledger/
      ledger.service.ts              # spendable calc, deposit/snapshot records
      ledger.module.ts
    deposit/
      deposit.controller.ts          # POST /deposit/build, POST /deposit/submit
      deposit.service.ts             # orchestrates vault+stellar+ledger
      deposit.module.ts
    withdraw/
      withdraw.controller.ts         # POST /withdraw/build, POST /withdraw/submit
      withdraw.service.ts
      withdraw.module.ts
    bills/
      bills.controller.ts            # CRUD /bills
      bills.service.ts
      bills.module.ts
    jobs/
      snapshot.job.ts                # daily yield snapshot cron
      jobs.module.ts
  prisma/
    schema.prisma
  test/                              # e2e (supertest)
  package.json
  tsconfig.json
  .env.example
packages/shared/
  src/index.ts                       # shared DTO/types (BillType, DepositDto, etc.)
  package.json
```

---

## Task 1: Monorepo scaffold + NestJS boot + health check

**Files:**
- Create: `package.json` (root, workspaces), `pnpm-workspace.yaml`, `.gitignore` additions
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Test: `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: a bootable Nest app on `PORT` with `GET /health` → `{status:'ok'}`.

- [ ] **Step 1: Root workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Root `package.json`:
```json
{
  "name": "fixearn",
  "private": true,
  "scripts": {
    "api:dev": "pnpm --filter @fixearn/api start:dev",
    "api:test": "pnpm --filter @fixearn/api test"
  }
}
```

- [ ] **Step 2: Scaffold the Nest app**

Run:
```bash
mkdir -p apps/api packages/shared
cd apps/api && pnpm dlx @nestjs/cli new . --skip-git --package-manager pnpm --strict
```
Then set `"name": "@fixearn/api"` in `apps/api/package.json` and add deps:
```bash
pnpm --filter @fixearn/api add @nestjs/config zod
pnpm --filter @fixearn/api add -D supertest @types/supertest
```

- [ ] **Step 3: Write the failing health e2e test**

`apps/api/test/health.e2e-spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('GET /health -> ok', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 4: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test:e2e -- health`
Expected: FAIL — `/health` 404.

- [ ] **Step 5: Implement health controller + register in AppModule**

`apps/api/src/health/health.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```
Add `HealthController` to `app.module.ts` `controllers: [HealthController]`.

- [ ] **Step 6: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test:e2e -- health`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo + nest api with health check"
```

---

## Task 2: Typed, validated env config

**Files:**
- Create: `apps/api/src/config/env.ts`, `apps/api/src/config/config.module.ts`
- Create: `apps/api/.env.example`
- Test: `apps/api/src/config/env.spec.ts`

**Interfaces:**
- Produces: `loadEnv(raw: Record<string,string|undefined>): Env` and an injectable `AppConfig` exposing typed values:
  `databaseUrl: string`, `privyAppId: string`, `privyAppSecret: string`, `defindexApiKey: string`, `defindexBaseUrl: string`, `vaultAddress: string`, `usdcAddress: string`, `stellarNetwork: 'testnet'|'public'`, `sorobanRpcUrl: string`, `port: number`.

- [ ] **Step 1: Write failing test**

`apps/api/src/config/env.spec.ts`:
```typescript
import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgres://x', PRIVY_APP_ID: 'a', PRIVY_APP_SECRET: 's',
  DEFINDEX_API_KEY: 'sk', DEFINDEX_BASE_URL: 'https://api.defindex.io',
  VAULT_ADDRESS: 'C...', USDC_ADDRESS: 'C...usdc', STELLAR_NETWORK: 'testnet',
  SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org', PORT: '3000',
};

it('parses a valid env', () => {
  const env = loadEnv(base);
  expect(env.stellarNetwork).toBe('testnet');
  expect(env.port).toBe(3000);
});

it('rejects an invalid network', () => {
  expect(() => loadEnv({ ...base, STELLAR_NETWORK: 'mainnet' })).toThrow();
});

it('rejects missing required keys', () => {
  const { PRIVY_APP_SECRET, ...rest } = base;
  expect(() => loadEnv(rest)).toThrow();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- env`
Expected: FAIL — `loadEnv` not defined.

- [ ] **Step 3: Implement `env.ts`**

```typescript
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  DEFINDEX_API_KEY: z.string().min(1),
  DEFINDEX_BASE_URL: z.string().url(),
  VAULT_ADDRESS: z.string().min(1),
  USDC_ADDRESS: z.string().min(1),
  STELLAR_NETWORK: z.enum(['testnet', 'public']),
  SOROBAN_RPC_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = {
  databaseUrl: string; privyAppId: string; privyAppSecret: string;
  defindexApiKey: string; defindexBaseUrl: string; vaultAddress: string;
  usdcAddress: string; stellarNetwork: 'testnet' | 'public';
  sorobanRpcUrl: string; port: number;
};

export function loadEnv(raw: Record<string, string | undefined>): Env {
  const p = schema.parse(raw);
  return {
    databaseUrl: p.DATABASE_URL, privyAppId: p.PRIVY_APP_ID,
    privyAppSecret: p.PRIVY_APP_SECRET, defindexApiKey: p.DEFINDEX_API_KEY,
    defindexBaseUrl: p.DEFINDEX_BASE_URL, vaultAddress: p.VAULT_ADDRESS,
    usdcAddress: p.USDC_ADDRESS, stellarNetwork: p.STELLAR_NETWORK,
    sorobanRpcUrl: p.SOROBAN_RPC_URL, port: p.PORT,
  };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- env`
Expected: PASS.

- [ ] **Step 5: Wire `AppConfig` provider + `.env.example`**

`apps/api/src/config/config.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { loadEnv, Env } from './env';

export const APP_CONFIG = 'APP_CONFIG';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): Env => loadEnv(process.env) }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
```
`apps/api/.env.example`: list every key from the schema with placeholder values. Import `AppConfigModule` in `app.module.ts`. In `main.ts`, read `port` from the injected config.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: typed validated env config"
```

---

## Task 3: Prisma schema + migration

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`
- Test: `apps/api/src/prisma/prisma.service.spec.ts`

**Interfaces:**
- Produces: Prisma models `Company`, `Wallet`, `Deposit`, `YieldSnapshot`, `RecurringBill`; injectable `PrismaService extends PrismaClient`.

- [ ] **Step 1: Add Prisma + define schema**

Run:
```bash
pnpm --filter @fixearn/api add @prisma/client && pnpm --filter @fixearn/api add -D prisma
```
`apps/api/prisma/schema.prisma`:
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Company {
  id           String          @id @default(cuid())
  privyUserId  String          @unique
  createdAt    DateTime        @default(now())
  wallet       Wallet?
  deposits     Deposit[]
  snapshots    YieldSnapshot[]
  bills        RecurringBill[]
}

model Wallet {
  id             String   @id @default(cuid())
  company        Company  @relation(fields: [companyId], references: [id])
  companyId      String   @unique
  stellarAddress String   @unique
  createdAt      DateTime @default(now())
}

model Deposit {
  id        String   @id @default(cuid())
  company   Company  @relation(fields: [companyId], references: [id])
  companyId String
  amount    BigInt   // USDC base units (7 decimals)
  txHash    String   @unique
  createdAt DateTime @default(now())
}

enum BillType { software utility other }

model RecurringBill {
  id          String   @id @default(cuid())
  company     Company  @relation(fields: [companyId], references: [id])
  companyId   String
  vendor      String
  monthlyCost BigInt   // USDC base units
  type        BillType @default(software)
  status      String   @default("active")
  createdAt   DateTime @default(now())
}

model YieldSnapshot {
  id         String   @id @default(cuid())
  company    Company  @relation(fields: [companyId], references: [id])
  companyId  String
  vaultValue BigInt   // current underlying USDC base units
  principal  BigInt   // sum of deposits at snapshot time
  spendable  BigInt   // max(0, vaultValue - principal)
  createdAt  DateTime @default(now())
  @@index([companyId, createdAt])
}
```

- [ ] **Step 2: Run the migration**

Run: `pnpm --filter @fixearn/api exec prisma migrate dev --name init`
Expected: migration created, client generated.

- [ ] **Step 3: Write failing PrismaService connectivity test**

`apps/api/src/prisma/prisma.service.spec.ts`:
```typescript
import { PrismaService } from './prisma.service';

it('connects and round-trips a company', async () => {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const c = await prisma.company.create({ data: { privyUserId: 'did:privy:test1' } });
  expect(c.id).toBeDefined();
  await prisma.company.delete({ where: { id: c.id } });
  await prisma.onModuleDestroy();
});
```

- [ ] **Step 4: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- prisma.service`
Expected: FAIL — `PrismaService` not defined.

- [ ] **Step 5: Implement PrismaService + module**

`apps/api/src/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```
`apps/api/src/prisma/prisma.module.ts`: `@Global()` module providing+exporting `PrismaService`.

- [ ] **Step 6: Run it, verify it passes** (requires a running Postgres; `DATABASE_URL` set)

Run: `pnpm --filter @fixearn/api test -- prisma.service`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: prisma schema + service (company, wallet, deposit, bill, snapshot)"
```

---

## Task 4: Privy auth guard

**Files:**
- Create: `apps/api/src/auth/privy.service.ts`, `apps/api/src/auth/auth.guard.ts`, `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/company/company.service.ts`, `apps/api/src/company/company.module.ts`
- Test: `apps/api/src/auth/auth.guard.spec.ts`, `apps/api/src/company/company.service.spec.ts`

**Interfaces:**
- Consumes: `APP_CONFIG` (privyAppId, privyAppSecret), `PrismaService`.
- Produces:
  - `PrivyService.verify(token: string): Promise<{ privyUserId: string }>` (throws on invalid).
  - `CompanyService.findOrCreate(privyUserId: string): Promise<{ id: string }>`.
  - `AuthGuard` (Nest `CanActivate`) that reads `Authorization: Bearer <token>`, verifies via `PrivyService`, find-or-creates the company, and sets `req.companyId`.

- [ ] **Step 1: Add dep + write failing CompanyService test**

Run: `pnpm --filter @fixearn/api add @privy-io/server-auth`
`apps/api/src/company/company.service.spec.ts`:
```typescript
import { CompanyService } from './company.service';

const prisma = {
  company: {
    upsert: jest.fn().mockResolvedValue({ id: 'co_1' }),
  },
} as any;

it('find-or-creates by privyUserId', async () => {
  const svc = new CompanyService(prisma);
  const c = await svc.findOrCreate('did:privy:abc');
  expect(c.id).toBe('co_1');
  expect(prisma.company.upsert).toHaveBeenCalledWith({
    where: { privyUserId: 'did:privy:abc' },
    create: { privyUserId: 'did:privy:abc' },
    update: {},
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- company.service`
Expected: FAIL — `CompanyService` not defined.

- [ ] **Step 3: Implement CompanyService**

`apps/api/src/company/company.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}
  async findOrCreate(privyUserId: string): Promise<{ id: string }> {
    return this.prisma.company.upsert({
      where: { privyUserId },
      create: { privyUserId },
      update: {},
    });
  }
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- company.service`
Expected: PASS.

- [ ] **Step 5: Write failing AuthGuard test**

`apps/api/src/auth/auth.guard.spec.ts`:
```typescript
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
```

- [ ] **Step 6: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- auth.guard`
Expected: FAIL — `AuthGuard` not defined.

- [ ] **Step 7: Implement PrivyService + AuthGuard**

`apps/api/src/auth/privy.service.ts`:
```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { APP_CONFIG } from '../config/config.module';
import { Env } from '../config/env';

@Injectable()
export class PrivyService {
  private client: PrivyClient;
  constructor(@Inject(APP_CONFIG) cfg: Env) {
    this.client = new PrivyClient(cfg.privyAppId, cfg.privyAppSecret);
  }
  async verify(token: string): Promise<{ privyUserId: string }> {
    const claims = await this.client.verifyAuthToken(token);
    return { privyUserId: claims.userId };
  }
}
```
`apps/api/src/auth/auth.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrivyService } from './privy.service';
import { CompanyService } from '../company/company.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly privy: PrivyService, private readonly companies: CompanyService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const token = header.slice('Bearer '.length);
    let claims: { privyUserId: string };
    try { claims = await this.privy.verify(token); }
    catch { throw new UnauthorizedException('invalid token'); }
    const company = await this.companies.findOrCreate(claims.privyUserId);
    req.companyId = company.id;
    return true;
  }
}
```
Wire `AuthModule` (provides `PrivyService`, `AuthGuard`, imports `CompanyModule`) and `CompanyModule`.

- [ ] **Step 8: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- auth.guard company.service`
Expected: PASS.

> **Verification note:** `verifyAuthToken`'s return shape (`.userId`) must be confirmed against the installed `@privy-io/server-auth` version. If the field differs (e.g. `.user_id`), adjust `PrivyService.verify` only. The guard contract is unchanged.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: privy auth guard + company find-or-create"
```

---

## Task 5: Wallet registration

**Files:**
- Create: `apps/api/src/wallet/wallet.service.ts`, `wallet.controller.ts`, `wallet.module.ts`
- Create: `packages/shared/src/index.ts` (DTO types)
- Test: `apps/api/src/wallet/wallet.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `AuthGuard` (provides `req.companyId`).
- Produces:
  - `WalletService.register(companyId: string, stellarAddress: string): Promise<{ stellarAddress: string }>`.
  - `WalletService.getAddress(companyId: string): Promise<string>` (throws `NotFoundException` if none).
  - `POST /wallet` body `{ stellarAddress: string }` → `{ stellarAddress }`.

- [ ] **Step 1: Define shared DTO + write failing WalletService test**

`packages/shared/src/index.ts`:
```typescript
export type BillType = 'software' | 'utility' | 'other';
export interface RegisterWalletDto { stellarAddress: string; }
export interface BuildTxResponse { xdr: string; hash: string; }
export interface SubmitTxDto { xdr: string; signatureHex: string; stellarAddress: string; amount: string; }
export interface CreateBillDto { vendor: string; monthlyCost: string; type: BillType; }
export interface SpendableView { vaultValue: string; principal: string; spendable: string; apyPercent: string; }
```
`apps/api/src/wallet/wallet.service.spec.ts`:
```typescript
import { WalletService } from './wallet.service';
import { NotFoundException } from '@nestjs/common';

it('registers an address (upsert by company)', async () => {
  const prisma = { wallet: { upsert: jest.fn().mockResolvedValue({ stellarAddress: 'GABC' }) } } as any;
  const svc = new WalletService(prisma);
  const r = await svc.register('co_1', 'GABC');
  expect(r.stellarAddress).toBe('GABC');
  expect(prisma.wallet.upsert).toHaveBeenCalledWith({
    where: { companyId: 'co_1' },
    create: { companyId: 'co_1', stellarAddress: 'GABC' },
    update: { stellarAddress: 'GABC' },
  });
});

it('throws when address missing', async () => {
  const prisma = { wallet: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
  const svc = new WalletService(prisma);
  await expect(svc.getAddress('co_x')).rejects.toBeInstanceOf(NotFoundException);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- wallet.service`
Expected: FAIL — `WalletService` not defined.

- [ ] **Step 3: Implement WalletService**

`apps/api/src/wallet/wallet.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async register(companyId: string, stellarAddress: string) {
    return this.prisma.wallet.upsert({
      where: { companyId },
      create: { companyId, stellarAddress },
      update: { stellarAddress },
    });
  }

  async getAddress(companyId: string): Promise<string> {
    const w = await this.prisma.wallet.findUnique({ where: { companyId } });
    if (!w) throw new NotFoundException('wallet not registered');
    return w.stellarAddress;
  }
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- wallet.service`
Expected: PASS.

- [ ] **Step 5: Implement controller + module**

`apps/api/src/wallet/wallet.controller.ts`:
```typescript
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WalletService } from './wallet.service';
import { RegisterWalletDto } from '@fixearn/shared';

@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly wallets: WalletService) {}
  @Post()
  register(@Req() req: any, @Body() body: RegisterWalletDto) {
    return this.wallets.register(req.companyId, body.stellarAddress);
  }
}
```
Wire `WalletModule`. Add `@fixearn/shared` path mapping in `apps/api/tsconfig.json`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wallet registration endpoint + shared DTOs"
```

---

## Task 6: Vault wrapper over @defindex/sdk

**Files:**
- Create: `apps/api/src/vault/vault.service.ts`, `vault.module.ts`
- Test: `apps/api/src/vault/vault.service.spec.ts`
- Test (integration, opt-in): `apps/api/test/vault.integration-spec.ts`

**Interfaces:**
- Consumes: `APP_CONFIG` (defindexApiKey, defindexBaseUrl, vaultAddress, stellarNetwork).
- Produces:
  - `VaultService.buildDeposit(caller: string, amount: bigint): Promise<{ xdr: string }>`.
  - `VaultService.buildWithdraw(caller: string, amount: bigint): Promise<{ xdr: string }>`.
  - `VaultService.getPositionValue(userAddress: string): Promise<bigint>` — underlying USDC base units (NOT shares).
  - `VaultService.getApyPercent(): Promise<string>`.

- [ ] **Step 1: Add dep + write failing unit test (SDK mocked)**

Run: `pnpm --filter @fixearn/api add @defindex/sdk`
`apps/api/src/vault/vault.service.spec.ts`:
```typescript
import { VaultService } from './vault.service';

const cfg = {
  defindexApiKey: 'sk', defindexBaseUrl: 'https://api.defindex.io',
  vaultAddress: 'CVAULT', stellarNetwork: 'testnet',
} as any;

function makeSdk(over: Partial<any> = {}) {
  return {
    depositToVault: jest.fn().mockResolvedValue({ xdr: 'XDR_DEP' }),
    withdrawFromVault: jest.fn().mockResolvedValue({ xdr: 'XDR_WD' }),
    getVaultAPY: jest.fn().mockResolvedValue({ apyPercent: '7.50' }),
    ...over,
  };
}

it('builds a deposit with single-asset amount array', async () => {
  const sdk = makeSdk();
  const svc = new VaultService(cfg, sdk as any);
  const r = await svc.buildDeposit('GCALLER', 1000000n);
  expect(r.xdr).toBe('XDR_DEP');
  expect(sdk.depositToVault).toHaveBeenCalledWith(
    'CVAULT',
    { amounts: [1000000], caller: 'GCALLER', invest: true, slippageBps: 50 },
    'testnet',
  );
});

it('builds a withdraw', async () => {
  const sdk = makeSdk();
  const svc = new VaultService(cfg, sdk as any);
  const r = await svc.buildWithdraw('GCALLER', 500000n);
  expect(r.xdr).toBe('XDR_WD');
  expect(sdk.withdrawFromVault).toHaveBeenCalledWith(
    'CVAULT',
    { amounts: [500000], caller: 'GCALLER', slippageBps: 50 },
    'testnet',
  );
});

it('returns APY percent string', async () => {
  const svc = new VaultService(cfg, makeSdk() as any);
  expect(await svc.getApyPercent()).toBe('7.50');
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- vault.service`
Expected: FAIL — `VaultService` not defined.

- [ ] **Step 3: Implement VaultService**

`apps/api/src/vault/vault.service.ts`:
```typescript
import { Inject, Injectable } from '@nestjs/common';
import { DefindexSDK } from '@defindex/sdk';
import { APP_CONFIG } from '../config/config.module';
import { Env } from '../config/env';

export const DEFINDEX_SDK = 'DEFINDEX_SDK';

@Injectable()
export class VaultService {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: Env,
    @Inject(DEFINDEX_SDK) private readonly sdk: DefindexSDK,
  ) {}

  buildDeposit(caller: string, amount: bigint) {
    return this.sdk.depositToVault(
      this.cfg.vaultAddress,
      { amounts: [Number(amount)], caller, invest: true, slippageBps: 50 },
      this.cfg.stellarNetwork,
    );
  }

  buildWithdraw(caller: string, amount: bigint) {
    return this.sdk.withdrawFromVault(
      this.cfg.vaultAddress,
      { amounts: [Number(amount)], caller, slippageBps: 50 },
      this.cfg.stellarNetwork,
    );
  }

  async getApyPercent(): Promise<string> {
    const { apyPercent } = await this.sdk.getVaultAPY(this.cfg.vaultAddress, this.cfg.stellarNetwork);
    return apyPercent;
  }

  // Underlying USDC value of the user's position. See verification note below.
  async getPositionValue(userAddress: string): Promise<bigint> {
    const { dfTokens } = await this.sdk.getVaultBalance(
      this.cfg.vaultAddress, userAddress, this.cfg.stellarNetwork,
    );
    // dfTokens are vault shares. Convert to underlying via the integration test's
    // confirmed method (see Step 5). Placeholder 1:1 is REPLACED in Step 5.
    return BigInt(dfTokens);
  }
}
```
`vault.module.ts` provides `DEFINDEX_SDK` via factory:
```typescript
{ provide: DEFINDEX_SDK, inject: [APP_CONFIG], useFactory: (cfg: Env) =>
    new DefindexSDK({ apiKey: cfg.defindexApiKey, baseUrl: cfg.defindexBaseUrl }) }
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- vault.service`
Expected: PASS.

- [ ] **Step 5: Pin shares→underlying conversion with a testnet integration test**

This is the one integration-uncertain point. Write `apps/api/test/vault.integration-spec.ts` (guarded by `process.env.RUN_INTEGRATION === '1'`) that, against a real funded testnet vault, deposits a known amount and asserts `getPositionValue` returns a USDC base-unit value within rounding tolerance of the deposit. While implementing:

1. Inspect the installed `@defindex/sdk` typings for a method returning underlying value or price-per-share (candidates: a `getVaultInfo`/`report`/`totalAssets`-style method, or a `pricePerShare`). Confirm via `node -e "console.log(Object.getOwnPropertyNames(require('@defindex/sdk').DefindexSDK.prototype))"`.
2. Replace the 1:1 placeholder in `getPositionValue` with the real conversion (`shares × pricePerShare`).
3. Run: `RUN_INTEGRATION=1 pnpm --filter @fixearn/api test -- vault.integration` and confirm the asserted value matches.

Expected: PASS against testnet; the conversion method is now pinned by a real assertion.

> **Verification note:** Do NOT ship `getPositionValue` until this integration test passes — the spendable calculation (Task 7) depends on it returning true underlying USDC, not raw shares.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: defindex vault wrapper (deposit/withdraw/apy/position value)"
```

---

## Task 7: Ledger — deposits, spendable, snapshots

**Files:**
- Create: `apps/api/src/ledger/ledger.service.ts`, `ledger.module.ts`
- Test: `apps/api/src/ledger/ledger.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `VaultService`, `WalletService`.
- Produces:
  - `LedgerService.recordDeposit(companyId: string, amount: bigint, txHash: string): Promise<void>`.
  - `LedgerService.principal(companyId: string): Promise<bigint>` (sum of deposits).
  - `LedgerService.computeSpendable(companyId: string): Promise<{ vaultValue: bigint; principal: bigint; spendable: bigint }>` where `spendable = max(0n, vaultValue - principal)`.
  - `LedgerService.snapshot(companyId: string): Promise<void>` (persists a `YieldSnapshot`).

- [ ] **Step 1: Write failing spendable test (core business rule)**

`apps/api/src/ledger/ledger.service.spec.ts`:
```typescript
import { LedgerService } from './ledger.service';

function makeDeps(opts: { deposits: bigint[]; vaultValue: bigint; address?: string }) {
  const prisma = {
    deposit: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: opts.deposits.reduce((a, b) => a + b, 0n) } }),
      create: jest.fn().mockResolvedValue({}),
    },
    yieldSnapshot: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const wallet = { getAddress: jest.fn().mockResolvedValue(opts.address ?? 'GADDR') } as any;
  const vault = { getPositionValue: jest.fn().mockResolvedValue(opts.vaultValue) } as any;
  return { prisma, wallet, vault, svc: new LedgerService(prisma, vault, wallet) };
}

it('spendable = vaultValue - principal when positive', async () => {
  const { svc } = makeDeps({ deposits: [1000000n], vaultValue: 1075000n });
  const r = await svc.computeSpendable('co_1');
  expect(r.principal).toBe(1000000n);
  expect(r.vaultValue).toBe(1075000n);
  expect(r.spendable).toBe(75000n);
});

it('spendable clamps to 0 when vaultValue < principal', async () => {
  const { svc } = makeDeps({ deposits: [1000000n], vaultValue: 990000n });
  const r = await svc.computeSpendable('co_1');
  expect(r.spendable).toBe(0n);
});

it('principal sums multiple deposits', async () => {
  const { svc } = makeDeps({ deposits: [1000000n, 500000n], vaultValue: 1600000n });
  const r = await svc.computeSpendable('co_1');
  expect(r.principal).toBe(1500000n);
  expect(r.spendable).toBe(100000n);
});

it('principal is 0 with no deposits', async () => {
  const prisma = { deposit: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) } } as any;
  const svc = new LedgerService(prisma, {} as any, {} as any);
  expect(await svc.principal('co_x')).toBe(0n);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- ledger.service`
Expected: FAIL — `LedgerService` not defined.

- [ ] **Step 3: Implement LedgerService**

`apps/api/src/ledger/ledger.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly wallet: WalletService,
  ) {}

  async recordDeposit(companyId: string, amount: bigint, txHash: string): Promise<void> {
    await this.prisma.deposit.create({ data: { companyId, amount, txHash } });
  }

  async principal(companyId: string): Promise<bigint> {
    const agg = await this.prisma.deposit.aggregate({
      where: { companyId }, _sum: { amount: true },
    });
    return agg._sum.amount ?? 0n;
  }

  async computeSpendable(companyId: string) {
    const address = await this.wallet.getAddress(companyId);
    const [vaultValue, principal] = await Promise.all([
      this.vault.getPositionValue(address),
      this.principal(companyId),
    ]);
    const spendable = vaultValue > principal ? vaultValue - principal : 0n;
    return { vaultValue, principal, spendable };
  }

  async snapshot(companyId: string): Promise<void> {
    const { vaultValue, principal, spendable } = await this.computeSpendable(companyId);
    await this.prisma.yieldSnapshot.create({ data: { companyId, vaultValue, principal, spendable } });
  }
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- ledger.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ledger spendable calc + deposit/snapshot records"
```

---

## Task 8: Stellar service — hash, attach signature, submit

**Files:**
- Create: `apps/api/src/stellar/stellar.service.ts`, `stellar.module.ts`
- Test: `apps/api/src/stellar/stellar.service.spec.ts`

**Interfaces:**
- Consumes: `APP_CONFIG` (sorobanRpcUrl, stellarNetwork).
- Produces:
  - `StellarService.hashForSigning(xdr: string): { hash: string }` — returns `0x`-prefixed hex of the transaction hash the client must sign.
  - `StellarService.attachAndSubmit(xdr: string, stellarAddress: string, signatureHex: string): Promise<{ txHash: string }>` — builds a `DecoratedSignature` from the raw ed25519 signature, adds it to the transaction, and submits via Soroban RPC; returns the network tx hash.

- [ ] **Step 1: Add dep + write failing hash test**

Run: `pnpm --filter @fixearn/api add @stellar/stellar-sdk`
`apps/api/src/stellar/stellar.service.spec.ts`:
```typescript
import { StellarService } from './stellar.service';
import { Keypair, TransactionBuilder, Account, Operation, Asset, Networks, BASE_FEE } from '@stellar/stellar-sdk';

const cfg = { sorobanRpcUrl: 'https://soroban-testnet.stellar.org', stellarNetwork: 'testnet' } as any;

function sampleXdr(): { xdr: string; address: string; kp: Keypair } {
  const kp = Keypair.random();
  const account = new Account(kp.publicKey(), '0');
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: kp.publicKey(), asset: Asset.native(), amount: '1' }))
    .setTimeout(60)
    .build();
  return { xdr: tx.toXDR(), address: kp.publicKey(), kp };
}

it('returns a 0x-prefixed 32-byte hash for signing', () => {
  const svc = new StellarService(cfg);
  const { xdr } = sampleXdr();
  const { hash } = svc.hashForSigning(xdr);
  expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
});

it('hash matches the SDK transaction hash', () => {
  const svc = new StellarService(cfg);
  const { xdr } = sampleXdr();
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  const { hash } = svc.hashForSigning(xdr);
  expect(hash.slice(2)).toBe(tx.hash().toString('hex'));
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- stellar.service`
Expected: FAIL — `StellarService` not defined.

- [ ] **Step 3: Implement hashForSigning + attachAndSubmit**

`apps/api/src/stellar/stellar.service.ts`:
```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  TransactionBuilder, Keypair, Networks, xdr as StellarXdr, rpc,
} from '@stellar/stellar-sdk';
import { APP_CONFIG } from '../config/config.module';
import { Env } from '../config/env';

@Injectable()
export class StellarService {
  private readonly passphrase: string;
  constructor(@Inject(APP_CONFIG) private readonly cfg: Env) {
    this.passphrase = cfg.stellarNetwork === 'public' ? Networks.PUBLIC : Networks.TESTNET;
  }

  hashForSigning(xdr: string): { hash: string } {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    return { hash: '0x' + tx.hash().toString('hex') };
  }

  async attachAndSubmit(xdr: string, stellarAddress: string, signatureHex: string): Promise<{ txHash: string }> {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    const kp = Keypair.fromPublicKey(stellarAddress);
    const sig = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');
    const decorated = new StellarXdr.DecoratedSignature({ hint: kp.signatureHint(), signature: sig });
    tx.signatures.push(decorated);

    const server = new rpc.Server(this.cfg.sorobanRpcUrl);
    const sent = await server.sendTransaction(tx);
    if (sent.status === 'ERROR') throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
    return { txHash: sent.hash };
  }
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- stellar.service`
Expected: PASS.

> **Verification note:** `attachAndSubmit` is exercised end-to-end by Task 9's integration test against testnet. The exact submit/polling API (`rpc.Server.sendTransaction` then `getTransaction` polling for Soroban) is pinned there. If the DeFindex XDR requires `server.prepareTransaction` before submit, add it inside `attachAndSubmit` and re-run the integration test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: stellar service - hash for signing + attach sig + submit"
```

---

## Task 9: Deposit orchestration (build + submit)

**Files:**
- Create: `apps/api/src/deposit/deposit.service.ts`, `deposit.controller.ts`, `deposit.module.ts`
- Test: `apps/api/src/deposit/deposit.service.spec.ts`
- Test (integration, opt-in): `apps/api/test/deposit.integration-spec.ts`

**Interfaces:**
- Consumes: `VaultService`, `StellarService`, `LedgerService`, `WalletService`, `AuthGuard`.
- Produces:
  - `DepositService.build(companyId: string, amount: bigint): Promise<BuildTxResponse>` — `{ xdr, hash }`.
  - `DepositService.submit(companyId: string, dto: SubmitTxDto): Promise<{ txHash: string }>` — attaches sig, submits, records the deposit.
  - `POST /deposit/build` body `{ amount: string }` → `{ xdr, hash }`.
  - `POST /deposit/submit` body `SubmitTxDto` → `{ txHash }`.

- [ ] **Step 1: Write failing DepositService test**

`apps/api/src/deposit/deposit.service.spec.ts`:
```typescript
import { DepositService } from './deposit.service';

it('build: gets address, builds vault xdr, returns hash', async () => {
  const wallet = { getAddress: jest.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: jest.fn().mockResolvedValue({ xdr: 'XDR1' }) };
  const stellar = { hashForSigning: jest.fn().mockReturnValue({ hash: '0xabc' }) };
  const ledger = { recordDeposit: jest.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);
  const r = await svc.build('co_1', 1000000n);
  expect(vault.buildDeposit).toHaveBeenCalledWith('GADDR', 1000000n);
  expect(r).toEqual({ xdr: 'XDR1', hash: '0xabc' });
});

it('submit: attaches sig, submits, records deposit', async () => {
  const wallet = {};
  const vault = {};
  const stellar = { attachAndSubmit: jest.fn().mockResolvedValue({ txHash: 'TX9' }) };
  const ledger = { recordDeposit: jest.fn().mockResolvedValue(undefined) };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);
  const r = await svc.submit('co_1', { xdr: 'X', signatureHex: '0xsig', stellarAddress: 'GADDR', amount: '1000000' });
  expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xsig');
  expect(ledger.recordDeposit).toHaveBeenCalledWith('co_1', 1000000n, 'TX9');
  expect(r).toEqual({ txHash: 'TX9' });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- deposit.service`
Expected: FAIL — `DepositService` not defined.

- [ ] **Step 3: Implement DepositService + controller**

`apps/api/src/deposit/deposit.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { BuildTxResponse, SubmitTxDto } from '@fixearn/shared';

@Injectable()
export class DepositService {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
  ) {}

  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    const address = await this.wallet.getAddress(companyId);
    const { xdr } = await this.vault.buildDeposit(address, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async submit(companyId: string, dto: SubmitTxDto): Promise<{ txHash: string }> {
    const { txHash } = await this.stellar.attachAndSubmit(dto.xdr, dto.stellarAddress, dto.signatureHex);
    await this.ledger.recordDeposit(companyId, BigInt(dto.amount), txHash);
    return { txHash };
  }
}
```
`apps/api/src/deposit/deposit.controller.ts`:
```typescript
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DepositService } from './deposit.service';
import { SubmitTxDto } from '@fixearn/shared';

@Controller('deposit')
@UseGuards(AuthGuard)
export class DepositController {
  constructor(private readonly deposits: DepositService) {}
  @Post('build')
  build(@Req() req: any, @Body() body: { amount: string }) {
    return this.deposits.build(req.companyId, BigInt(body.amount));
  }
  @Post('submit')
  submit(@Req() req: any, @Body() body: SubmitTxDto) {
    return this.deposits.submit(req.companyId, body);
  }
}
```
Wire `DepositModule`.

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- deposit.service`
Expected: PASS.

- [ ] **Step 5: Write the opt-in full-flow integration test**

`apps/api/test/deposit.integration-spec.ts` (guarded by `RUN_INTEGRATION === '1'`): using a funded testnet keypair as a stand-in for the Privy wallet, call `build`, sign the returned hash locally with `Keypair.sign(hashBytes)`, call `submit`, then assert `getPositionValue` reflects the deposit. This pins `attachAndSubmit` (and any required `prepareTransaction`) and the shares→underlying conversion together.

Run: `RUN_INTEGRATION=1 pnpm --filter @fixearn/api test -- deposit.integration`
Expected: PASS — deposit lands in the vault on testnet.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: deposit orchestration (build + submit) with testnet integration"
```

---

## Task 10: Withdraw orchestration (principal stays withdrawable)

**Files:**
- Create: `apps/api/src/withdraw/withdraw.service.ts`, `withdraw.controller.ts`, `withdraw.module.ts`
- Test: `apps/api/src/withdraw/withdraw.service.spec.ts`

**Interfaces:**
- Consumes: `VaultService`, `StellarService`, `WalletService`, `AuthGuard`.
- Produces:
  - `WithdrawService.build(companyId: string, amount: bigint): Promise<BuildTxResponse>`.
  - `WithdrawService.submit(companyId: string, dto: SubmitTxDto): Promise<{ txHash: string }>` — submits; does NOT alter recorded principal (withdrawals reduce on-chain value, principal is the deposit ledger; MVP shows withdrawals via vault reads).
  - `POST /withdraw/build`, `POST /withdraw/submit`.

- [ ] **Step 1: Write failing WithdrawService test**

`apps/api/src/withdraw/withdraw.service.spec.ts`:
```typescript
import { WithdrawService } from './withdraw.service';

it('build: builds withdraw xdr for the company wallet', async () => {
  const wallet = { getAddress: jest.fn().mockResolvedValue('GADDR') };
  const vault = { buildWithdraw: jest.fn().mockResolvedValue({ xdr: 'WXDR' }) };
  const stellar = { hashForSigning: jest.fn().mockReturnValue({ hash: '0xdef' }) };
  const svc = new WithdrawService(vault as any, stellar as any, wallet as any);
  const r = await svc.build('co_1', 250000n);
  expect(vault.buildWithdraw).toHaveBeenCalledWith('GADDR', 250000n);
  expect(r).toEqual({ xdr: 'WXDR', hash: '0xdef' });
});

it('submit: attaches sig and submits', async () => {
  const stellar = { attachAndSubmit: jest.fn().mockResolvedValue({ txHash: 'TXW' }) };
  const svc = new WithdrawService({} as any, stellar as any, {} as any);
  const r = await svc.submit('co_1', { xdr: 'X', signatureHex: '0xs', stellarAddress: 'GADDR', amount: '250000' });
  expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xs');
  expect(r).toEqual({ txHash: 'TXW' });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- withdraw.service`
Expected: FAIL — `WithdrawService` not defined.

- [ ] **Step 3: Implement WithdrawService + controller**

`apps/api/src/withdraw/withdraw.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { WalletService } from '../wallet/wallet.service';
import { BuildTxResponse, SubmitTxDto } from '@fixearn/shared';

@Injectable()
export class WithdrawService {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
    private readonly wallet: WalletService,
  ) {}

  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    const address = await this.wallet.getAddress(companyId);
    const { xdr } = await this.vault.buildWithdraw(address, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async submit(_companyId: string, dto: SubmitTxDto): Promise<{ txHash: string }> {
    return this.stellar.attachAndSubmit(dto.xdr, dto.stellarAddress, dto.signatureHex);
  }
}
```
Controller mirrors `DepositController` at `/withdraw`. Wire `WithdrawModule`.

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- withdraw.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: withdraw orchestration (build + submit)"
```

---

## Task 11: Bills CRUD (generic recurring bills, software-first)

**Files:**
- Create: `apps/api/src/bills/bills.service.ts`, `bills.controller.ts`, `bills.module.ts`
- Test: `apps/api/src/bills/bills.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `AuthGuard`.
- Produces:
  - `BillsService.create(companyId, dto: CreateBillDto): Promise<{ id: string }>`.
  - `BillsService.list(companyId): Promise<RecurringBill[]>`.
  - `BillsService.remove(companyId, id): Promise<void>` (scoped to company).
  - `POST /bills`, `GET /bills`, `DELETE /bills/:id`.

- [ ] **Step 1: Write failing BillsService test**

`apps/api/src/bills/bills.service.spec.ts`:
```typescript
import { BillsService } from './bills.service';

it('creates a bill with type defaulting handled by caller', async () => {
  const prisma = { recurringBill: { create: jest.fn().mockResolvedValue({ id: 'b1' }) } } as any;
  const svc = new BillsService(prisma);
  const r = await svc.create('co_1', { vendor: 'OpenAI', monthlyCost: '200000', type: 'software' });
  expect(prisma.recurringBill.create).toHaveBeenCalledWith({
    data: { companyId: 'co_1', vendor: 'OpenAI', monthlyCost: 200000n, type: 'software' },
  });
  expect(r.id).toBe('b1');
});

it('lists only the company bills', async () => {
  const prisma = { recurringBill: { findMany: jest.fn().mockResolvedValue([{ id: 'b1' }]) } } as any;
  const svc = new BillsService(prisma);
  const r = await svc.list('co_1');
  expect(prisma.recurringBill.findMany).toHaveBeenCalledWith({ where: { companyId: 'co_1' } });
  expect(r).toHaveLength(1);
});

it('remove is scoped to the company', async () => {
  const prisma = { recurringBill: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } } as any;
  const svc = new BillsService(prisma);
  await svc.remove('co_1', 'b1');
  expect(prisma.recurringBill.deleteMany).toHaveBeenCalledWith({ where: { id: 'b1', companyId: 'co_1' } });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- bills.service`
Expected: FAIL — `BillsService` not defined.

- [ ] **Step 3: Implement BillsService + controller**

`apps/api/src/bills/bills.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillDto } from '@fixearn/shared';

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateBillDto) {
    return this.prisma.recurringBill.create({
      data: { companyId, vendor: dto.vendor, monthlyCost: BigInt(dto.monthlyCost), type: dto.type },
    });
  }
  list(companyId: string) {
    return this.prisma.recurringBill.findMany({ where: { companyId } });
  }
  async remove(companyId: string, id: string): Promise<void> {
    await this.prisma.recurringBill.deleteMany({ where: { id, companyId } });
  }
}
```
Controller exposes `POST /bills`, `GET /bills`, `DELETE /bills/:id`, all `@UseGuards(AuthGuard)`, reading `req.companyId`. Wire `BillsModule`.

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- bills.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: recurring bills CRUD (generic type, software-first)"
```

---

## Task 12: Dashboard read endpoint (spendable + APY)

**Files:**
- Create: `apps/api/src/ledger/ledger.controller.ts`
- Modify: `apps/api/src/ledger/ledger.module.ts` (add controller, import VaultModule)
- Test: `apps/api/src/ledger/ledger.controller.spec.ts`

**Interfaces:**
- Consumes: `LedgerService`, `VaultService`, `AuthGuard`.
- Produces: `GET /dashboard` → `SpendableView` `{ vaultValue, principal, spendable, apyPercent }` (BigInts serialized as decimal strings).

- [ ] **Step 1: Write failing controller test**

`apps/api/src/ledger/ledger.controller.spec.ts`:
```typescript
import { LedgerController } from './ledger.controller';

it('returns spendable view with string-encoded bigints', async () => {
  const ledger = { computeSpendable: jest.fn().mockResolvedValue({ vaultValue: 1075000n, principal: 1000000n, spendable: 75000n }) };
  const vault = { getApyPercent: jest.fn().mockResolvedValue('7.50') };
  const ctrl = new LedgerController(ledger as any, vault as any);
  const r = await ctrl.dashboard({ companyId: 'co_1' } as any);
  expect(r).toEqual({ vaultValue: '1075000', principal: '1000000', spendable: '75000', apyPercent: '7.50' });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- ledger.controller`
Expected: FAIL — `LedgerController` not defined.

- [ ] **Step 3: Implement LedgerController**

`apps/api/src/ledger/ledger.controller.ts`:
```typescript
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LedgerService } from './ledger.service';
import { VaultService } from '../vault/vault.service';
import { SpendableView } from '@fixearn/shared';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService, private readonly vault: VaultService) {}
  @Get()
  async dashboard(@Req() req: any): Promise<SpendableView> {
    const [s, apyPercent] = await Promise.all([
      this.ledger.computeSpendable(req.companyId),
      this.vault.getApyPercent(),
    ]);
    return {
      vaultValue: s.vaultValue.toString(), principal: s.principal.toString(),
      spendable: s.spendable.toString(), apyPercent,
    };
  }
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- ledger.controller`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: dashboard endpoint (spendable + apy)"
```

---

## Task 13: Daily snapshot cron

**Files:**
- Create: `apps/api/src/jobs/snapshot.job.ts`, `jobs.module.ts`
- Test: `apps/api/src/jobs/snapshot.job.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (list companies with wallets), `LedgerService.snapshot`.
- Produces: `SnapshotJob.runOnce(): Promise<{ count: number }>` — snapshots every company that has a wallet; wired to `@Cron` daily.

- [ ] **Step 1: Add scheduler + write failing test**

Run: `pnpm --filter @fixearn/api add @nestjs/schedule`
`apps/api/src/jobs/snapshot.job.spec.ts`:
```typescript
import { SnapshotJob } from './snapshot.job';

it('snapshots every company that has a wallet', async () => {
  const prisma = { company: { findMany: jest.fn().mockResolvedValue([{ id: 'co_1' }, { id: 'co_2' }]) } } as any;
  const ledger = { snapshot: jest.fn().mockResolvedValue(undefined) } as any;
  const job = new SnapshotJob(prisma, ledger);
  const r = await job.runOnce();
  expect(prisma.company.findMany).toHaveBeenCalledWith({ where: { wallet: { isNot: null } }, select: { id: true } });
  expect(ledger.snapshot).toHaveBeenCalledTimes(2);
  expect(r.count).toBe(2);
});

it('continues past a failing company snapshot', async () => {
  const prisma = { company: { findMany: jest.fn().mockResolvedValue([{ id: 'co_1' }, { id: 'co_2' }]) } } as any;
  const ledger = { snapshot: jest.fn().mockRejectedValueOnce(new Error('rpc')).mockResolvedValue(undefined) } as any;
  const job = new SnapshotJob(prisma, ledger);
  const r = await job.runOnce();
  expect(r.count).toBe(1);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @fixearn/api test -- snapshot.job`
Expected: FAIL — `SnapshotJob` not defined.

- [ ] **Step 3: Implement SnapshotJob**

`apps/api/src/jobs/snapshot.job.ts`:
```typescript
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
```
Import `ScheduleModule.forRoot()` in `AppModule`; wire `JobsModule`.

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm --filter @fixearn/api test -- snapshot.job`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: daily yield snapshot cron"
```

---

## Out of scope (this plan)

- Fiat on-ramp (BRL→USDC) and the automatic bill-payment engine (boleto/PIX or USD virtual card) — **fase 2** per the spec.
- Frontend (Next.js) — separate plan, written next.
- Real Privy wallet provisioning UI — the client creates the wallet (`useCreateWallet`); this backend only persists the address.

---

## Self-Review

**Spec coverage:**
- Non-custodial via Privy → Tasks 4 (auth), 8 (client-signed submit). ✓
- DeFindex vault deposit/withdraw/APY → Tasks 6, 9, 10. ✓
- Spendable = current value − principal, principal untouched, unspent yield compounds (never pre-withdrawn) → Task 7 (calc), and the design keeps funds in-vault: no harvest endpoint exists. ✓
- RecurringBill generic with `type`, software-first → Tasks 3 (schema), 11 (CRUD). ✓
- Dashboard (capital, returns, spendable, APY) → Task 12. ✓
- Daily snapshot → Task 13. ✓
- Data model (Company, Wallet, Deposit, YieldSnapshot, RecurringBill) → Task 3. ✓
- Testing: unit (spendable, vault wrapper mocked) + integration (testnet deposit) → Tasks 6,7,9. ✓
- Fiat ramps deferred → Out of scope. ✓

**Open verification points (flagged inline, pinned by integration tests):**
1. `@privy-io/server-auth` `verifyAuthToken` return field (Task 4).
2. DeFindex shares→underlying USDC conversion in `getPositionValue` (Task 6, Step 5).
3. Soroban submit/prepare path in `attachAndSubmit` (Task 8 / Task 9 integration).

These are real third-party-API unknowns, not placeholders: each has a concrete best-effort implementation plus a testnet assertion that pins the truth. An implementer must run the opt-in integration tests (`RUN_INTEGRATION=1`) before considering Tasks 6/9 done.

**Type consistency:** `BuildTxResponse {xdr,hash}`, `SubmitTxDto {xdr,signatureHex,stellarAddress,amount}`, `SpendableView`, `BillType`, `CreateBillDto` are defined once in `packages/shared` and consumed identically across tasks. `getPositionValue` returns `bigint` everywhere it's consumed (Task 7, 12).
