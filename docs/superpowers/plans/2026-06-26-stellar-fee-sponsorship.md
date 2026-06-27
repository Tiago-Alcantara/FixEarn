# Stellar Fee Sponsorship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Yield2Pay platform pay all Stellar XLM fees for users — creating their account on-chain when first registered, and wrapping every deposit/withdraw in a fee bump signed by a platform sponsor account.

**Architecture:** A `sponsor` keypair (held by the platform) lives in `StellarService`. A single private `submit(tx)` helper sends + polls any signed tx. `ensureAccountFunded` uses it to `createAccount` for new users; `attachAndSubmit` uses it to send a sponsor-paid fee bump wrapping the user-signed tx.

**Tech Stack:** `@stellar/stellar-sdk` v16, NestJS DI, Vitest. Code style: single quotes, trailing commas.

> **Known gap — USDC trustline:** `ensureAccountFunded` funds the account with XLM but does NOT create a USDC trustline (a trustline needs the account owner's signature; the sponsor can't add one alone). First deposit fails with `op_no_trust` until a sponsored-reserve `changeTrust` flow is added. Out of scope here.
>
> **Known limit — concurrent registration:** Two simultaneous registrations of the same brand-new address could race on `createAccount`. Registration is idempotent client-side (`ensureWallet` checks first), so this is acceptable for MVP. Not handled.

## Global Constraints

- No commits until user requests one.
- Test runner: `pnpm --filter api test` (vitest, globals on, `src/**/*.spec.ts`).
- Code style: single quotes, trailing comma `all` (prettier).
- `FEE_SPONSOR_SECRET_KEY` is a Stellar secret (`S...`). Never log it.
- Fee bump baseFee is dynamic: `max(BASE_FEE, ceil(innerFee / (ops + 1)))`. The SDK throws if `baseFee × (ops + 1) < innerFee`; DefIndex Soroban ops can carry large resource fees, so a static value would fail.
- `STARTING_BALANCE = '2'` XLM (string, not stroops) — base reserve (1) + buffer (1).
- `fromXDR` → cast `as Transaction` (canonical stellar-sdk pattern; our build path always produces a regular Transaction).
- `StellarService` constructor takes optional `server?: rpc.Server` second arg (test backdoor); NestJS never passes it.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/config/env.ts` | Modify | Add `feeSponsorSecretKey` |
| `apps/api/.env` | Modify | Add `FEE_SPONSOR_SECRET_KEY` placeholder |
| `apps/api/src/stellar/stellar.service.ts` | Modify | Sponsor keypair; `ensureAccountFunded`; fee bump in `attachAndSubmit`; shared `submit` helper |
| `apps/api/src/stellar/stellar.service.spec.ts` | Modify | Tests for funding + fee bump |
| `apps/api/src/wallet/wallet.service.ts` | Modify | Inject `StellarService`; fund on `register` |
| `apps/api/src/wallet/wallet.service.spec.ts` | Modify | Two-arg constructor + funding test |
| `apps/api/src/wallet/wallet.module.ts` | Modify | Import `StellarModule` |

---

## Task 1: Add `feeSponsorSecretKey` to env config

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/.env`

**Interfaces:**
- Produces: `Env.feeSponsorSecretKey: string` — consumed by Task 2.

- [ ] **Step 1: Add to schema, type, and loadEnv**

In `apps/api/src/config/env.ts`: add `FEE_SPONSOR_SECRET_KEY: z.string().min(1),` to the schema (after `SOROBAN_RPC_URL`), `feeSponsorSecretKey: string;` to the `Env` type (after `sorobanRpcUrl`), and `feeSponsorSecretKey: parsed.FEE_SPONSOR_SECRET_KEY,` to the `loadEnv` return (after `sorobanRpcUrl`).

- [ ] **Step 2: Add placeholder to .env**

In `apps/api/.env`, after the `SOROBAN_RPC_URL` line, add:

