# Depósito Unificado via Pix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o depósito num fluxo único via Pix (on-ramp Etherfuse → claim → auto-depósito no cofre USDC), escondendo o web3 da UI.

**Architecture:** Frontend orquestra a máquina de estados; backend fino ganha endpoints de claim e submit de tx clássica. Cofre vira um vault DeFindex USDC idle (yield exibido continua sintético via `DEMO_YIELD_BPS`).

**Tech Stack:** NestJS + Prisma (api), Next.js 16 + Privy (web), @stellar/stellar-sdk, @defindex/sdk, Etherfuse Ramp API (sandbox BRL/Pix).

## Global Constraints

- Não commitar sem o usuário pedir explícito (CLAUDE.md). Commits abaixo são sugestões — só rodar quando ele autorizar.
- Sem trailer de co-autoria em commits.
- Moeda fiat = BRL (`ETHERFUSE_FIAT_CURRENCY=BRL`). Rede = Stellar testnet.
- USDC do Etherfuse: classic `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`; SAC testnet `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.
- Claim (`stellarClaimTransaction`) só existe quando a order chega a `completed` (~40s pós-simular). Poll até `completed`.
- Valores em base units (7 casas), bigint. Sem float em dinheiro.

---

## Task 1: Criar vault USDC idle na testnet + apontar env

Script one-time. Cria o vault DeFindex (asset = USDC SAC, strategies vazias), assina com o fee sponsor, submete, captura o endereço, atualiza `.env`.

**Files:**
- Create: `apps/api/scripts/create-usdc-vault.ts`
- Modify: `apps/api/.env` (VAULT_ADDRESS, USDC_ADDRESS)

**Interfaces:**
- Produces: `VAULT_ADDRESS` (novo vault USDC), `USDC_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.

- [ ] **Step 1: Escrever o script**

