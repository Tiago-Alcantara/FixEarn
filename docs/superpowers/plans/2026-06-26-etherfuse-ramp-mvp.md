# Etherfuse On/Off-Ramp (BRL↔USDC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ramp` module to the API that lets a company on-ramp BRL→USDC (PIX) into its Stellar wallet with auto-deposit into the Defindex vault, and off-ramp USDC→BRL (PIX) out of the vault, via the Etherfuse Ramp API.

**Architecture:** A dedicated `apps/api/src/ramp/` Nest module. A pure `EtherfuseClient` (HTTP) + typed `EtherfuseService` wrap the Etherfuse REST API. `RampService` orchestrates flows, reusing `WalletService`, `StellarService`, `VaultService`, `DepositService`, `WithdrawService`, `LedgerService`. A public webhook controller verifies `X-Signature` and drives a `RampOrder` state machine. The company's existing Privy Stellar wallet (BYO, G-address) is the ramp destination; the front signs claim/burn XDRs which the backend submits via the existing sponsor fee-bump.

**Tech Stack:** NestJS 11, Prisma 7 (Postgres), `@stellar/stellar-sdk`, `@defindex/sdk`, Vitest, zod. New dep: `canonicalize` (RFC 8785 JCS for webhook verification).

**Design spec:** `docs/superpowers/specs/2026-06-26-etherfuse-ramp-design.md` (read it first — this plan implements it).

## Global Constraints