```
FEE_SPONSOR_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

> Replace with a real funded secret key before running. Never commit a real key.

- [ ] **Step 3: TypeScript check**

Run: `pnpm --filter api build`
Expected: no TypeScript errors.

---

## Task 2: Fee bump + account funding in StellarService

**Files:**
- Modify: `apps/api/src/stellar/stellar.service.ts`
- Modify: `apps/api/src/stellar/stellar.service.spec.ts`

**Interfaces:**
- Consumes: `Env.feeSponsorSecretKey` from Task 1.
- Produces:
  - `StellarService.ensureAccountFunded(address: string): Promise<void>` — consumed by Task 3.
  - `StellarService.attachAndSubmit(xdr, stellarAddress, signatureHex): Promise<{ txHash: string }>` — unchanged signature, now fee-bumped.

- [ ] **Step 1: Write the failing tests**

Replace `apps/api/src/stellar/stellar.service.spec.ts` with:

```typescript
import { StellarService } from './stellar.service';
import {
  Keypair,
  TransactionBuilder,
  Transaction,
  Account,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
  rpc,
} from '@stellar/stellar-sdk';

const SPONSOR_KP = Keypair.random();
const cfg = {
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  stellarNetwork: 'testnet',
  feeSponsorSecretKey: SPONSOR_KP.secret(),
} as any;

function sampleTx(): { xdr: string; address: string; kp: Keypair } {
  const kp = Keypair.random();
  const tx = new TransactionBuilder(new Account(kp.publicKey(), '0'), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: kp.publicKey(),
        asset: Asset.native(),
        amount: '1',
      }),
    )
    .setTimeout(60)
    .build();
  return { xdr: tx.toXDR(), address: kp.publicKey(), kp };
}

// ── hashForSigning ────────────────────────────────────────────────────────────

it('returns a 0x-prefixed 32-byte hash for signing', () => {
  const { hash } = new StellarService(cfg).hashForSigning(sampleTx().xdr);
  expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
});

it('hash matches the SDK transaction hash', () => {
  const { xdr } = sampleTx();
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  expect(new StellarService(cfg).hashForSigning(xdr).hash.slice(2)).toBe(
    tx.hash().toString('hex'),
  );
});

// ── ensureAccountFunded ───────────────────────────────────────────────────────

it('does nothing when the account already exists', async () => {
  const server = {
    getAccount: vi.fn().mockResolvedValue(new Account(Keypair.random().publicKey(), '1')),
    sendTransaction: vi.fn(),
  } as unknown as rpc.Server;

  await new StellarService(cfg, server).ensureAccountFunded(Keypair.random().publicKey());
  expect(server.sendTransaction).not.toHaveBeenCalled();
});

it('submits a createAccount tx when the account is missing', async () => {
  const server = {
    getAccount: vi
      .fn()
      .mockRejectedValueOnce(new Error('Account not found')) // user: missing
      .mockResolvedValueOnce(new Account(SPONSOR_KP.publicKey(), '42')), // sponsor
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'h1' }),
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.SUCCESS }),
  } as unknown as rpc.Server;

  await new StellarService(cfg, server).ensureAccountFunded(Keypair.random().publicKey());
  expect(server.sendTransaction).toHaveBeenCalledTimes(1);
});

it('throws when the createAccount tx is not confirmed', async () => {
  const server = {
    getAccount: vi
      .fn()
      .mockRejectedValueOnce(new Error('Account not found'))
      .mockResolvedValueOnce(new Account(SPONSOR_KP.publicKey(), '42')),
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'h2' }),
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.FAILED }),
  } as unknown as rpc.Server;

  await expect(
    new StellarService(cfg, server).ensureAccountFunded(Keypair.random().publicKey()),
  ).rejects.toThrow('not confirmed');
});

// ── attachAndSubmit (fee bump) ────────────────────────────────────────────────

it('wraps the inner tx in a sponsor-signed fee bump and submits it', async () => {
  const { xdr, address, kp } = sampleTx();
  const inner = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
  inner.sign(kp);
  const signatureHex = '0x' + kp.sign(inner.hash()).toString('hex');

  const server = {
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'tx123' }),
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.SUCCESS }),
  } as unknown as rpc.Server;

  const result = await new StellarService(cfg, server).attachAndSubmit(xdr, address, signatureHex);

  expect(result).toEqual({ txHash: 'tx123' });
  const submitted = (server.sendTransaction as any).mock.calls[0][0];
  expect(submitted.toEnvelope().switch().name).toBe('envelopeTypeTxFeeBump');
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `pnpm --filter api test`
Expected: failures (`ensureAccountFunded is not a function`, constructor arity).