```ts
// apps/api/scripts/create-usdc-vault.ts
import { Asset, Networks, Keypair, TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import { DefindexSDK, SupportedNetworks } from '@defindex/sdk';

const RPC = 'https://soroban-testnet.stellar.org';
const SPONSOR = process.env.FEE_SPONSOR_SECRET_KEY!;
const sdk = new DefindexSDK({ apiKey: process.env.DEFINDEX_API_KEY!, baseUrl: process.env.DEFINDEX_BASE_URL! });

async function main() {
  const kp = Keypair.fromSecret(SPONSOR);
  const caller = kp.publicKey();
  const sac = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5').contractId(Networks.TESTNET);
  const { xdr } = await sdk.createVault({
    caller,
    roles: { emergencyManager: caller, rebalanceManager: caller, feeReceiver: caller, manager: caller },
    vaultFeeBps: 0, name: 'Yield2Pay-USDC', symbol: 'Y2PUSDC',
    assets: [{ address: sac, strategies: [] }], upgradable: true,
  }, SupportedNetworks.TESTNET);

  const server = new rpc.Server(RPC);
  let tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  const sim = await server.simulateTransaction(tx);
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(kp);
  const sent = await server.sendTransaction(tx);
  let gr = await server.getTransaction(sent.hash);
  while (gr.status === 'NOT_FOUND') { await new Promise(r=>setTimeout(r,2000)); gr = await server.getTransaction(sent.hash); }
  console.log('status:', gr.status, 'hash:', sent.hash);
  console.log('USDC SAC:', sac);
  // O endereço do vault sai do returnValue da tx (contract deployed). Logar retval:
  console.log('returnValue:', gr.returnValue?.toXDR?.('base64'));
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Rodar o script**

Run: `cd apps/api && node --env-file=.env --experimental-strip-types scripts/create-usdc-vault.ts`
Expected: `status: SUCCESS`, imprime o endereço do vault (contract id C...). Se o `returnValue` não trouxer o endereço legível, pegar via `getVaultInfo` na factory ou decodificar o scval do retval.

- [ ] **Step 3: Atualizar `.env`**

Trocar em `apps/api/.env`:
```
VAULT_ADDRESS=<novo_vault_usdc>
USDC_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```

- [ ] **Step 4: Validar**

Run: `cd apps/api && node --env-file=.env -e "const{DefindexSDK,SupportedNetworks}=require('@defindex/sdk');new DefindexSDK({apiKey:process.env.DEFINDEX_API_KEY,baseUrl:process.env.DEFINDEX_BASE_URL}).getVaultInfo(process.env.VAULT_ADDRESS,SupportedNetworks.TESTNET).then(i=>console.log(i.symbol,JSON.stringify(i.assets)))"`
Expected: symbol `Y2PUSDC`, asset = USDC SAC.

---

## Task 2: `StellarService.submitClassic` — submeter tx clássica assinada (claim)

**Files:**
- Modify: `apps/api/src/stellar/stellar.service.ts`
- Test: `apps/api/src/stellar/stellar.service.spec.ts`

**Interfaces:**
- Consumes: `rpc.Server` (já usado no service), `attachSignatureToTx` (helper existente que anexa assinatura hex a uma tx pelo hash).
- Produces: `submitClassic(xdr: string, signatureHex: string, stellarAddress: string): Promise<{ txHash: string }>`.

- [ ] **Step 1: Teste falhando**

```ts
it('submitClassic anexa assinatura, submete e retorna txHash', async () => {
  const fakeHash = 'ABC123';
  const server = (service as any).server;
  server.sendTransaction = vi.fn().mockResolvedValue({ hash: fakeHash, status: 'PENDING' });
  server.getTransaction = vi.fn().mockResolvedValue({ status: 'SUCCESS' });
  const xdr = buildClassicTestXdr(); // helper do spec existente
  const res = await service.submitClassic(xdr, '00'.repeat(64), TEST_PUBKEY);
  expect(res.txHash).toBe(fakeHash);
  expect(server.sendTransaction).toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && pnpm vitest run src/stellar/stellar.service.spec.ts -t submitClassic`
Expected: FAIL (`submitClassic is not a function`).

- [ ] **Step 3: Implementar**

```ts
// stellar.service.ts — tx clássica: NÃO usa fee-bump Soroban; a própria wallet paga o fee.
async submitClassic(
  xdr: string,
  signatureHex: string,
  stellarAddress: string,
): Promise<{ txHash: string }> {
  const tx = TransactionBuilder.fromXDR(xdr, this.networkPassphrase);
  const kp = Keypair.fromPublicKey(stellarAddress);
  const sig = Buffer.from(signatureHex, 'hex');
  tx.addSignature(stellarAddress, sig.toString('base64')); // hint via kp
  const sent = await this.server.sendTransaction(tx);
  let gr = await this.server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && gr.status === 'NOT_FOUND'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    gr = await this.server.getTransaction(sent.hash);
  }
  if (gr.status !== 'SUCCESS') {
    throw new Error(`claim tx not successful: ${gr.status}`);
  }
  return { txHash: sent.hash };
}
```
Nota: reusar o mesmo mecanismo de anexar assinatura que o `attachAndSubmit` já usa (via `DecoratedSignature` com o hint do `stellarAddress`). Se o helper existente já expõe isso, chamar ele em vez de reimplementar.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/api && pnpm vitest run src/stellar/stellar.service.spec.ts -t submitClassic`
Expected: PASS.

- [ ] **Step 5: Commit (se autorizado)**

```bash
git add apps/api/src/stellar/stellar.service.ts apps/api/src/stellar/stellar.service.spec.ts
git commit -m "feat(stellar): submitClassic para submeter tx clássica de claim"
```

---

## Task 3: Endpoints de claim no Ramp

**Files:**
- Modify: `apps/api/src/ramp/etherfuse.client.ts` (regenerate_tx + garantir claim fields)
- Modify: `apps/api/src/ramp/ramp.service.ts`
- Modify: `apps/api/src/ramp/ramp.controller.ts`
- Test: `apps/api/src/ramp/ramp.service.spec.ts` (criar)

**Interfaces:**
- Consumes: `EtherfuseClient.getOrder` (retorna `stellarClaimTransaction`, `stellarClaimableBalanceId`), `StellarService.submitClassic`, `StellarService.hashForSigning`.
- Produces:
  - `RampService.getOrderClaim(companyId, orderId): Promise<{ skip: boolean; xdr?: string; hash?: string }>`
  - `RampService.submitOrderClaim(companyId, orderId, dto: { xdr; signatureHex; stellarAddress }): Promise<{ txHash: string }>`
  - `EtherfuseClient.regenerateTx(orderId): Promise<void>`

- [ ] **Step 1: `EtherfuseClient.regenerateTx`**

```ts
// etherfuse.client.ts
async regenerateTx(orderId: string): Promise<void> {
  if (this.isMock) return;
  await this.request('POST', `/ramp/order/${orderId}/regenerate_tx`, {});
}
```

- [ ] **Step 2: Teste falhando do getOrderClaim (mock mode)**

```ts
// ramp.service.spec.ts
it('getOrderClaim retorna skip quando a order não tem claimable', async () => {
  ef.getOrder = vi.fn().mockResolvedValue({ orderId, status: 'completed' }); // sem claimTx
  const r = await service.getOrderClaim(companyId, orderId);
  expect(r.skip).toBe(true);
});
it('getOrderClaim retorna xdr+hash quando há claim', async () => {
  ef.getOrder = vi.fn().mockResolvedValue({ orderId, status: 'completed', stellarClaimTransaction: 'AAAA' });
  stellar.hashForSigning = vi.fn().mockReturnValue({ hash: '0xhash' });
  const r = await service.getOrderClaim(companyId, orderId);
  expect(r).toEqual({ skip: false, xdr: 'AAAA', hash: '0xhash' });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/api && pnpm vitest run src/ramp/ramp.service.spec.ts`
Expected: FAIL (`getOrderClaim is not a function`).

- [ ] **Step 4: Implementar service**

```ts
// ramp.service.ts
async getOrderClaim(companyId: string, orderId: string) {
  await this.requireOwnOrder(companyId, orderId);
  const order = await this.ef.getOrder(orderId);
  if (!order.stellarClaimTransaction) return { skip: true as const };
  const { hash } = this.stellar.hashForSigning(order.stellarClaimTransaction);
  return { skip: false as const, xdr: order.stellarClaimTransaction, hash };
}

async submitOrderClaim(
  companyId: string,
  orderId: string,
  dto: { xdr: string; signatureHex: string; stellarAddress: string },
) {
  const order = await this.requireOwnOrder(companyId, orderId);
  const registered = await this.wallet.getAddress(companyId);
  if (dto.stellarAddress !== registered) {
    throw new ForbiddenException('stellar address does not match registered wallet');
  }
  const { txHash } = await this.stellar.submitClassic(dto.xdr, dto.signatureHex, dto.stellarAddress);
  await this.prisma.rampOrder.update({ where: { orderId }, data: { status: 'claimed' } });
  return { txHash };
}
```
Injetar `StellarService` no `RampService` (add ao construtor + `StellarModule` no `RampModule`).

- [ ] **Step 5: Controller**

```ts
// ramp.controller.ts
@Get('order/:orderId/claim')
getOrderClaim(@Req() req: AuthenticatedRequest, @Param('orderId') orderId: string) {
  return this.ramp.getOrderClaim(req.companyId, orderId);
}

@Post('order/:orderId/claim')
submitOrderClaim(
  @Req() req: AuthenticatedRequest,
  @Param('orderId') orderId: string,
  @Body() body: { xdr: string; signatureHex: string; stellarAddress: string },
) {
  return this.ramp.submitOrderClaim(req.companyId, orderId, body);
}
```
Atenção à ordem das rotas: `order/:orderId/claim` não pode colidir com `order/:orderId`.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd apps/api && pnpm vitest run src/ramp/ramp.service.spec.ts`
Expected: PASS.

- [ ] **Step 7: Build + commit (se autorizado)**

Run: `cd apps/api && pnpm build`
```bash
git add apps/api/src/ramp
git commit -m "feat(ramp): endpoints de claim (get/submit) + regenerate_tx"
```

---

## Task 4: Reconciliação do depósito USDC + link ledger

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (Deposit.rampOrderId)
- Modify: `apps/api/src/deposit/deposit.service.ts`
- Modify: `apps/api/src/ledger/ledger.service.ts`
- Test: `apps/api/src/deposit/deposit.service.spec.ts`

**Interfaces:**
- Produces: `LedgerService.recordDeposit(companyId, amount, txHash, rampOrderId?)`.

- [ ] **Step 1: Prisma — campo opcional**

```prisma
model Deposit {
  // ...campos existentes...
  rampOrderId String? @map("ramp_order_id")
}
```

- [ ] **Step 2: Migration**

Run: `cd apps/api && pnpm exec prisma migrate dev --name deposit_ramp_link && pnpm exec prisma generate`
Expected: migration aplicada.

- [ ] **Step 3: Teste — deposit não checa mais saldo XLM nativo pro fluxo USDC**

O `deposit.service.build` hoje exige `amount <= spendable` (XLM nativo). Pro cofre USDC, o valor vem do on-ramp e o token é USDC. Ajuste: remover o gate de saldo nativo do build (ou torná-lo específico de XLM), mantendo o cap `MAX_DEPOSIT_BASE_UNITS`.

```ts
it('build não rejeita por saldo XLM (cofre USDC)', async () => {
  wallet.getAddress = vi.fn().mockResolvedValue(ADDR);
  vault.buildDeposit = vi.fn().mockResolvedValue({ xdr: 'X' });
  stellar.hashForSigning = vi.fn().mockReturnValue({ hash: 'H' });
  const r = await service.build(companyId, 5_0000000n);
  expect(r).toEqual({ xdr: 'X', hash: 'H' });
});
```

- [ ] **Step 4: Rodar e ver falhar/passar**

Run: `cd apps/api && pnpm vitest run src/deposit/deposit.service.spec.ts`
Expected: primeiro FAIL (gate de saldo), depois PASS após remover o gate nativo.

- [ ] **Step 5: Implementar** — remover o bloco de `getNativeBalance`/`spendable` do `build`; manter cap. `ledger.recordDeposit` aceita `rampOrderId?` opcional e grava.

- [ ] **Step 6: Commit (se autorizado)**

```bash
git add apps/api/prisma apps/api/src/deposit apps/api/src/ledger
git commit -m "feat(deposit): cofre USDC — remove gate XLM, liga Deposit↔RampOrder"
```

---

## Task 5: Shared types + API client (web)

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces: `OrderClaim { skip: boolean; xdr?: string; hash?: string }`; métodos `getOrderClaim`, `submitOrderClaim`.

- [ ] **Step 1: shared**

```ts
export interface OrderClaim { skip: boolean; xdr?: string; hash?: string; }
export interface SubmitClaimDto { xdr: string; signatureHex: string; stellarAddress: string; }
```

- [ ] **Step 2: api.ts — tipos + métodos**

```ts
getOrderClaim(orderId: string): Promise<OrderClaim>;
submitOrderClaim(orderId: string, body: SubmitClaimDto): Promise<{ txHash: string }>;
// impl:
getOrderClaim: (orderId) => request(`/ramp/order/${orderId}/claim`),
submitOrderClaim: (orderId, body) => request(`/ramp/order/${orderId}/claim`, 'POST', body),
```

- [ ] **Step 3: build web**

Run: `pnpm --filter web build` — Expected: compila.

---

## Task 6: Hook `useDepositFlow` (máquina de estados)

**Files:**
- Create: `apps/web/src/lib/useDepositFlow.ts`
- Test: `apps/web/src/lib/useDepositFlow.test.ts`

**Interfaces:**
- Consumes: `createApi`, `usePrivy().getAccessToken`, `useWallet().ensureWallet`, `useSignRawHash`.
- Produces: `useDepositFlow(): { state, order, error, start, simulate, confirm }`.

- [ ] **Step 1: Teste da máquina (mock api + signRawHash)** — espelhar o estilo de `useStellarTx.test.ts`:

```ts
it('confirm: claim (se houver) → depósito → done', async () => {
  api.getOrderClaim = vi.fn().mockResolvedValue({ skip: false, xdr: 'C', hash: '0xc' });
  api.submitOrderClaim = vi.fn().mockResolvedValue({ txHash: 'CLAIMTX' });
  api.buildDeposit = vi.fn().mockResolvedValue({ xdr: 'D', hash: '0xd' });
  api.submitDeposit = vi.fn().mockResolvedValue({ txHash: 'DEPTX' });
  signRawHash.mockResolvedValue({ signature: '0xsig' });
  const { result } = renderHook(() => useDepositFlow());
  await act(() => result.current.confirm(ORDER));
  expect(api.submitOrderClaim).toHaveBeenCalled();
  expect(api.submitDeposit).toHaveBeenCalled();
  expect(result.current.state).toBe('done');
});
it('confirm: pula claim quando skip=true', async () => {
  api.getOrderClaim = vi.fn().mockResolvedValue({ skip: true });
  // ...deposit segue normal...
  expect(api.submitOrderClaim).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter web vitest run src/lib/useDepositFlow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar o hook** — estados `idle|quoting|awaiting_pix|funded|applying|done|error`. `confirm(order)`:
  1. `getOrderClaim` → se `!skip`: `signRawHash(hash)` → `submitOrderClaim`. Marca `claimed` (não re-claima em retry).
  2. `buildDeposit(order.targetAmount base units)` → `signRawHash(hash)` → `submitDeposit({..., amount})`.
  3. estado → `done`.
  `start(amountBrl)`: `getRampStatus` → `rampSetup` se `!ready` → `startOnramp({amountFiat})` → `awaiting_pix`. `simulate()`: `simulateFiatReceived` → poll `getRampOrder` até `completed` → `funded`.

- [ ] **Step 4: Rodar e ver passar** — `pnpm --filter web vitest run src/lib/useDepositFlow.test.ts` → PASS.

- [ ] **Step 5: Commit (se autorizado)** — `git commit -m "feat(web): useDepositFlow orquestra Pix→claim→cofre"`

---

## Task 7: Reescrever `deposit/page.tsx` (Pix-only)

**Files:**
- Modify: `apps/web/src/app/(app)/deposit/page.tsx`
- Modify: `apps/web/src/app/(app)/deposit/deposit.test.tsx`

**Interfaces:**
- Consumes: `useDepositFlow`.

- [ ] **Step 1: Reescrever a página** — remover `TabBar` e a trilha Stellar wallet. Estados UI: `amount` (R$ input + chips + projeção "rende ~R$Y/mês"), `pix` (chave/QR + "você recebe ~X no cofre" + "Já paguei"/"Simular Pix"), `applying` (progresso "Aplicando no seu cofre…", chama `confirm`), `done` (`TxResultCard` sem hash). Linguagem 100% fiat.

- [ ] **Step 2: Atualizar o teste** — o `deposit.test.tsx` atual mira o fluxo antigo; reescrever pros estados novos (mock `useDepositFlow`).

- [ ] **Step 3: Build + test**

Run: `pnpm --filter web build && pnpm --filter web vitest run src/app/'(app)'/deposit/deposit.test.tsx`
Expected: compila + PASS.

- [ ] **Step 4: Commit (se autorizado)** — `git commit -m "feat(web): depósito Pix-only, web3 invisível"`

---

## Task 8: Withdraw espelho (off-ramp only)

**Files:**
- Modify: `apps/web/src/app/(app)/withdraw/page.tsx`

- [ ] **Step 1:** Remover a aba cripto do withdraw. Fluxo único: cofre → `withdraw/build`+`submit` (saca USDC pra carteira) → `startOfframp` → assina `burnTransaction` → Pix payout. Linguagem fiat (R$). Reusa `useDepositFlow`-style se fizer sentido, senão hook próprio `useWithdrawFlow` análogo. (Nota: off-ramp real exige a carteira ter USDC + trustline — o saque do cofre entrega isso antes.)

- [ ] **Step 2: Build** — `pnpm --filter web build` → compila.

- [ ] **Step 3: Commit (se autorizado)** — `git commit -m "feat(web): saque Pix-only espelhando o depósito"`

---

## Task 9: Validação E2E manual (sandbox)

- [ ] **Step 1:** Subir api (`pnpm --filter api start:dev`) + web (`pnpm --filter web dev`), logar via Privy, depositar R$100 via Pix, "Simular Pix", esperar `completed`, confirmar (claim+depósito), ver saldo no cofre + dashboard.
- [ ] **Step 2:** Sacar (off-ramp) e confirmar payout Pix simulado.
- [ ] **Step 3:** Rodar suites: `pnpm --filter api test && pnpm --filter web vitest run` — tudo verde.

---

## Cobertura do spec (self-review)
- Fluxo único Pix, web3 invisível → Tasks 6–8.
- Backend fino (claim endpoints, submitClassic) → Tasks 2–3.
- Cofre USDC → Task 1 (idle vault) + Task 4 (reconciliação).
- Poll até `completed` p/ claim → Task 6 (`simulate`/wait).
- Ledger link → Task 4.
- Withdraw espelho → Task 8.
- Testes → Tasks 2,3,4,6,7 + Task 9 E2E.

## Correções vindas dos spikes (vs. spec)
1. Claim só no `completed` (não `funded`) — poll ajustado.
2. Cofre USDC = vault idle (sem strategy) + yield sintético `DEMO_YIELD_BPS`.
3. USDC SAC testnet fixado: `CBIELTK6…`.