- **Etherfuse auth header:** `Authorization: <api_key>` — **NO `Bearer` prefix** (Bearer = the #1 cause of 401).
- **Base URL by env:** sandbox `https://api.sand.etherfuse.com`, production `https://api.etherfuse.com`. Read from `ETHERFUSE_BASE_URL`.
- **Money:** internal values are `BigInt` base units. USDC on Stellar = **7 decimals**; BRL fiat = **2 decimals (centavos)**. Convert to/from decimal strings only at the Etherfuse boundary.
- **Idempotency:** `orderId`, `quoteId`, `walletId`, `bankAccount.transactionId` are UUIDs **we** generate and reuse on retry; each unique in DB.
- **Stellar XDRs from Etherfuse (claim/burn) expire in ~1–2 min** → regenerate via `POST /ramp/order/{id}/regenerate_tx`.
- **Bind every order to `req.companyId`** from `AuthGuard`; never trust an id from the client body.
- **Tests:** Vitest with global `vi`/`it`/`expect` (see existing `*.spec.ts`). Unit tests mock all collaborators; no network.
- **Commits:** the project rule (CLAUDE.md) forbids auto-commits — the per-task "Commit" steps are for the human/executor to run when they choose. Do not commit unless the user asks. No `Co-Authored-By` trailer.
- **Status enum (Etherfuse-aligned):** `CREATED → FUNDED → COMPLETED → FINALIZED`, plus `FAILED`/`CANCELLED`.

---

## File Structure

```
apps/api/src/ramp/
  etherfuse.client.ts          # pure HTTP client (auth, base url, idempotency)
  etherfuse.client.spec.ts
  etherfuse.service.ts         # typed wrappers over the client
  etherfuse.service.spec.ts
  etherfuse.signature.ts       # X-Signature HMAC verification (RFC 8785)
  etherfuse.signature.spec.ts
  ramp.state.ts                # RampStatus transition machine
  ramp.state.spec.ts
  ramp.money.ts                # baseUnits <-> decimal string
  ramp.money.spec.ts
  ramp.service.ts              # orchestration (onboarding, on-ramp, off-ramp)
  ramp.service.spec.ts
  ramp.controller.ts           # authenticated routes
  ramp.webhook.controller.ts   # public webhook (signature-verified)
  ramp.webhook.controller.spec.ts
  ramp.module.ts
apps/api/src/stellar/stellar.service.ts   # MODIFY: add hasTrustline/buildAddTrustline
apps/api/src/config/env.ts                # MODIFY: ETHERFUSE_* fields
apps/api/.env.example                     # MODIFY
apps/api/prisma/schema.prisma             # MODIFY: RampOrder + Company fields + enums
packages/shared/src/index.ts              # MODIFY: ramp DTOs
apps/api/src/app.module.ts                # MODIFY: import RampModule
```

---

## Task 1: Etherfuse env config

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/.env.example`
- Test: `apps/api/src/config/env.spec.ts` (existing — extend)

**Interfaces:**
- Produces: `Env` gains `etherfuseApiKey: string`, `etherfuseBaseUrl: string`, `etherfuseWebhookSecret: string`, `rampFiatCurrency: string`, `rampRedirectUrl: string`.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/config/env.spec.ts`:

```ts
it('loads etherfuse + ramp config', () => {
  const env = loadEnv({
    ...validBaseEnv, // existing helper/object used by the other tests
    ETHERFUSE_API_KEY: 'api_sand:k1:org1',
    ETHERFUSE_BASE_URL: 'https://api.sand.etherfuse.com',
    ETHERFUSE_WEBHOOK_SECRET: 'c2VjcmV0', // base64
    RAMP_FIAT_CURRENCY: 'BRL',
    RAMP_REDIRECT_URL: 'https://app.example.com/ramp/done',
  });
  expect(env.etherfuseApiKey).toBe('api_sand:k1:org1');
  expect(env.etherfuseBaseUrl).toBe('https://api.sand.etherfuse.com');
  expect(env.etherfuseWebhookSecret).toBe('c2VjcmV0');
  expect(env.rampFiatCurrency).toBe('BRL');
  expect(env.rampRedirectUrl).toBe('https://app.example.com/ramp/done');
});
```

> If `env.spec.ts` has no shared `validBaseEnv`, copy the full valid env object from the existing passing test in that file and add the five keys above.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/config/env.spec.ts`
Expected: FAIL — `etherfuseApiKey` undefined / zod parse error for unknown-but-required keys.

- [ ] **Step 3: Add fields to the schema and mapping**

In `apps/api/src/config/env.ts`, add to the zod `schema` object:

```ts
  ETHERFUSE_API_KEY: z.string().min(1),
  ETHERFUSE_BASE_URL: z.string().url(),
  ETHERFUSE_WEBHOOK_SECRET: z.string().min(1),
  RAMP_FIAT_CURRENCY: z.string().min(1).default('BRL'),
  RAMP_REDIRECT_URL: z.string().url(),
```

Add to the `Env` type:

```ts
  etherfuseApiKey: string;
  etherfuseBaseUrl: string;
  etherfuseWebhookSecret: string;
  rampFiatCurrency: string;
  rampRedirectUrl: string;
```

Add to the returned object in `loadEnv`:

```ts
    etherfuseApiKey: parsed.ETHERFUSE_API_KEY,
    etherfuseBaseUrl: parsed.ETHERFUSE_BASE_URL,
    etherfuseWebhookSecret: parsed.ETHERFUSE_WEBHOOK_SECRET,
    rampFiatCurrency: parsed.RAMP_FIAT_CURRENCY,
    rampRedirectUrl: parsed.RAMP_REDIRECT_URL,
```

- [ ] **Step 4: Update `.env.example`**

Append to `apps/api/.env.example`:

```
ETHERFUSE_API_KEY=api_sand:key_id:org_id
ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com
ETHERFUSE_WEBHOOK_SECRET=base64_secret_from_webhook_creation
RAMP_FIAT_CURRENCY=BRL
RAMP_REDIRECT_URL=http://localhost:3000/ramp/done
```

> Any other test that calls `loadEnv` with a full env now needs these keys. Grep `loadEnv(` in tests and add the five keys to each fixture, or extend the shared fixture.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/config/env.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/src/config/env.spec.ts apps/api/.env.example
git commit -m "feat(ramp): add etherfuse env config"
```

---

## Task 2: Prisma model — RampOrder + Company fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- (migration generated)

**Interfaces:**
- Produces: Prisma models `RampOrder`, enums `RampDirection`, `RampStatus`, `KycStatus`; `Company.etherfuseCustomerId`, `Company.etherfuseWalletId`, `Company.etherfuseBankAccountId`, `Company.kycStatus`.

- [ ] **Step 1: Add enums to `schema.prisma`**

After the existing `enum BillType { ... }` block:

```prisma
enum KycStatus {
  NONE
  PENDING
  APPROVED
  REJECTED
}

enum RampDirection {
  ONRAMP
  OFFRAMP
}

enum RampStatus {
  CREATED
  FUNDED
  COMPLETED
  FINALIZED
  FAILED
  CANCELLED
}
```

- [ ] **Step 2: Add fields to `Company`**

Inside `model Company { ... }`, add before the relations:

```prisma
  etherfuseCustomerId    String?   @unique @map("etherfuse_customer_id")
  etherfuseWalletId      String?   @map("etherfuse_wallet_id")
  etherfuseBankAccountId String?   @map("etherfuse_bank_account_id")
  kycStatus              KycStatus @default(NONE) @map("kyc_status")
```

And add to its relation list:

```prisma
  rampOrders RampOrder[]
```

- [ ] **Step 3: Add the `RampOrder` model**

```prisma
model RampOrder {
  id                 String        @id @default(cuid())
  companyId          String        @map("company_id")
  /// orderId we generate (UUID) — also the Etherfuse idempotency key
  etherfuseOrderId   String        @unique @map("etherfuse_order_id")
  direction          RampDirection
  status             RampStatus     @default(CREATED)
  fiatCurrency       String         @map("fiat_currency")
  /// fiat in base units (centavos)
  fiatAmount         BigInt         @map("fiat_amount")
  /// USDC in base units (7 decimals)
  tokenAmount        BigInt         @map("token_amount")
  token              String         @default("USDC")
  chain              String         @default("stellar")
  claimableBalanceId String?        @map("claimable_balance_id")
  stellarTxHash      String?        @map("stellar_tx_hash")
  autoDeposited      Boolean        @default(false) @map("auto_deposited")
  createdAt          DateTime       @default(now()) @map("created_at")
  updatedAt          DateTime       @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id])

  @@index([companyId, createdAt])
  @@map("ramp_orders")
}
```

- [ ] **Step 4: Generate the migration and client**

Run: `cd apps/api && npx prisma migrate dev --name ramp_orders`
Expected: migration created under `prisma/migrations/`, client regenerated, no errors.

- [ ] **Step 5: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS (new Prisma types available).

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(ramp): RampOrder model + company ramp fields"
```

---

## Task 3: Money conversion helper

**Files:**
- Create: `apps/api/src/ramp/ramp.money.ts`
- Test: `apps/api/src/ramp/ramp.money.spec.ts`

**Interfaces:**
- Produces:
  - `baseUnitsToDecimal(value: bigint, decimals: number): string`
  - `decimalToBaseUnits(value: string, decimals: number): bigint`
  - constants `USDC_DECIMALS = 7`, `BRL_DECIMALS = 2`

- [ ] **Step 1: Write the failing test**

```ts
import { baseUnitsToDecimal, decimalToBaseUnits, USDC_DECIMALS, BRL_DECIMALS } from './ramp.money';

it('USDC base units -> decimal string', () => {
  expect(baseUnitsToDecimal(12345678n, USDC_DECIMALS)).toBe('1.2345678');
  expect(baseUnitsToDecimal(10000000n, USDC_DECIMALS)).toBe('1');
  expect(baseUnitsToDecimal(0n, USDC_DECIMALS)).toBe('0');
});

it('BRL centavos -> decimal string', () => {
  expect(baseUnitsToDecimal(10050n, BRL_DECIMALS)).toBe('100.5');
  expect(baseUnitsToDecimal(100n, BRL_DECIMALS)).toBe('1');
});

it('decimal string -> base units (round trip)', () => {
  expect(decimalToBaseUnits('1.2345678', USDC_DECIMALS)).toBe(12345678n);
  expect(decimalToBaseUnits('100.5', BRL_DECIMALS)).toBe(10050n);
  expect(decimalToBaseUnits('1', USDC_DECIMALS)).toBe(10000000n);
});

it('rejects more fractional digits than decimals', () => {
  expect(() => decimalToBaseUnits('1.23456789', USDC_DECIMALS)).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/ramp.money.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export const USDC_DECIMALS = 7;
export const BRL_DECIMALS = 2;

export function baseUnitsToDecimal(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  let out = whole.toString();
  if (frac > 0n) {
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    out += '.' + fracStr;
  }
  return negative ? '-' + out : out;
}

export function decimalToBaseUnits(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`invalid decimal amount: ${value}`);
  }
  const [whole, frac = ''] = value.split('.');
  if (frac.length > decimals) {
    throw new Error(`too many fractional digits for ${decimals} decimals: ${value}`);
  }
  const padded = frac.padEnd(decimals, '0');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/ramp.money.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/ramp.money.ts apps/api/src/ramp/ramp.money.spec.ts
git commit -m "feat(ramp): base-units <-> decimal money helper"
```

---

## Task 4: RampStatus state machine

**Files:**
- Create: `apps/api/src/ramp/ramp.state.ts`
- Test: `apps/api/src/ramp/ramp.state.spec.ts`

**Interfaces:**
- Produces:
  - type `RampStatus = 'CREATED'|'FUNDED'|'COMPLETED'|'FINALIZED'|'FAILED'|'CANCELLED'`
  - `canTransition(from: RampStatus, to: RampStatus): boolean`
  - `mapEtherfuseStatus(raw: string): RampStatus` — maps Etherfuse order status strings (`created`,`funded`,`completed`,`finalized`,`failed`,`cancelled`) to our enum.

- [ ] **Step 1: Write the failing test**

```ts
import { canTransition, mapEtherfuseStatus } from './ramp.state';

it('allows forward progression', () => {
  expect(canTransition('CREATED', 'FUNDED')).toBe(true);
  expect(canTransition('FUNDED', 'COMPLETED')).toBe(true);
  expect(canTransition('COMPLETED', 'FINALIZED')).toBe(true);
});

it('allows failure/cancel from any non-terminal', () => {
  expect(canTransition('CREATED', 'FAILED')).toBe(true);
  expect(canTransition('FUNDED', 'CANCELLED')).toBe(true);
});

it('rejects regression and terminal exits', () => {
  expect(canTransition('FUNDED', 'CREATED')).toBe(false);
  expect(canTransition('FINALIZED', 'COMPLETED')).toBe(false);
  expect(canTransition('FAILED', 'FUNDED')).toBe(false);
});

it('maps etherfuse status strings', () => {
  expect(mapEtherfuseStatus('created')).toBe('CREATED');
  expect(mapEtherfuseStatus('funded')).toBe('FUNDED');
  expect(mapEtherfuseStatus('completed')).toBe('COMPLETED');
  expect(mapEtherfuseStatus('finalized')).toBe('FINALIZED');
  expect(mapEtherfuseStatus('failed')).toBe('FAILED');
  expect(mapEtherfuseStatus('cancelled')).toBe('CANCELLED');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/ramp.state.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export type RampStatus =
  | 'CREATED' | 'FUNDED' | 'COMPLETED' | 'FINALIZED' | 'FAILED' | 'CANCELLED';

const ORDER: Record<RampStatus, number> = {
  CREATED: 0, FUNDED: 1, COMPLETED: 2, FINALIZED: 3, FAILED: 99, CANCELLED: 99,
};
const TERMINAL = new Set<RampStatus>(['FINALIZED', 'FAILED', 'CANCELLED']);

export function canTransition(from: RampStatus, to: RampStatus): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  if (to === 'FAILED' || to === 'CANCELLED') return true;
  return ORDER[to] > ORDER[from];
}

export function mapEtherfuseStatus(raw: string): RampStatus {
  const m: Record<string, RampStatus> = {
    created: 'CREATED', funded: 'FUNDED', completed: 'COMPLETED',
    finalized: 'FINALIZED', failed: 'FAILED', cancelled: 'CANCELLED',
    canceled: 'CANCELLED',
  };
  const v = m[raw.toLowerCase()];
  if (!v) throw new Error(`unknown etherfuse status: ${raw}`);
  return v;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/ramp.state.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/ramp.state.ts apps/api/src/ramp/ramp.state.spec.ts
git commit -m "feat(ramp): RampStatus state machine"
```

---

## Task 5: Webhook signature verification

**Files:**
- Create: `apps/api/src/ramp/etherfuse.signature.ts`
- Test: `apps/api/src/ramp/etherfuse.signature.spec.ts`
- Modify: `apps/api/package.json` (add `canonicalize`)

**Interfaces:**
- Produces: `verifyEtherfuseSignature(body: unknown, base64Secret: string, signatureHeader: string): boolean`

- [ ] **Step 1: Add the dependency**

Run: `cd apps/api && npm install canonicalize`
Expected: `canonicalize` added to `package.json`.

- [ ] **Step 2: Write the failing test**

```ts
import { createHmac } from 'crypto';
import canonicalize from 'canonicalize';
import { verifyEtherfuseSignature } from './etherfuse.signature';

const secretB64 = Buffer.from('super-secret-key').toString('base64');

function sign(body: unknown): string {
  const canonical = canonicalize(body) as string;
  const key = Buffer.from(secretB64, 'base64');
  const hex = createHmac('sha256', key).update(canonical).digest('hex');
  return `sha256=${hex}`;
}

it('accepts a valid signature', () => {
  const body = { event: 'order_updated', data: { orderId: 'o1', status: 'funded' } };
  expect(verifyEtherfuseSignature(body, secretB64, sign(body))).toBe(true);
});

it('rejects a tampered body', () => {
  const body = { event: 'order_updated', data: { orderId: 'o1', status: 'funded' } };
  const sig = sign(body);
  const tampered = { ...body, data: { ...body.data, status: 'completed' } };
  expect(verifyEtherfuseSignature(tampered, secretB64, sig)).toBe(false);
});

it('rejects a malformed header', () => {
  const body = { a: 1 };
  expect(verifyEtherfuseSignature(body, secretB64, 'garbage')).toBe(false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/etherfuse.signature.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
import { createHmac, timingSafeEqual } from 'crypto';
import canonicalize from 'canonicalize';

export function verifyEtherfuseSignature(
  body: unknown,
  base64Secret: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;
  const canonical = canonicalize(body);
  if (canonical === undefined) return false;
  const key = Buffer.from(base64Secret, 'base64');
  const hex = createHmac('sha256', key).update(canonical).digest('hex');
  const expected = `sha256=${hex}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/etherfuse.signature.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ramp/etherfuse.signature.ts apps/api/src/ramp/etherfuse.signature.spec.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(ramp): verify etherfuse webhook X-Signature (RFC 8785 HMAC)"
```

---

## Task 6: EtherfuseClient (pure HTTP)

**Files:**
- Create: `apps/api/src/ramp/etherfuse.client.ts`
- Test: `apps/api/src/ramp/etherfuse.client.spec.ts`

**Interfaces:**
- Consumes: `Env` (`etherfuseApiKey`, `etherfuseBaseUrl`).
- Produces:
  - `class EtherfuseClient` with `constructor(opts: { apiKey: string; baseUrl: string; fetchFn?: typeof fetch })`
  - `request<T>(method: string, path: string, body?: unknown): Promise<T>`
  - token `ETHERFUSE_CLIENT = 'ETHERFUSE_CLIENT'`

- [ ] **Step 1: Write the failing test**

```ts
import { EtherfuseClient } from './etherfuse.client';

function fakeFetch(captured: any[]) {
  return vi.fn(async (url: string, init: any) => {
    captured.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      text: async () => '{"ok":true}',
    } as any;
  });
}

it('sends Authorization without Bearer and JSON body', async () => {
  const captured: any[] = [];
  const client = new EtherfuseClient({
    apiKey: 'api_sand:k:o',
    baseUrl: 'https://api.sand.etherfuse.com',
    fetchFn: fakeFetch(captured),
  });
  const res = await client.request('POST', '/ramp/quote', { a: 1 });
  expect(res).toEqual({ ok: true });
  expect(captured[0].url).toBe('https://api.sand.etherfuse.com/ramp/quote');
  expect(captured[0].init.headers['Authorization']).toBe('api_sand:k:o');
  expect(captured[0].init.headers['Authorization']).not.toContain('Bearer');
  expect(captured[0].init.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(captured[0].init.body)).toEqual({ a: 1 });
});

it('throws with status + body on non-2xx', async () => {
  const fetchFn = vi.fn(async () => ({
    ok: false, status: 422,
    json: async () => ({ error: 'bad' }),
    text: async () => '{"error":"bad"}',
  })) as any;
  const client = new EtherfuseClient({
    apiKey: 'k', baseUrl: 'https://api.sand.etherfuse.com', fetchFn,
  });
  await expect(client.request('GET', '/ramp/me')).rejects.toThrow(/422/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/etherfuse.client.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export const ETHERFUSE_CLIENT = 'ETHERFUSE_CLIENT';

export interface EtherfuseClientOptions {
  apiKey: string;
  baseUrl: string;
  fetchFn?: typeof fetch;
}

export class EtherfuseClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: EtherfuseClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers: {
        // NO Bearer prefix — raw API key.
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Etherfuse ${method} ${path} failed: ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/etherfuse.client.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/etherfuse.client.ts apps/api/src/ramp/etherfuse.client.spec.ts
git commit -m "feat(ramp): EtherfuseClient HTTP (no Bearer, JSON, error detail)"
```

---

## Task 7: EtherfuseService (typed wrappers)

**Files:**
- Create: `apps/api/src/ramp/etherfuse.service.ts`
- Test: `apps/api/src/ramp/etherfuse.service.spec.ts`

**Interfaces:**
- Consumes: `EtherfuseClient.request`.
- Produces `class EtherfuseService` with methods (all take a caller-generated UUID where noted):
  - `registerWallet(p: { walletId: string; publicKey: string }): Promise<{ walletId: string }>`
  - `createOnboardingUrl(p: { customerId: string; redirectUrl: string }): Promise<{ url: string }>`
  - `getQuote(p: QuoteParams): Promise<QuoteResponse>`
  - `createOrder(p: CreateOrderParams): Promise<OrderResponse>`
  - `getOrder(orderId: string): Promise<OrderResponse>`
  - `regenerateTx(orderId: string): Promise<OrderResponse>`
  - `cancelOrder(orderId: string): Promise<void>`
  - `listAssets(blockchain: string): Promise<Array<{ identifier: string; symbol: string }>>`

  Types:
  ```ts
  export interface QuoteParams {
    quoteId: string; customerId: string; blockchain: string;
    quoteAssets: { type: 'onramp' | 'offramp'; sourceAsset: string; targetAsset: string };
    sourceAmount: string; walletAddress?: string;
  }
  export interface QuoteResponse {
    quoteId: string; targetAmount: string; feeBps: number; feeAmount?: string;
  }
  export interface CreateOrderParams {
    orderId: string; quoteId: string; bankAccountId: string; publicKey: string;
  }
  export interface OrderResponse {
    onramp?: { orderId: string; depositAmount?: string; depositClabe?: string;
      depositPixKey?: string; depositPixQr?: string };
    offramp?: { orderId: string; burnTransaction?: string;
      withdrawAnchorAccount?: string; withdrawMemo?: string };
    orderId?: string; status?: string;
    stellarClaimableBalanceId?: string; stellarClaimTransaction?: string;
  }
  ```

> The on-ramp deposit-side fields for BRL/PIX are not fully confirmed in the docs (spec §15.1); `depositPixKey`/`depositPixQr` are best-effort optional fields. Adjust to the real sandbox response when running Task 13.

- [ ] **Step 1: Write the failing test**

```ts
import { EtherfuseService } from './etherfuse.service';

function clientStub(returns: any) {
  return { request: vi.fn().mockResolvedValue(returns) } as any;
}

it('getQuote posts to /ramp/quote with quoteAssets', async () => {
  const client = clientStub({ quoteId: 'q1', targetAmount: '0.98', feeBps: 20 });
  const svc = new EtherfuseService(client);
  const r = await svc.getQuote({
    quoteId: 'q1', customerId: 'c1', blockchain: 'stellar',
    quoteAssets: { type: 'onramp', sourceAsset: 'BRL', targetAsset: 'USDC:GISSUER' },
    sourceAmount: '100', walletAddress: 'GADDR',
  });
  expect(client.request).toHaveBeenCalledWith('POST', '/ramp/quote', expect.objectContaining({
    quoteId: 'q1', blockchain: 'stellar',
    quoteAssets: { type: 'onramp', sourceAsset: 'BRL', targetAsset: 'USDC:GISSUER' },
    walletAddress: 'GADDR',
  }));
  expect(r.targetAmount).toBe('0.98');
});

it('createOrder posts to /ramp/order with publicKey', async () => {
  const client = clientStub({ onramp: { orderId: 'o1' } });
  const svc = new EtherfuseService(client);
  await svc.createOrder({ orderId: 'o1', quoteId: 'q1', bankAccountId: 'b1', publicKey: 'GADDR' });
  expect(client.request).toHaveBeenCalledWith('POST', '/ramp/order',
    { orderId: 'o1', quoteId: 'q1', bankAccountId: 'b1', publicKey: 'GADDR' });
});

it('registerWallet posts stellar BYO wallet with claimOwnership', async () => {
  const client = clientStub({ walletId: 'w1' });
  const svc = new EtherfuseService(client);
  await svc.registerWallet({ walletId: 'w1', publicKey: 'GADDR' });
  expect(client.request).toHaveBeenCalledWith('POST', '/ramp/wallet',
    { walletId: 'w1', publicKey: 'GADDR', blockchain: 'stellar', claimOwnership: true });
});

it('regenerateTx hits the order regenerate endpoint', async () => {
  const client = clientStub({ orderId: 'o1', stellarClaimTransaction: 'XDR2' });
  const svc = new EtherfuseService(client);
  const r = await svc.regenerateTx('o1');
  expect(client.request).toHaveBeenCalledWith('POST', '/ramp/order/o1/regenerate_tx');
  expect(r.stellarClaimTransaction).toBe('XDR2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/etherfuse.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { EtherfuseClient, ETHERFUSE_CLIENT } from './etherfuse.client';

export interface QuoteParams {
  quoteId: string; customerId: string; blockchain: string;
  quoteAssets: { type: 'onramp' | 'offramp'; sourceAsset: string; targetAsset: string };
  sourceAmount: string; walletAddress?: string;
}
export interface QuoteResponse { quoteId: string; targetAmount: string; feeBps: number; feeAmount?: string; }
export interface CreateOrderParams { orderId: string; quoteId: string; bankAccountId: string; publicKey: string; }
export interface OrderResponse {
  onramp?: { orderId: string; depositAmount?: string; depositClabe?: string; depositPixKey?: string; depositPixQr?: string };
  offramp?: { orderId: string; burnTransaction?: string; withdrawAnchorAccount?: string; withdrawMemo?: string };
  orderId?: string; status?: string;
  stellarClaimableBalanceId?: string; stellarClaimTransaction?: string;
}

@Injectable()
export class EtherfuseService {
  constructor(@Inject(ETHERFUSE_CLIENT) private readonly client: EtherfuseClient) {}

  registerWallet(p: { walletId: string; publicKey: string }) {
    return this.client.request<{ walletId: string }>('POST', '/ramp/wallet', {
      walletId: p.walletId, publicKey: p.publicKey, blockchain: 'stellar', claimOwnership: true,
    });
  }
  createOnboardingUrl(p: { customerId: string; redirectUrl: string }) {
    return this.client.request<{ url: string }>('POST', '/ramp/onboarding-url', p);
  }
  getQuote(p: QuoteParams) {
    return this.client.request<QuoteResponse>('POST', '/ramp/quote', p);
  }
  createOrder(p: CreateOrderParams) {
    return this.client.request<OrderResponse>('POST', '/ramp/order', p);
  }
  getOrder(orderId: string) {
    return this.client.request<OrderResponse>('GET', `/ramp/order/${orderId}`);
  }
  regenerateTx(orderId: string) {
    return this.client.request<OrderResponse>('POST', `/ramp/order/${orderId}/regenerate_tx`);
  }
  cancelOrder(orderId: string) {
    return this.client.request<void>('POST', `/ramp/order/${orderId}/cancel`);
  }
  listAssets(blockchain: string) {
    return this.client.request<Array<{ identifier: string; symbol: string }>>(
      'GET', `/ramp/assets?blockchain=${blockchain}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/etherfuse.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/etherfuse.service.ts apps/api/src/ramp/etherfuse.service.spec.ts
git commit -m "feat(ramp): typed EtherfuseService wrappers"
```

---

## Task 8: StellarService trustline helpers

**Files:**
- Modify: `apps/api/src/stellar/stellar.service.ts`
- Test: `apps/api/src/stellar/stellar.service.spec.ts` (existing — extend)

**Interfaces:**
- Consumes: existing `this.server` (rpc), `this.passphrase`, `attachAndSubmit`.
- Produces:
  - `hasTrustline(address: string, asset: { code: string; issuer: string }): Promise<boolean>`
  - `buildAddTrustline(address: string, asset: { code: string; issuer: string }): Promise<{ xdr: string; hash: string }>` — builds an unsigned `changeTrust` tx (source = the wallet) for the user to sign; the existing `attachAndSubmit` submits it.

> Off-ramp needs the wallet to already hold the USDC trustline. On-ramp's Etherfuse claim tx creates it automatically, so `buildAddTrustline` is the fallback for wallets that off-ramp before ever on-ramping.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/stellar/stellar.service.spec.ts`:

```ts
import { StellarService } from './stellar.service';

const cfg = {
  stellarNetwork: 'testnet', sorobanRpcUrl: 'https://rpc.test',
  feeSponsorSecretKey: 'SА...', // use a valid test secret as in existing tests
} as any;

it('hasTrustline: true when balance line for asset exists', async () => {
  const server = {
    getAccount: vi.fn().mockResolvedValue({
      balances: [{ asset_code: 'USDC', asset_issuer: 'GISSUER' }],
    }),
  } as any;
  const svc = new StellarService(cfg, server);
  expect(await svc.hasTrustline('GADDR', { code: 'USDC', issuer: 'GISSUER' })).toBe(true);
});

it('hasTrustline: false when no matching line', async () => {
  const server = {
    getAccount: vi.fn().mockResolvedValue({ balances: [] }),
  } as any;
  const svc = new StellarService(cfg, server);
  expect(await svc.hasTrustline('GADDR', { code: 'USDC', issuer: 'GISSUER' })).toBe(false);
});
```

> Match the existing spec's pattern for constructing `StellarService` with a fake `server` and a valid test `feeSponsorSecretKey` (copy the secret the current tests already use). `getAccount` for trustline reads the classic account's `balances`; if the existing fake returns a Horizon-style account, align the field names with what `@stellar/stellar-sdk` exposes for the chosen RPC/Horizon call.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/stellar/stellar.service.spec.ts`
Expected: FAIL — `hasTrustline` not a function.

- [ ] **Step 3: Implement**

Add imports at the top of `stellar.service.ts`: `Asset`, `Operation` (Operation already imported), `Horizon` if needed. Then add methods to the class:

```ts
  async hasTrustline(
    address: string,
    asset: { code: string; issuer: string },
  ): Promise<boolean> {
    const account: any = await this.server.getAccount(address);
    const balances: any[] = account.balances ?? [];
    return balances.some(
      (b) => b.asset_code === asset.code && b.asset_issuer === asset.issuer,
    );
  }

  async buildAddTrustline(
    address: string,
    asset: { code: string; issuer: string },
  ): Promise<{ xdr: string; hash: string }> {
    const source = await this.server.getAccount(address);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase,
    })
      .addOperation(
        Operation.changeTrust({ asset: new Asset(asset.code, asset.issuer) }),
      )
      .setTimeout(120)
      .build();
    const xdr = tx.toXDR();
    return { xdr, hash: '0x' + tx.hash().toString('hex') };
  }
```

Add `Asset` to the `@stellar/stellar-sdk` import list at the top of the file.

> `this.server` is an `rpc.Server`. If `getAccount` on the RPC server does not expose classic `balances`, use a Horizon read for `hasTrustline` (inject a Horizon server URL) or read trustlines via the RPC `getLedgerEntries` for the account. Pick whichever the existing code already has access to; the test mocks `getAccount` returning `{ balances }`, so keep the method reading `account.balances` and adapt the real source accordingly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/stellar/stellar.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/stellar/stellar.service.ts apps/api/src/stellar/stellar.service.spec.ts
git commit -m "feat(stellar): hasTrustline + buildAddTrustline helpers"
```

---

## Task 9: Shared ramp DTOs

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface OnrampQuoteDto { fiatAmount: string }
  export interface OfframpQuoteDto { tokenAmount: string }
  export interface RampQuoteResult { quoteId: string; targetAmount: string; feeBps: number }
  export interface CreateRampOrderDto { quoteId: string }
  export interface RampOrderView {
    id: string; direction: 'ONRAMP' | 'OFFRAMP'; status: string;
    fiatAmount: string; tokenAmount: string;
    claimableBalanceId?: string; stellarTxHash?: string;
  }
  ```

- [ ] **Step 1: Add the DTOs**

Append the interfaces above to `packages/shared/src/index.ts`.

- [ ] **Step 2: Typecheck the shared package**

Run: `cd packages/shared && npx tsc --noEmit` (or the repo's shared build script)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): ramp DTOs"
```

---

## Task 10: RampService — onboarding (customer / wallet / onboarding URL)

**Files:**
- Create: `apps/api/src/ramp/ramp.service.ts`
- Test: `apps/api/src/ramp/ramp.service.spec.ts`

**Interfaces:**
- Consumes: `EtherfuseService`, `PrismaService`, `WalletService`, `Env` (`APP_CONFIG`), plus (later tasks) `StellarService`, `VaultService`, `DepositService`, `WithdrawService`, `LedgerService`.
- Produces (this task):
  - `getOnboardingUrl(companyId: string): Promise<{ url: string }>` — ensures an Etherfuse customer + a registered wallet exist for the company, then returns a hosted onboarding URL.
  - private `ensureCustomerAndWallet(companyId): Promise<{ customerId: string; walletId: string; address: string }>`

> UUID generation: use `crypto.randomUUID()` (Node ≥ 16). For `customerId`, the company gets a stable UUID stored in `Company.etherfuseCustomerId` on first use.

- [ ] **Step 1: Write the failing test**

```ts
import { RampService } from './ramp.service';

function deps(over: any = {}) {
  return {
    etherfuse: {
      registerWallet: vi.fn().mockResolvedValue({ walletId: 'w1' }),
      createOnboardingUrl: vi.fn().mockResolvedValue({ url: 'https://hosted/x' }),
      ...over.etherfuse,
    },
    prisma: {
      company: {
        findUnique: vi.fn().mockResolvedValue({ id: 'co_1', etherfuseCustomerId: null, etherfuseWalletId: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      ...over.prisma,
    },
    wallet: { getAddress: vi.fn().mockResolvedValue('GADDR'), ...over.wallet },
    config: { rampRedirectUrl: 'https://app/done', rampFiatCurrency: 'BRL', ...over.config },
  };
}

it('getOnboardingUrl: creates customer+wallet, persists ids, returns url', async () => {
  const d = deps();
  const svc = new RampService(
    d.etherfuse as any, d.prisma as any, d.wallet as any, d.config as any,
    {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  const r = await svc.getOnboardingUrl('co_1');
  expect(d.etherfuse.registerWallet).toHaveBeenCalledWith(
    expect.objectContaining({ publicKey: 'GADDR' }),
  );
  expect(d.prisma.company.update).toHaveBeenCalled(); // persisted customerId/walletId
  expect(d.etherfuse.createOnboardingUrl).toHaveBeenCalledWith(
    expect.objectContaining({ redirectUrl: 'https://app/done' }),
  );
  expect(r).toEqual({ url: 'https://hosted/x' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/ramp.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement (onboarding part only; flow methods added in later tasks)**

```ts
import { randomUUID } from 'crypto';
import { ForbiddenException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { StellarService } from '../stellar/stellar.service';
import { VaultService } from '../vault/vault.service';
import { DepositService } from '../deposit/deposit.service';
import { WithdrawService } from '../withdraw/withdraw.service';
import { LedgerService } from '../ledger/ledger.service';
import { EtherfuseService } from './etherfuse.service';

@Injectable()
export class RampService {
  constructor(
    private readonly etherfuse: EtherfuseService,
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    @Inject(APP_CONFIG) private readonly config: Env,
    private readonly stellar: StellarService,
    private readonly vault: VaultService,
    private readonly deposit: DepositService,
    private readonly withdraw: WithdrawService,
    private readonly ledger: LedgerService,
  ) {}

  private async ensureCustomerAndWallet(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new ForbiddenException('company not found');
    const address = await this.wallet.getAddress(companyId);

    const customerId = company.etherfuseCustomerId ?? randomUUID();
    let walletId = company.etherfuseWalletId ?? undefined;
    if (!walletId) {
      const reg = await this.etherfuse.registerWallet({ walletId: randomUUID(), publicKey: address });
      walletId = reg.walletId;
    }
    if (!company.etherfuseCustomerId || !company.etherfuseWalletId) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { etherfuseCustomerId: customerId, etherfuseWalletId: walletId },
      });
    }
    return { customerId, walletId, address };
  }

  async getOnboardingUrl(companyId: string): Promise<{ url: string }> {
    const { customerId } = await this.ensureCustomerAndWallet(companyId);
    return this.etherfuse.createOnboardingUrl({
      customerId,
      redirectUrl: this.config.rampRedirectUrl,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/ramp.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/ramp.service.ts apps/api/src/ramp/ramp.service.spec.ts
git commit -m "feat(ramp): RampService onboarding (customer + wallet + hosted url)"
```

---

## Task 11: RampService — on-ramp quote + order

**Files:**
- Modify: `apps/api/src/ramp/ramp.service.ts`
- Test: `apps/api/src/ramp/ramp.service.spec.ts`

**Interfaces:**
- Consumes: `EtherfuseService.getQuote/createOrder`, `PrismaService.rampOrder.create`, `ramp.money`, the configured USDC identifier (read from `listAssets`, cached on the service).
- Produces:
  - private `usdcIdentifier(): Promise<string>` — cached `GET /ramp/assets?blockchain=stellar`, find `symbol === 'USDC'`, return its `identifier` (`CODE:ISSUER`).
  - `onrampQuote(companyId: string, fiatAmount: bigint): Promise<{ quoteId: string; tokenAmount: bigint }>`
  - `onrampCreate(companyId: string, quoteId: string, fiatAmount: bigint, tokenAmount: bigint): Promise<{ orderId: string; deposit: OrderResponse['onramp'] }>` — requires KYC approved + bank account; creates `RampOrder(CREATED)`.

- [ ] **Step 1: Write the failing test**

```ts
it('onrampQuote: requires KYC approved', async () => {
  const d = deps({ prisma: {
    company: { findUnique: vi.fn().mockResolvedValue({ id: 'co_1', kycStatus: 'NONE' }) },
  }});
  const svc = makeSvc(d);
  await expect(svc.onrampQuote('co_1', 10000n)).rejects.toThrow(/kyc/i);
});

it('onrampQuote: passes BRL->USDC quoteAssets with walletAddress', async () => {
  const d = deps({
    prisma: { company: { findUnique: vi.fn().mockResolvedValue({
      id: 'co_1', kycStatus: 'APPROVED', etherfuseCustomerId: 'c1', etherfuseBankAccountId: 'b1' }) } },
    etherfuse: {
      listAssets: vi.fn().mockResolvedValue([{ symbol: 'USDC', identifier: 'USDC:GISSUER' }]),
      getQuote: vi.fn().mockResolvedValue({ quoteId: 'q1', targetAmount: '0.98', feeBps: 20 }),
    },
    wallet: { getAddress: vi.fn().mockResolvedValue('GADDR') },
  });
  const svc = makeSvc(d);
  const r = await svc.onrampQuote('co_1', 10000n); // 100.00 BRL
  expect(d.etherfuse.getQuote).toHaveBeenCalledWith(expect.objectContaining({
    blockchain: 'stellar',
    quoteAssets: { type: 'onramp', sourceAsset: 'BRL', targetAsset: 'USDC:GISSUER' },
    sourceAmount: '100', walletAddress: 'GADDR',
  }));
  expect(r).toEqual({ quoteId: 'q1', tokenAmount: 9800000n }); // 0.98 USDC -> 7 decimals
});

it('onrampCreate: creates etherfuse order + RampOrder row', async () => {
  const create = vi.fn().mockResolvedValue({});
  const d = deps({
    prisma: {
      company: { findUnique: vi.fn().mockResolvedValue({
        id: 'co_1', kycStatus: 'APPROVED', etherfuseBankAccountId: 'b1' }) },
      rampOrder: { create },
    },
    etherfuse: { createOrder: vi.fn().mockResolvedValue({ onramp: { orderId: 'o1', depositPixKey: 'k' } }) },
    wallet: { getAddress: vi.fn().mockResolvedValue('GADDR') },
  });
  const svc = makeSvc(d);
  const r = await svc.onrampCreate('co_1', 'q1', 10000n, 9800000n);
  expect(d.etherfuse.createOrder).toHaveBeenCalledWith(expect.objectContaining({
    quoteId: 'q1', bankAccountId: 'b1', publicKey: 'GADDR',
  }));
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    companyId: 'co_1', direction: 'ONRAMP', status: 'CREATED', fiatAmount: 10000n, tokenAmount: 9800000n,
  })}));
  expect(r.orderId).toBe('o1');
});
```

> Add a `makeSvc(d)` helper in the spec that constructs `RampService` from the `deps()` object (all nine constructor args). Reuse it across Tasks 10–13.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/ramp.service.spec.ts`
Expected: FAIL — `onrampQuote` not a function.

- [ ] **Step 3: Implement**

Add to `RampService`:

```ts
  private usdcId?: string;
  private async usdcIdentifier(): Promise<string> {
    if (this.usdcId) return this.usdcId;
    const assets = await this.etherfuse.listAssets('stellar');
    const usdc = assets.find((a) => a.symbol === 'USDC');
    if (!usdc) throw new Error('USDC not rampable on stellar per /ramp/assets');
    this.usdcId = usdc.identifier;
    return this.usdcId;
  }

  private async requireApproved(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new ForbiddenException('company not found');
    if (company.kycStatus !== 'APPROVED') throw new ForbiddenException('KYC not approved');
    return company;
  }

  async onrampQuote(companyId: string, fiatAmount: bigint) {
    const company = await this.requireApproved(companyId);
    const { customerId } = await this.ensureCustomerAndWallet(companyId);
    const address = await this.wallet.getAddress(companyId);
    const targetAsset = await this.usdcIdentifier();
    const quote = await this.etherfuse.getQuote({
      quoteId: randomUUID(), customerId, blockchain: 'stellar',
      quoteAssets: { type: 'onramp', sourceAsset: this.config.rampFiatCurrency, targetAsset },
      sourceAmount: baseUnitsToDecimal(fiatAmount, BRL_DECIMALS),
      walletAddress: address,
    });
    return { quoteId: quote.quoteId, tokenAmount: decimalToBaseUnits(quote.targetAmount, USDC_DECIMALS) };
  }

  async onrampCreate(companyId: string, quoteId: string, fiatAmount: bigint, tokenAmount: bigint) {
    const company = await this.requireApproved(companyId);
    if (!company.etherfuseBankAccountId) throw new UnprocessableEntityException('no bank account');
    const address = await this.wallet.getAddress(companyId);
    const orderId = randomUUID();
    const order = await this.etherfuse.createOrder({
      orderId, quoteId, bankAccountId: company.etherfuseBankAccountId, publicKey: address,
    });
    await this.prisma.rampOrder.create({ data: {
      companyId, etherfuseOrderId: orderId, direction: 'ONRAMP', status: 'CREATED',
      fiatCurrency: this.config.rampFiatCurrency, fiatAmount, tokenAmount, token: 'USDC', chain: 'stellar',
    }});
    return { orderId, deposit: order.onramp };
  }
```

Add imports at the top of the file: `import { baseUnitsToDecimal, decimalToBaseUnits, USDC_DECIMALS, BRL_DECIMALS } from './ramp.money';`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/ramp.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/ramp.service.ts apps/api/src/ramp/ramp.service.spec.ts
git commit -m "feat(ramp): on-ramp quote + order creation"
```

---

## Task 12: RampService — on-ramp claim + auto-deposit

**Files:**
- Modify: `apps/api/src/ramp/ramp.service.ts`
- Test: `apps/api/src/ramp/ramp.service.spec.ts`

**Interfaces:**
- Consumes: `EtherfuseService.getOrder/regenerateTx`, `StellarService.attachAndSubmit`, `VaultService.buildDeposit`, `LedgerService.recordDeposit`, `PrismaService.rampOrder`.
- Produces:
  - `onrampClaimTx(companyId, rampOrderId): Promise<{ xdr: string; claimableBalanceId: string }>` — fetches the order; if no claim tx yet, regenerate; returns `stellarClaimTransaction`.
  - `onrampClaimSubmit(companyId, rampOrderId, signedClaim: { xdr: string; signatureHex: string; stellarAddress: string }): Promise<{ txHash: string; deposit: { xdr: string; hash: string } }>` — submits the claim, then builds the vault deposit tx for the second signature.
  - `onrampDepositSubmit(companyId, rampOrderId, signedDeposit: SubmitTxDto): Promise<{ txHash: string }>` — submits the deposit, records ledger principal, marks `RampOrder` `COMPLETED`/`autoDeposited`.

- [ ] **Step 1: Write the failing test**

```ts
it('onrampClaimSubmit: submits claim then returns vault deposit to sign', async () => {
  const d = deps({
    prisma: { rampOrder: {
      findFirst: vi.fn().mockResolvedValue({ id: 'r1', companyId: 'co_1', etherfuseOrderId: 'o1', tokenAmount: 9800000n }),
      update: vi.fn().mockResolvedValue({}),
    }, company: { findUnique: vi.fn().mockResolvedValue({ id: 'co_1', kycStatus: 'APPROVED' }) } },
    stellar: { attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'CLAIMTX' }) },
    vault: { buildDeposit: vi.fn().mockResolvedValue({ xdr: 'DEPXDR' }) },
    deposit: {},
    wallet: { getAddress: vi.fn().mockResolvedValue('GADDR') },
  });
  d.stellarHash = vi.fn();
  const svc = makeSvc(d);
  const r = await svc.onrampClaimSubmit('co_1', 'r1',
    { xdr: 'CLAIMXDR', signatureHex: '0xsig', stellarAddress: 'GADDR' });
  expect(d.stellar.attachAndSubmit).toHaveBeenCalledWith('CLAIMXDR', 'GADDR', '0xsig');
  expect(d.vault.buildDeposit).toHaveBeenCalledWith('GADDR', 9800000n);
  expect(r.txHash).toBe('CLAIMTX');
  expect(r.deposit.xdr).toBe('DEPXDR');
});

it('onrampDepositSubmit: submits deposit, records principal, completes order', async () => {
  const update = vi.fn().mockResolvedValue({});
  const d = deps({
    prisma: { rampOrder: {
      findFirst: vi.fn().mockResolvedValue({ id: 'r1', companyId: 'co_1', tokenAmount: 9800000n, status: 'CREATED' }),
      update,
    }, company: { findUnique: vi.fn().mockResolvedValue({ id: 'co_1', kycStatus: 'APPROVED' }) } },
    stellar: { attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'DEPTX' }) },
    ledger: { recordDeposit: vi.fn().mockResolvedValue(undefined) },
    wallet: { getAddress: vi.fn().mockResolvedValue('GADDR') },
  });
  const svc = makeSvc(d);
  const r = await svc.onrampDepositSubmit('co_1', 'r1',
    { xdr: 'X', signatureHex: '0xs', stellarAddress: 'GADDR', amount: '9800000' });
  expect(d.ledger.recordDeposit).toHaveBeenCalledWith('co_1', 9800000n, 'DEPTX');
  expect(update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ status: 'COMPLETED', autoDeposited: true, stellarTxHash: 'DEPTX' }),
  }));
  expect(r.txHash).toBe('DEPTX');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/ramp.service.spec.ts`
Expected: FAIL — `onrampClaimSubmit` not a function.

- [ ] **Step 3: Implement**

```ts
  private async loadOrder(companyId: string, rampOrderId: string) {
    const order = await this.prisma.rampOrder.findFirst({ where: { id: rampOrderId, companyId } });
    if (!order) throw new ForbiddenException('ramp order not found for company');
    return order;
  }

  async onrampClaimTx(companyId: string, rampOrderId: string) {
    const order = await this.loadOrder(companyId, rampOrderId);
    let resp = await this.etherfuse.getOrder(order.etherfuseOrderId);
    if (!resp.stellarClaimTransaction) {
      resp = await this.etherfuse.regenerateTx(order.etherfuseOrderId);
    }
    if (!resp.stellarClaimTransaction) throw new UnprocessableEntityException('claim tx not ready');
    if (resp.stellarClaimableBalanceId && !order.claimableBalanceId) {
      await this.prisma.rampOrder.update({
        where: { id: order.id }, data: { claimableBalanceId: resp.stellarClaimableBalanceId },
      });
    }
    return { xdr: resp.stellarClaimTransaction, claimableBalanceId: resp.stellarClaimableBalanceId ?? '' };
  }

  async onrampClaimSubmit(
    companyId: string, rampOrderId: string,
    signed: { xdr: string; signatureHex: string; stellarAddress: string },
  ) {
    const order = await this.loadOrder(companyId, rampOrderId);
    const address = await this.wallet.getAddress(companyId);
    if (signed.stellarAddress !== address) throw new ForbiddenException('address mismatch');
    const { txHash } = await this.stellar.attachAndSubmit(signed.xdr, address, signed.signatureHex);
    await this.prisma.rampOrder.update({ where: { id: order.id }, data: { stellarTxHash: txHash } });
    const { xdr } = await this.vault.buildDeposit(address, order.tokenAmount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { txHash, deposit: { xdr, hash } };
  }

  async onrampDepositSubmit(companyId: string, rampOrderId: string, signed: SubmitTxDto) {
    const order = await this.loadOrder(companyId, rampOrderId);
    const address = await this.wallet.getAddress(companyId);
    if (signed.stellarAddress !== address) throw new ForbiddenException('address mismatch');
    const { txHash } = await this.stellar.attachAndSubmit(signed.xdr, address, signed.signatureHex);
    await this.ledger.recordDeposit(companyId, order.tokenAmount, txHash);
    await this.prisma.rampOrder.update({
      where: { id: order.id },
      data: { status: 'COMPLETED', autoDeposited: true, stellarTxHash: txHash },
    });
    return { txHash };
  }
```

Add `import { SubmitTxDto } from '@yield2pay/shared';` at the top.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/ramp.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/ramp.service.ts apps/api/src/ramp/ramp.service.spec.ts
git commit -m "feat(ramp): on-ramp claim + auto-deposit chain"
```

---

## Task 13: RampService — off-ramp

**Files:**
- Modify: `apps/api/src/ramp/ramp.service.ts`
- Test: `apps/api/src/ramp/ramp.service.spec.ts`

**Interfaces:**
- Consumes: `LedgerService.computeSpendable`, `StellarService.hasTrustline`, `WithdrawService.build`, `EtherfuseService.getQuote/createOrder/getOrder/regenerateTx`, `StellarService.attachAndSubmit`.
- Produces:
  - `offrampQuote(companyId, tokenAmount: bigint): Promise<{ quoteId: string; fiatAmount: bigint }>` — validates `tokenAmount <= spendable`.
  - `offrampCreate(companyId, quoteId, tokenAmount, fiatAmount): Promise<{ orderId: string; withdraw: { xdr: string; hash: string } }>` — returns the **vault withdraw** tx to sign first.
  - `offrampWithdrawSubmit(companyId, rampOrderId, signed: SubmitTxDto): Promise<{ burn: { xdr: string; hash: string } }>` — submits vault withdraw, then fetches the Etherfuse `burnTransaction`.
  - `offrampBurnSubmit(companyId, rampOrderId, signed): Promise<{ txHash: string }>` — submits the burn, marks `FUNDED`.

> Trustline/XLM: `offrampCreate` calls `stellar.hasTrustline(address, USDC)`; if false, throws `UnprocessableEntityException('wallet missing USDC trustline — on-ramp once or add a trustline first')`. (Establishing it standalone via `buildAddTrustline` is a follow-up; not in MVP happy path because vault deposits already require the trustline.)

- [ ] **Step 1: Write the failing test**

```ts
it('offrampQuote: rejects amount above spendable', async () => {
  const d = deps({
    prisma: { company: { findUnique: vi.fn().mockResolvedValue({ id: 'co_1', kycStatus: 'APPROVED' }) } },
    ledger: { computeSpendable: vi.fn().mockResolvedValue({ spendable: 5000000n, principal: 0n, vaultValue: 5000000n }) },
  });
  const svc = makeSvc(d);
  await expect(svc.offrampQuote('co_1', 9000000n)).rejects.toThrow(/spendable/i);
});

it('offrampCreate: validates trustline, creates order, returns withdraw tx', async () => {
  const create = vi.fn().mockResolvedValue({});
  const d = deps({
    prisma: {
      company: { findUnique: vi.fn().mockResolvedValue({ id: 'co_1', kycStatus: 'APPROVED', etherfuseBankAccountId: 'b1' }) },
      rampOrder: { create },
    },
    etherfuse: {
      listAssets: vi.fn().mockResolvedValue([{ symbol: 'USDC', identifier: 'USDC:GISSUER' }]),
      createOrder: vi.fn().mockResolvedValue({ offramp: { orderId: 'o2' } }),
    },
    stellar: { hasTrustline: vi.fn().mockResolvedValue(true) },
    withdraw: { build: vi.fn().mockResolvedValue({ xdr: 'WXDR', hash: '0xh' }) },
    wallet: { getAddress: vi.fn().mockResolvedValue('GADDR') },
  });
  const svc = makeSvc(d);
  const r = await svc.offrampCreate('co_1', 'q2', 3000000n, 1500n);
  expect(d.stellar.hasTrustline).toHaveBeenCalled();
  expect(d.withdraw.build).toHaveBeenCalledWith('co_1', 3000000n);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    direction: 'OFFRAMP', status: 'CREATED', tokenAmount: 3000000n, fiatAmount: 1500n })}));
  expect(r).toEqual({ orderId: 'o2', withdraw: { xdr: 'WXDR', hash: '0xh' } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/ramp.service.spec.ts`
Expected: FAIL — `offrampQuote` not a function.

- [ ] **Step 3: Implement**

```ts
  async offrampQuote(companyId: string, tokenAmount: bigint) {
    const company = await this.requireApproved(companyId);
    const { customerId } = await this.ensureCustomerAndWallet(companyId);
    const { spendable } = await this.ledger.computeSpendable(companyId);
    if (tokenAmount > spendable) {
      throw new UnprocessableEntityException('amount exceeds spendable balance');
    }
    const sourceAsset = await this.usdcIdentifier();
    const quote = await this.etherfuse.getQuote({
      quoteId: randomUUID(), customerId, blockchain: 'stellar',
      quoteAssets: { type: 'offramp', sourceAsset, targetAsset: this.config.rampFiatCurrency },
      sourceAmount: baseUnitsToDecimal(tokenAmount, USDC_DECIMALS),
    });
    void company;
    return { quoteId: quote.quoteId, fiatAmount: decimalToBaseUnits(quote.targetAmount, BRL_DECIMALS) };
  }

  async offrampCreate(companyId: string, quoteId: string, tokenAmount: bigint, fiatAmount: bigint) {
    const company = await this.requireApproved(companyId);
    if (!company.etherfuseBankAccountId) throw new UnprocessableEntityException('no bank account');
    const address = await this.wallet.getAddress(companyId);
    const usdc = await this.usdcIdentifier();
    const [code, issuer] = usdc.split(':');
    if (!(await this.stellar.hasTrustline(address, { code, issuer }))) {
      throw new UnprocessableEntityException('wallet missing USDC trustline — on-ramp once first');
    }
    const withdraw = await this.withdraw.build(companyId, tokenAmount);
    const orderId = randomUUID();
    await this.etherfuse.createOrder({
      orderId, quoteId, bankAccountId: company.etherfuseBankAccountId, publicKey: address,
    });
    await this.prisma.rampOrder.create({ data: {
      companyId, etherfuseOrderId: orderId, direction: 'OFFRAMP', status: 'CREATED',
      fiatCurrency: this.config.rampFiatCurrency, fiatAmount, tokenAmount, token: 'USDC', chain: 'stellar',
    }});
    return { orderId, withdraw };
  }

  async offrampWithdrawSubmit(companyId: string, rampOrderId: string, signed: SubmitTxDto) {
    const order = await this.loadOrder(companyId, rampOrderId);
    await this.withdraw.submit(companyId, signed); // submits vault withdraw -> USDC back in wallet
    let resp = await this.etherfuse.getOrder(order.etherfuseOrderId);
    if (!resp.offramp?.burnTransaction) resp = await this.etherfuse.regenerateTx(order.etherfuseOrderId);
    const burnXdr = resp.offramp?.burnTransaction;
    if (!burnXdr) throw new UnprocessableEntityException('burn tx not ready (check wallet XLM/trustline)');
    return { burn: { xdr: burnXdr, hash: this.stellar.hashForSigning(burnXdr).hash } };
  }

  async offrampBurnSubmit(companyId: string, rampOrderId: string, signed: SubmitTxDto) {
    const order = await this.loadOrder(companyId, rampOrderId);
    const address = await this.wallet.getAddress(companyId);
    if (signed.stellarAddress !== address) throw new ForbiddenException('address mismatch');
    const { txHash } = await this.stellar.attachAndSubmit(signed.xdr, address, signed.signatureHex);
    await this.prisma.rampOrder.update({
      where: { id: order.id }, data: { status: 'FUNDED', stellarTxHash: txHash },
    });
    return { txHash };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/ramp.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/ramp.service.ts apps/api/src/ramp/ramp.service.spec.ts
git commit -m "feat(ramp): off-ramp quote + vault withdraw + burn submit"
```

---

## Task 14: Webhook controller

**Files:**
- Create: `apps/api/src/ramp/ramp.webhook.controller.ts`
- Test: `apps/api/src/ramp/ramp.webhook.controller.spec.ts`

**Interfaces:**
- Consumes: `verifyEtherfuseSignature`, `mapEtherfuseStatus`, `canTransition`, `PrismaService`, `Env` (`etherfuseWebhookSecret`).
- Produces: `RampWebhookController` with `POST /ramp/webhook` handler `handle(@Headers('x-signature') sig, @Body() body): Promise<{ ok: true }>`.

Behavior:
- Verify signature → 401 `UnauthorizedException` if invalid.
- `event === 'kyc_updated'` → set `Company.kycStatus` (`approved`→`APPROVED`, `rejected`→`REJECTED`, else `PENDING`) by `etherfuseCustomerId`.
- `event === 'bank_account_updated'` and approved → set `Company.etherfuseBankAccountId`.
- `event === 'order_updated'` → find `RampOrder` by `etherfuseOrderId`; if `canTransition(current, mapped)` update `status`.

- [ ] **Step 1: Write the failing test**

```ts
import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import canonicalize from 'canonicalize';
import { RampWebhookController } from './ramp.webhook.controller';

const secret = Buffer.from('whk').toString('base64');
function sig(body: unknown) {
  const c = canonicalize(body) as string;
  return 'sha256=' + createHmac('sha256', Buffer.from(secret, 'base64')).update(c).digest('hex');
}

function ctrl(over: any = {}) {
  const prisma = {
    company: { updateMany: vi.fn().mockResolvedValue({}), findFirst: vi.fn() },
    rampOrder: {
      findUnique: vi.fn().mockResolvedValue({ id: 'r1', status: 'CREATED' }),
      update: vi.fn().mockResolvedValue({}),
    },
    ...over.prisma,
  };
  const config = { etherfuseWebhookSecret: secret } as any;
  return { c: new RampWebhookController(prisma as any, config), prisma };
}

it('rejects invalid signature', async () => {
  const { c } = ctrl();
  await expect(c.handle('sha256=bad', { event: 'order_updated', data: {} }))
    .rejects.toBeInstanceOf(UnauthorizedException);
});

it('order_updated advances status when transition is valid', async () => {
  const { c, prisma } = ctrl();
  const body = { event: 'order_updated', data: { orderId: 'o1', status: 'funded' } };
  await c.handle(sig(body), body);
  expect(prisma.rampOrder.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ status: 'FUNDED' }),
  }));
});

it('order_updated ignores invalid (backward) transition', async () => {
  const { c, prisma } = ctrl({ prisma: {
    company: { updateMany: vi.fn() },
    rampOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'r1', status: 'COMPLETED' }), update: vi.fn() },
  }});
  const body = { event: 'order_updated', data: { orderId: 'o1', status: 'funded' } };
  await c.handle(sig(body), body);
  expect(prisma.rampOrder.update).not.toHaveBeenCalled();
});

it('kyc_updated sets company kycStatus', async () => {
  const { c, prisma } = ctrl();
  const body = { event: 'kyc_updated', data: { customerId: 'c1', status: 'approved' } };
  await c.handle(sig(body), body);
  expect(prisma.company.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { etherfuseCustomerId: 'c1' }, data: { kycStatus: 'APPROVED' },
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/ramp/ramp.webhook.controller.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import {
  Body, Controller, Headers, Injectable, Inject, Post, UnauthorizedException,
} from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { verifyEtherfuseSignature } from './etherfuse.signature';
import { canTransition, mapEtherfuseStatus, RampStatus } from './ramp.state';

interface WebhookBody { event: string; data: any }

@Controller('ramp')
export class RampWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  @Post('webhook')
  async handle(
    @Headers('x-signature') signature: string | undefined,
    @Body() body: WebhookBody,
  ): Promise<{ ok: true }> {
    if (!verifyEtherfuseSignature(body, this.config.etherfuseWebhookSecret, signature)) {
      throw new UnauthorizedException('invalid webhook signature');
    }
    switch (body.event) {
      case 'kyc_updated':
      case 'kyb_updated': {
        const raw = String(body.data.status ?? '').toLowerCase();
        const kycStatus = raw === 'approved' ? 'APPROVED' : raw === 'rejected' ? 'REJECTED' : 'PENDING';
        await this.prisma.company.updateMany({
          where: { etherfuseCustomerId: body.data.customerId }, data: { kycStatus },
        });
        break;
      }
      case 'bank_account_updated': {
        const raw = String(body.data.status ?? '').toLowerCase();
        if (raw === 'approved' || raw === 'compliant' || body.data.compliant === true) {
          await this.prisma.company.updateMany({
            where: { etherfuseCustomerId: body.data.customerId },
            data: { etherfuseBankAccountId: body.data.bankAccountId ?? body.data.id },
          });
        }
        break;
      }
      case 'order_updated': {
        const order = await this.prisma.rampOrder.findUnique({
          where: { etherfuseOrderId: body.data.orderId },
        });
        if (order) {
          const next = mapEtherfuseStatus(String(body.data.status));
          if (canTransition(order.status as RampStatus, next)) {
            await this.prisma.rampOrder.update({ where: { id: order.id }, data: { status: next } });
          }
        }
        break;
      }
    }
    return { ok: true };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/ramp/ramp.webhook.controller.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ramp/ramp.webhook.controller.ts apps/api/src/ramp/ramp.webhook.controller.spec.ts
git commit -m "feat(ramp): signed webhook controller + state updates"
```

---

## Task 15: Authenticated controller

**Files:**
- Create: `apps/api/src/ramp/ramp.controller.ts`

**Interfaces:**
- Consumes: `RampService`, `AuthGuard`, `AuthenticatedRequest`, `parseBaseUnits`, ramp DTOs.
- Produces routes under `/ramp` (all `@UseGuards(AuthGuard)` except the webhook, which lives in the other controller):

```
GET  /ramp/onboarding-url
POST /ramp/onramp/quote        body { fiatAmount }
POST /ramp/onramp              body { quoteId, fiatAmount, tokenAmount }
GET  /ramp/onramp/:id/claim-tx
POST /ramp/onramp/:id/claim    body SubmitTxDto-like { xdr, signatureHex, stellarAddress }
POST /ramp/onramp/:id/deposit  body SubmitTxDto
POST /ramp/offramp/quote       body { tokenAmount }
POST /ramp/offramp             body { quoteId, tokenAmount, fiatAmount }
POST /ramp/offramp/:id/withdraw body SubmitTxDto
POST /ramp/offramp/:id/burn    body SubmitTxDto
GET  /ramp/orders
```

> Amounts cross the wire as base-unit strings (reuse `parseBaseUnits`). `fiatAmount`/`tokenAmount` echoed back from the quote step so the order step persists exact values; the controller re-parses them (don't trust beyond persisting — the Etherfuse order is authoritative on settlement).

- [ ] **Step 1: Implement the controller**

```ts
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { parseBaseUnits } from '../common/parse-money';
import type { SubmitTxDto } from '@yield2pay/shared';
import { RampService } from './ramp.service';

@Controller('ramp')
@UseGuards(AuthGuard)
export class RampController {
  constructor(private readonly ramp: RampService) {}

  @Get('onboarding-url')
  onboardingUrl(@Req() req: AuthenticatedRequest) {
    return this.ramp.getOnboardingUrl(req.companyId);
  }

  @Post('onramp/quote')
  onrampQuote(@Req() req: AuthenticatedRequest, @Body() b: { fiatAmount: string }) {
    return this.ramp.onrampQuote(req.companyId, parseBaseUnits(b.fiatAmount));
  }

  @Post('onramp')
  onramp(@Req() req: AuthenticatedRequest, @Body() b: { quoteId: string; fiatAmount: string; tokenAmount: string }) {
    return this.ramp.onrampCreate(req.companyId, b.quoteId, parseBaseUnits(b.fiatAmount), parseBaseUnits(b.tokenAmount));
  }

  @Get('onramp/:id/claim-tx')
  claimTx(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.ramp.onrampClaimTx(req.companyId, id);
  }

  @Post('onramp/:id/claim')
  claim(@Req() req: AuthenticatedRequest, @Param('id') id: string,
        @Body() b: { xdr: string; signatureHex: string; stellarAddress: string }) {
    return this.ramp.onrampClaimSubmit(req.companyId, id, b);
  }

  @Post('onramp/:id/deposit')
  deposit(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() b: SubmitTxDto) {
    return this.ramp.onrampDepositSubmit(req.companyId, id, b);
  }

  @Post('offramp/quote')
  offrampQuote(@Req() req: AuthenticatedRequest, @Body() b: { tokenAmount: string }) {
    return this.ramp.offrampQuote(req.companyId, parseBaseUnits(b.tokenAmount));
  }

  @Post('offramp')
  offramp(@Req() req: AuthenticatedRequest, @Body() b: { quoteId: string; tokenAmount: string; fiatAmount: string }) {
    return this.ramp.offrampCreate(req.companyId, b.quoteId, parseBaseUnits(b.tokenAmount), parseBaseUnits(b.fiatAmount));
  }

  @Post('offramp/:id/withdraw')
  offrampWithdraw(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() b: SubmitTxDto) {
    return this.ramp.offrampWithdrawSubmit(req.companyId, id, b);
  }

  @Post('offramp/:id/burn')
  offrampBurn(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() b: SubmitTxDto) {
    return this.ramp.offrampBurnSubmit(req.companyId, id, b);
  }

  @Get('orders')
  orders(@Req() req: AuthenticatedRequest) {
    return this.ramp.listOrders(req.companyId);
  }
}
```

- [ ] **Step 2: Add `listOrders` to RampService**

In `ramp.service.ts`:

```ts
  listOrders(companyId: string) {
    return this.prisma.rampOrder.findMany({
      where: { companyId }, orderBy: { createdAt: 'desc' },
    });
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ramp/ramp.controller.ts apps/api/src/ramp/ramp.service.ts
git commit -m "feat(ramp): authenticated ramp routes"
```

---

## Task 16: Module wiring

**Files:**
- Create: `apps/api/src/ramp/ramp.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `RampModule` providing `EtherfuseClient` (factory from `Env`), `EtherfuseService`, `RampService`; controllers `RampController`, `RampWebhookController`; importing the modules that own the reused services.

- [ ] **Step 1: Implement `ramp.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { StellarModule } from '../stellar/stellar.module';
import { VaultModule } from '../vault/vault.module';
import { DepositModule } from '../deposit/deposit.module';
import { WithdrawModule } from '../withdraw/withdraw.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuthModule } from '../auth/auth.module';
import { EtherfuseClient, ETHERFUSE_CLIENT } from './etherfuse.client';
import { EtherfuseService } from './etherfuse.service';
import { RampService } from './ramp.service';
import { RampController } from './ramp.controller';
import { RampWebhookController } from './ramp.webhook.controller';

@Module({
  imports: [
    PrismaModule, WalletModule, StellarModule, VaultModule,
    DepositModule, WithdrawModule, LedgerModule, AuthModule,
  ],
  providers: [
    {
      provide: ETHERFUSE_CLIENT,
      useFactory: (cfg: Env) =>
        new EtherfuseClient({ apiKey: cfg.etherfuseApiKey, baseUrl: cfg.etherfuseBaseUrl }),
      inject: [APP_CONFIG],
    },
    EtherfuseService,
    RampService,
  ],
  controllers: [RampController, RampWebhookController],
})
export class RampModule {}
```

> Confirm each imported module `exports` the service `RampModule` consumes (`WalletService`, `StellarService`, `VaultService`, `DepositService`, `WithdrawService`, `LedgerService`). They already export their services for the existing `deposit`/`withdraw` modules; if `AuthModule` doesn't export `AuthGuard`'s deps (`PrivyService`, `CompanyService`), import it as the existing authed controllers do (check how `DepositModule` wires `AuthGuard`).

- [ ] **Step 2: Register in `app.module.ts`**

Add `import { RampModule } from './ramp/ramp.module';` and add `RampModule` to the `imports` array.

- [ ] **Step 3: Build + boot check**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: typecheck PASS, all unit specs PASS.

> If Nest can't resolve `AuthGuard` in `RampController`, mirror exactly how `DepositController`'s module makes the guard work (same `imports`).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ramp/ramp.module.ts apps/api/src/app.module.ts
git commit -m "feat(ramp): wire RampModule into the app"
```

---

## Task 17: Deferred sandbox integration test

**Files:**
- Create: `apps/api/test/ramp.integration-spec.ts`

**Interfaces:**
- Mirrors `apps/api/test/vault.integration-spec.ts`: guarded by `process.env.RUN_INTEGRATION === '1'`, skipped in CI.

- [ ] **Step 1: Write the guarded scaffold**

```ts
/**
 * Deferred integration test: Etherfuse ramp (SANDBOX).
 * Run manually once sandbox credentials + a KYC-approved customer/wallet exist:
 *   RUN_INTEGRATION=1 npx vitest run test/ramp.integration-spec.ts
 *
 * Sandbox has NO USDC faucet: to get USDC, onramp CETES then swap CETES->USDC.
 * Resolves spec §15 open points:
 *   1. BRL/PIX on-ramp deposit response fields
 *   2. off-ramp sourceAmount semantics (token vs fiat)
 *   3. pixKeyType enum values
 *   4. whether hosted onboarding collects the PIX bank account
 */
import { EtherfuseClient } from '../src/ramp/etherfuse.client';

const SKIP = process.env.RUN_INTEGRATION !== '1';

(SKIP ? describe.skip : describe)('Etherfuse ramp integration (sandbox)', () => {
  const client = new EtherfuseClient({
    apiKey: process.env.ETHERFUSE_API_KEY!,
    baseUrl: process.env.ETHERFUSE_BASE_URL ?? 'https://api.sand.etherfuse.com',
  });

  it('lists stellar assets and finds USDC identifier', async () => {
    const assets = await client.request<Array<{ symbol: string; identifier: string }>>(
      'GET', '/ramp/assets?blockchain=stellar');
    const usdc = assets.find((a) => a.symbol === 'USDC');
    expect(usdc?.identifier).toMatch(/^USDC:/);
  });

  it.todo('onramp quote (BRL->USDC) with walletAddress returns claim fields after fiat_received');
  it.todo('offramp quote (USDC->BRL) returns burnTransaction once wallet has XLM+trustline');
});
```

- [ ] **Step 2: Verify it is skipped by default**

Run: `cd apps/api && npx vitest run test/ramp.integration-spec.ts`
Expected: suite skipped (0 failures).

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/ramp.integration-spec.ts
git commit -m "test(ramp): deferred sandbox integration scaffold"
```

---

## Task 18: Full suite + typecheck gate

- [ ] **Step 1: Run the whole API test suite**

Run: `cd apps/api && npx vitest run`
Expected: all specs PASS.

- [ ] **Step 2: Typecheck the whole API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(ramp): green suite + typecheck"
```

---

## Self-Review

**Spec coverage:**
- §2 auth/base URL/endpoints → Tasks 1, 6, 7 (no Bearer, env base URL, real paths).
- §3 module layout → Tasks 6–16.
- §4 data model → Task 2.
- §5 on-ramp → Tasks 11, 12 (quote/order/claim/auto-deposit).
- §6 off-ramp → Task 13 (quote/withdraw/burn).
- §7 webhook + state machine → Tasks 4, 5, 14.
- §8 onboarding/KYC/bank → Task 10 + webhook (Task 14) for `kyc_updated`/`bank_account_updated`.
- §9 Stellar specifics → Task 8 (trustline) + reuse of `attachAndSubmit` (claim/burn submit).
- §10 env → Task 1.
- §11 security/idempotency → randomUUID idempotency, `requireApproved`/bank guards, `companyId` binding, signature verify.
- §12 tests → unit per task + Task 17 deferred integration.
- §15 residuals → Task 17 `it.todo` + comments; `OrderResponse` PIX fields flagged optional in Task 7.

**Placeholder scan:** every code step contains full code; no TODO/TBD except the intentional `it.todo` integration placeholders (deferred-by-design, mirroring the existing vault integration test).

**Type consistency:** `RampStatus` strings match across `ramp.state.ts`, Prisma enum, webhook, and service updates. `attachAndSubmit(xdr, address, signatureHex)` used consistently. `SubmitTxDto` shape (`xdr/signatureHex/stellarAddress/amount`) reused for claim/deposit/withdraw/burn. `OrderResponse` field names match between `etherfuse.service.ts` (producer) and `ramp.service.ts` (consumer).

**Known follow-ups (not MVP-blocking):** standalone trustline setup endpoint (`buildAddTrustline` is implemented in Task 8 but only used as a guard message in Task 13); registering the webhook via `POST /ramp/webhook` at boot (currently configured in the Etherfuse dashboard, secret stored in env).
</content>