- [ ] **Step 3: Implement**

Replace `apps/api/src/stellar/stellar.service.ts` with:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  TransactionBuilder,
  Transaction,
  FeeBumpTransaction,
  Keypair,
  Networks,
  Operation,
  xdr as StellarXdr,
  rpc,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

const STARTING_BALANCE = '2'; // base reserve + buffer for future trustlines

@Injectable()
export class StellarService {
  private readonly passphrase: string;
  private readonly server: rpc.Server;
  private readonly sponsor: Keypair;

  constructor(@Inject(APP_CONFIG) config: Env, server?: rpc.Server) {
    this.passphrase =
      config.stellarNetwork === 'public' ? Networks.PUBLIC : Networks.TESTNET;
    this.server = server ?? new rpc.Server(config.sorobanRpcUrl);
    this.sponsor = Keypair.fromSecret(config.feeSponsorSecretKey);
  }

  hashForSigning(xdr: string): { hash: string } {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    return { hash: '0x' + tx.hash().toString('hex') };
  }

  /** Creates the account on-chain (sponsor pays) if it doesn't exist. Idempotent. */
  async ensureAccountFunded(address: string): Promise<void> {
    if (await this.exists(address)) return;
    const source = await this.server.getAccount(this.sponsor.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase,
    })
      .addOperation(
        Operation.createAccount({ destination: address, startingBalance: STARTING_BALANCE }),
      )
      .setTimeout(30)
      .build();
    tx.sign(this.sponsor);
    await this.submit(tx);
  }

  /** Attaches the user's signature, wraps in a sponsor-paid fee bump, submits. */
  async attachAndSubmit(
    xdr: string,
    stellarAddress: string,
    signatureHex: string,
  ): Promise<{ txHash: string }> {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase) as Transaction;
    const kp = Keypair.fromPublicKey(stellarAddress);
    tx.signatures.push(
      new StellarXdr.DecoratedSignature({
        hint: kp.signatureHint(),
        signature: Buffer.from(signatureHex.replace(/^0x/, ''), 'hex'),
      }),
    );
    // baseFee × (ops + 1) must cover the inner fee (Soroban resource fees are large).
    const baseFee = Math.max(
      Number(BASE_FEE),
      Math.ceil(Number(tx.fee) / (tx.operations.length + 1)),
    ).toString();
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      this.sponsor,
      baseFee,
      tx,
      this.passphrase,
    );
    feeBump.sign(this.sponsor);
    return { txHash: await this.submit(feeBump) };
  }

  private async exists(address: string): Promise<boolean> {
    try {
      await this.server.getAccount(address);
      return true;
    } catch {
      return false;
    }
  }

  /** Sends a signed tx, polls to a terminal ledger state, returns the hash. */
  private async submit(tx: Transaction | FeeBumpTransaction): Promise<string> {
    const sent = await this.server.sendTransaction(tx);
    if (sent.status === 'ERROR') {
      throw new Error(`submit rejected by RPC: ${JSON.stringify(sent.errorResult)}`);
    }
    if (sent.status === 'TRY_AGAIN_LATER') {
      throw new Error('submit throttled by RPC (TRY_AGAIN_LATER); retry later');
    }
    const final = await this.server.pollTransaction(sent.hash, { attempts: 30 });
    if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`tx ${sent.hash} not confirmed (status: ${final.status})`);
    }
    return sent.hash;
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm --filter api test`
Expected: all stellar tests pass.

---

## Task 3: Wire WalletService to fund on register

**Files:**
- Modify: `apps/api/src/wallet/wallet.service.ts`
- Modify: `apps/api/src/wallet/wallet.service.spec.ts`
- Modify: `apps/api/src/wallet/wallet.module.ts`

**Interfaces:**
- Consumes: `StellarService.ensureAccountFunded(address): Promise<void>` from Task 2.
- Produces: `WalletService.register(companyId, stellarAddress)` — same signature, now funds new accounts before persisting.

- [ ] **Step 1: Write the failing tests**

Replace `apps/api/src/wallet/wallet.service.spec.ts` with:

```typescript
import { WalletService } from './wallet.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const VALID_ADDRESS = 'GDUKN35CP3SQ67QMZL5SKCUCX6MB47TX4SZBTS5UHKFMGTF35Z3723DY';

function deps(findResult: any = null) {
  const prisma = {
    wallet: {
      upsert: vi.fn().mockResolvedValue({ stellarAddress: VALID_ADDRESS }),
      findUnique: vi.fn().mockResolvedValue(findResult),
    },
  } as any;
  const stellar = { ensureAccountFunded: vi.fn().mockResolvedValue(undefined) } as any;
  return { prisma, stellar };
}

it('funds the account then registers it', async () => {
  const { prisma, stellar } = deps();
  const r = await new WalletService(prisma, stellar).register('co_1', VALID_ADDRESS);

  expect(stellar.ensureAccountFunded).toHaveBeenCalledWith(VALID_ADDRESS);
  expect(prisma.wallet.upsert).toHaveBeenCalledWith({
    where: { companyId: 'co_1' },
    create: { companyId: 'co_1', stellarAddress: VALID_ADDRESS },
    update: { stellarAddress: VALID_ADDRESS },
  });
  expect(r.stellarAddress).toBe(VALID_ADDRESS);
});

it('rejects an invalid address without funding or persisting', async () => {
  const { prisma, stellar } = deps();
  await expect(
    new WalletService(prisma, stellar).register('co_1', 'not-a-key'),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(stellar.ensureAccountFunded).not.toHaveBeenCalled();
  expect(prisma.wallet.upsert).not.toHaveBeenCalled();
});

it('throws when the address is missing', async () => {
  const { prisma, stellar } = deps(null);
  await expect(
    new WalletService(prisma, stellar).getAddress('co_x'),
  ).rejects.toBeInstanceOf(NotFoundException);
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `pnpm --filter api test`
Expected: `WalletService` constructor arity / `ensureAccountFunded` not called.

- [ ] **Step 3: Inject StellarService and fund on register**

Replace `apps/api/src/wallet/wallet.service.ts` with:

```typescript
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
```

- [ ] **Step 4: Import StellarModule**

Replace `apps/api/src/wallet/wallet.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AuthModule } from '../auth/auth.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [AuthModule, StellarModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
```

- [ ] **Step 5: Run all tests + build**

Run: `pnpm --filter api test && pnpm --filter api build`
Expected: all tests pass, no TypeScript errors.

---

## Self-Review

### Spec coverage
| Requirement | Task |
|---|---|
| `feeSponsorSecretKey` in env | 1 |
| Account funding on registration | 2 (`ensureAccountFunded`) + 3 (wired) |
| Fee bump on deposit/withdraw | 2 (`attachAndSubmit`) |
| Tests per behavior | 2 + 3 |
| No public-signature breakage | All |

### Compactness (this revision)
- Shared private `submit(tx)` removes the duplicated send/poll/check block from both `ensureAccountFunded` and `attachAndSubmit`.
- `exists()` helper inlines the try/catch existence check.
- Sequential `register` (fund → persist) reads simpler than parallel `Promise.all` and is more correct (no DB row for an unfunded account).
- Dropped the concurrent-registration retry (documented as a known limit) — not needed for MVP.

### Type consistency
- `submit(tx: Transaction | FeeBumpTransaction): Promise<string>` — used by both callers. ✓
- `WalletService(prisma, stellar)` — two-arg constructor, matches tests. ✓
- `baseFee = max(BASE_FEE, ceil(fee / (ops + 1)))` — satisfies `buildFeeBumpTransaction`. ✓
- `STARTING_BALANCE = '2'` — XLM string for `Operation.createAccount`. ✓
