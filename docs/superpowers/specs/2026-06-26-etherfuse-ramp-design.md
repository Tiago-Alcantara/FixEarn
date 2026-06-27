# Design: On/Off-Ramp via Etherfuse (BRL ↔ USDC, Stellar)

**Data:** 2026-06-26
**Status:** Aprovado (brainstorming) + **verificado contra a doc oficial Etherfuse (MCP)** — pronto para plano de implementação
**Escopo:** Entrada (on-ramp) e saída (off-ramp) de valores fiat no FixEarn usando a Etherfuse Ramp API, integrando com a wallet Stellar (Privy) e o vault Defindex existentes.

> **Nota de verificação (2026-06-26):** este spec foi revisado endpoint-a-endpoint contra `docs.etherfuse.com` (OpenAPI + guias) via MCP. As correções aplicadas estão sinalizadas com **[verificado]**. Pontos ainda sem confirmação 100% estão na §15.

---

## 1. Objetivo e decisões travadas

Permitir que uma empresa:
- **On-ramp:** pagar via PIX (BRL) e receber USDC na sua wallet Stellar, com **auto-depósito** no vault Defindex.
- **Off-ramp:** sacar USDC do vault e receber BRL na conta bancária via PIX.

Decisões fixadas no brainstorming:

| Decisão | Escolha |
|---|---|
| Corredor | **BRL ↔ USDC** (PIX) |
| Escopo MVP | **Ambos** (on + off ramp) |
| KYC/KYB | **Hosted UI** (presigned URL) |
| Wallet destino | **Wallet Stellar existente (Privy, BYO)** |
| Pós on-ramp | **Auto-depósito no vault Defindex** |
| Integração | **Módulo `ramp` dedicado** + `EtherfuseService` + state machine via webhook |

USDC é o token porque bate direto com o vault Defindex (sem swap intermediário). BRL/PIX é suportado pela Etherfuse — **[verificado]** o schema de bank account tem variantes `Personal (BRL / PIX)` e `Business (BRL / PIX)`.

---

## 2. Referência da Etherfuse Ramp API **[verificado]**

Fonte: `https://docs.etherfuse.com` (OpenAPI + guias), lido via MCP.

### Base URLs
| Ambiente | Base URL | Disponibilidade |
|---|---|---|
| Sandbox | `https://api.sand.etherfuse.com` | imediata (qualquer admin) |
| Production | `https://api.etherfuse.com` | após KYB aprovado |

Mesmos endpoints e auth nos dois; muda só base URL + key.

### Auth — **NÃO usar `Bearer`**
- Header: `Authorization: <api_key>` (chave **crua**, sem prefixo `Bearer` — Bearer é a causa #1 de `401`).
- Formato da key: `api_{env}:{key_id}:{org_id}`. `{env}` = `sand` | `prod`, embutido na chave (sandbox e prod **não** são intercambiáveis).
- **Não há OAuth/JWT exchange para chamadas de API.** `/auth/token` e `/auth/launch` existem só para os *user-launch flows* (sessão hosted do usuário final).
- Endpoints `/lookup/*` são públicos (sem key). Tudo em `/ramp/*` exige key.
- Toda chamada deve sair do **backend** (key é segredo).

### Endpoints usados (caminhos reais)
| Categoria | Endpoint | Uso |
|---|---|---|
| Quote | `POST /ramp/quote` | cotação onramp/offramp/swap (TTL 2 min) |
| Order (criar) | `POST /ramp/order` | cria ordem a partir do quote (**singular**) |
| Order (status) | `GET /ramp/order/{order_id}` | status |
| Order (cancelar) | `POST /ramp/order/{order_id}/cancel` | cancela ordem |
| Order (regen tx) | `POST /ramp/order/{order_id}/regenerate_tx` | regenera XDR Stellar expirado |
| Orders (listar) | `GET /ramp/orders` / `GET /ramp/customer/{id}/orders` | lista |
| Wallet | `POST /ramp/wallet` | registra wallet (idempotente) |
| Bank account | `POST /ramp/customer/{customer_id}/bank-account` | cadastra conta (API) |
| Onboarding | `POST /ramp/onboarding-url` | URL hosted de KYC/bank |
| Assets | `GET /ramp/assets?blockchain=stellar` | identifier `CODE:ISSUER` do USDC rampável |
| Agreements | `/ramp/agreements/*` | termos / customer-agreement / e-signature |
| Org | `GET /ramp/me` | org da API key |
| Webhook | `POST /ramp/webhook` / `GET /ramp/webhooks` | registra/lista webhook |
| Sandbox | `POST /ramp/order/fiat_received` | simula depósito fiat (sandbox-only) |

Eventos de webhook: `order_updated`, `kyc_updated`, `kyb_updated`, `bank_account_updated`, `swap_updated`, `customer_updated`.

### Specifics Stellar **[verificado]**
- Assets em formato **`CODE:ISSUER`** (ex.: `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`). **Nunca hardcode o issuer** — ler de `GET /ramp/assets` (issuer de sandbox ≠ produção).
- On-ramp para wallet nova: passar `walletAddress` no quote → Etherfuse funda conta + trustline (custo único embutido no fee) e entrega via **claimable balance**.
- `stellarClaimTransaction` = XDR único com `ChangeTrust` + `ClaimClaimableBalance` (1 assinatura faz trustline + claim).
- Off-ramp/swap: wallet **precisa já ter** XLM (~1.5) + trustline do ativo, ou nenhuma `burnTransaction` é gerada (falha silenciosa, sem webhook).
- XDRs Stellar (burn, claim, swap) **expiram em ~1–2 min** → `regenerate_tx`.
- `feePayer` (G-account) só se aplica a wallets **contrato (C-address)**; nossa wallet Privy é **G-address** (Ed25519), então é a própria fonte da tx.
- Gas sponsorship centralizado para wallet self-custody Stellar está **no roadmap** (hoje a wallet paga o próprio fee/reserva; on-ramp da primeira wallet é fundado pela Etherfuse via fee do quote).

---

## 3. Arquitetura e layout do módulo

Novo módulo `apps/api/src/ramp/`, espelhando o padrão dos módulos existentes (`deposit`, `withdraw`, `vault`).

```
ramp/
  etherfuse.client.ts          → HTTP client puro (Authorization: <key> SEM Bearer, base url sand/prod,
                                  idempotency UUID, Content-Type json, timeouts/retry)
  etherfuse.service.ts         → wrappers tipados: registerWallet, createOnboardingUrl, getQuote,
                                  createOrder, getOrder, regenerateTx, cancelOrder, listAssets,
                                  createBankAccount, createWebhook
  ramp.service.ts              → orquestração on/off; encadeia wallet/stellar/vault/ledger; guards KYC/bank/spendable
  ramp.controller.ts           → rotas autenticadas (AuthGuard)
  ramp.webhook.controller.ts   → POST /ramp/webhook (público, X-Signature HMAC verificada)
  ramp.state.ts                → máquina de estados RampStatus
  ramp.module.ts
```

`EtherfuseClient`/`EtherfuseService` provido via factory (igual `DEFINDEX_SDK`), lendo do `Env`.

Dependências (reuso, sem duplicar lógica):
- `WalletService` — endereço Stellar (G-address) da empresa.
- `StellarService` — assinar/submeter XDR, **ensureTrustline**, **ensureXLM**, fee-bump patrocinado, submit do claim/burn.
- `VaultService` / `DepositService` — auto-depósito on-ramp.
- `WithdrawService` — saque do vault no off-ramp.
- `LedgerService` — `recordDeposit` (principal) e `computeSpendable` (limite off-ramp).
- `PrismaService`.

### Rotas internas (AuthGuard, `companyId` do token)

```
GET  /ramp/onboarding-url          → URL hosted de KYC/bank (presigned)
POST /ramp/onramp/quote            → { fiatAmount } → cotação onramp
POST /ramp/onramp                  → { quoteId } → cria ordem, retorna instrução de pagamento PIX
GET  /ramp/onramp/:id/claim-tx     → retorna stellarClaimTransaction (XDR) p/ assinar (+ regenera se stale)
POST /ramp/onramp/:id/claim-submit → recebe XDR assinado, submete, dispara auto-deposit
POST /ramp/offramp/quote           → { tokenAmount } → cotação offramp
POST /ramp/offramp                 → { quoteId } → withdraw vault + cria ordem; retorna burnTransaction p/ assinar
POST /ramp/offramp/:id/burn-submit → recebe burnTransaction assinada, submete
GET  /ramp/orders                  → lista ordens da empresa
GET  /ramp/orders/:id              → status de uma ordem
POST /ramp/webhook                 → (público) eventos Etherfuse
```

> Observação: o claim/burn são assinados pela wallet Privy no front. O backend monta/repassa o XDR e submete (ou o front submete a Horizon). MVP: backend submete via `StellarService` (fee-bump patrocinado), igual ao fluxo `deposit/submit` atual.

---

## 4. Modelo de dados (Prisma)

```prisma
model Company {
  // ... campos existentes
  etherfuseCustomerId    String?     @unique   // customer (child org) na Etherfuse
  etherfuseWalletId      String?               // walletId do POST /ramp/wallet (BYO)
  etherfuseBankAccountId String?               // PIX (1 por empresa no MVP)
  kycStatus              KycStatus   @default(NONE)
  rampOrders             RampOrder[]
}

model RampOrder {
  id                  String        @id @default(cuid())
  companyId           String
  company             Company       @relation(fields: [companyId], references: [id])
  etherfuseOrderId    String        @unique     // orderId (UUID que NÓS geramos = idempotency)
  direction           RampDirection // ONRAMP | OFFRAMP
  status              RampStatus
  fiatCurrency        String        // "BRL"
  fiatAmount          BigInt        // centavos (string decimal na borda Etherfuse)
  tokenAmount         BigInt        // USDC base units
  token               String        // "USDC"
  chain               String        // "stellar"
  claimableBalanceId  String?       // on-ramp Stellar
  stellarTxHash       String?       // hash do claim (on) ou burn (off)
  autoDeposited       Boolean       @default(false)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@index([companyId, createdAt])
}

enum KycStatus     { NONE PENDING APPROVED REJECTED }
enum RampDirection { ONRAMP OFFRAMP }
// [verificado] alinhado aos status reais da Etherfuse:
enum RampStatus    { CREATED FUNDED COMPLETED FINALIZED FAILED CANCELLED }
```

Notas:
- **`orderId` é UUID gerado por nós** e serve de idempotency key (a Etherfuse usa o orderId que enviamos). Mesma ideia para `quoteId`, `walletId`, `bankAccount.transactionId`.
- Valores internos em BigInt base units; **converter para string decimal** ao chamar a Etherfuse (`sourceAmount: "100.00"`), e de volta ao persistir.
- Bank account em campo de `Company` (MVP, 1 PIX/empresa). Múltiplas contas → tabela própria depois.

---

## 5. Fluxo on-ramp (PIX BRL → USDC → vault) **[verificado]**

**Pré-requisito (uma vez por empresa):** customer criado + wallet registrada (`POST /ramp/wallet`, `claimOwnership:true`) + KYC aprovado. Trustline **não** é pré-requisito (Etherfuse cria no claim).

```
1. POST /ramp/onramp/quote { fiatAmount }
   → etherfuse POST /ramp/quote {
       quoteId:<uuid>, customerId, blockchain:"stellar",
       quoteAssets:{ type:"onramp", sourceAsset:"BRL", targetAsset:"<USDC CODE:ISSUER>" },
       sourceAmount:"<decimal>",
       walletAddress:"<G-address da empresa>"   // funda conta+trustline p/ wallet nova
     }
   → { quoteId, targetAmount(USDC), feeBps, feeAmount, expiry(2min) }

2. POST /ramp/onramp { quoteId }
   → etherfuse POST /ramp/order { orderId:<uuid>, bankAccountId, quoteId, publicKey:"<G-address>" }
   → resposta onramp: { orderId, deposit... }  (instrução de pagamento)
   → cria RampOrder(direction=ONRAMP, status=CREATED)
   → retorna instrução PIX ao cliente

3. Cliente paga PIX (fora do app). [sandbox: POST /ramp/order/fiat_received p/ simular]
   → webhook order_updated: status FUNDED → ... → COMPLETED

4. Quando order=COMPLETED, a ordem expõe (via webhook/GET):
   stellarClaimableBalanceId + stellarClaimTransaction (XDR: ChangeTrust + ClaimClaimableBalance)
   → salva claimableBalanceId

5. Claim (1 assinatura — Privy):
   GET /ramp/onramp/:id/claim-tx → retorna stellarClaimTransaction (regenera via regenerate_tx se seq stale)
   → cliente assina (Privy) → POST /ramp/onramp/:id/claim-submit → StellarService submete (fee-bump)
   → stellarTxHash salvo. Trustline + USDC agora na wallet (em uma tx).

6. Auto-depósito (decisão travada — 2ª assinatura):
   → DepositService.build (vault) → cliente assina → DepositService.submit
   → LedgerService.recordDeposit (principal += tokenAmount)
   → RampOrder.status local = COMPLETED, autoDeposited=true
```

**Assinaturas no on-ramp = 2** (claim + deposit). O claim já embute a trustline (antes eram 3 passos; agora 2). Combinar claim+deposit numa só tx **não é viável** (o XDR do claim é montado pela Etherfuse) — fica como está.

---

## 6. Fluxo off-ramp (vault → USDC → PIX BRL) **[verificado]**

**Pré-requisito:** KYC aprovado + `etherfuseBankAccountId` (PIX) cadastrado + **wallet com XLM (~1.5) e trustline USDC** (senão a `burnTransaction` não é gerada).

```
0. Garantir trustline USDC + XLM na wallet (StellarService.ensureTrustline/ensureXLM).
   (A retirada do vault no passo 2 já deposita USDC → trustline obrigatória de qualquer forma.)

1. POST /ramp/offramp/quote { tokenAmount }
   → etherfuse POST /ramp/quote {
       quoteId, customerId, blockchain:"stellar",
       quoteAssets:{ type:"offramp", sourceAsset:"<USDC CODE:ISSUER>", targetAsset:"BRL" },
       sourceAmount:"<decimal USDC>"
     }
   → { quoteId, targetAmount(BRL), feeBps, feeAmount }

2. POST /ramp/offramp { quoteId }
   → valida tokenAmount <= spendable (LedgerService.computeSpendable)
   → WithdrawService.build (vault) → cliente assina → submit  (USDC volta do Defindex p/ wallet)
   → etherfuse POST /ramp/order { orderId:<uuid>, bankAccountId, quoteId, publicKey:"<G-address>" }
     (default = burn flow; NÃO usar useAnchor)
   → resposta/webhook order_updated traz burnTransaction (XDR pré-montado)
   → RampOrder(direction=OFFRAMP, status=CREATED)

3. Assinar burnTransaction (Privy):
   → cliente assina o XDR → POST /ramp/offramp/:id/burn-submit → StellarService submete (fee-bump)
   → regenera via regenerate_tx se expirar (~1–2 min)
   → status FUNDED (burn confirmado on-chain)

4. Etherfuse detecta o burn → PIX payout → COMPLETED → FINALIZED (após janela de reversão)
```

Decisão: usar o **burn flow default** (Etherfuse monta o XDR correto); anchor mode (`useAnchor:true`, retorna `withdrawAnchorAccount`+`withdrawMemo`) fica como fallback documentado, não no MVP.

---

## 7. Webhooks e máquina de estados **[verificado]**

Endpoint `POST /ramp/webhook` — público, **sem** AuthGuard, **com** verificação de assinatura.

```
Assinatura (X-Signature):
- Header: X-Signature: sha256={hex}
- HMAC-SHA256 sobre o JSON do body CANONICALIZADO por RFC 8785 (JCS), chave = base64-decode(secret)
- secret é retornado UMA vez na criação do webhook (POST /ramp/webhook) → guardar em segredo
- Node: lib `canonicalize` + crypto.timingSafeEqual; comparar `sha256=${hmac}` ao header
- NestJS: canonicalizar o body parseado (não o raw); rejeitar 401 se não bater
- Retries: 3x, 5s de intervalo. Responder 2xx rápido.

Eventos → ação:
  kyc_updated          → Company.kycStatus = map(status)
  kyb_updated          → idem (pessoa jurídica / org)
  bank_account_updated → Company.etherfuseBankAccountId = id (quando approved/compliant)
  order_updated        → RampOrder.status = map; avança o fluxo:
                          · ONRAMP COMPLETED + claim presente → expõe claim p/ assinatura
                          · ONRAMP claim submetido            → dispara auto-deposit
                          · OFFRAMP burnTransaction presente  → expõe p/ assinatura
                          · OFFRAMP COMPLETED/FINALIZED       → encerra
```

`ramp.state.ts`: transições válidas `CREATED → FUNDED → COMPLETED → FINALIZED`; qualquer → `FAILED`/`CANCELLED`. Webhooks fora de ordem / regressão de estado terminal → log + ignora.

Front descobre estado por **polling** de `GET /ramp/orders/:id` (MVP; WebSocket/SSE deferido — Etherfuse tem `/ramp/ws` mas fora de escopo).

---

## 8. KYC/KYB + bank account onboarding (hosted) **[verificado]**

```
Org pai (FixEarn): precisa de KYB p/ chaves de PRODUÇÃO (sandbox é instantâneo).
Cada empresa cliente = um CUSTOMER (child org) na Etherfuse.

KYC do cliente (hosted, decisão travada):
  GET /ramp/onboarding-url
  → se Company.etherfuseCustomerId nulo: cria customer
  → etherfuse POST /ramp/onboarding-url { customerId, redirectUrl=RAMP_REDIRECT_URL }
  → front redireciona; cliente faz KYC + aceita agreements
  → webhook kyc_updated → Company.kycStatus=APPROVED

Wallet (BYO):
  POST /ramp/wallet { publicKey:"<G-address>", blockchain:"stellar", walletId:<uuid>, claimOwnership:true }
  → claimOwnership liga a compliance da wallet ao KYB da org → wallet "approved" sem KYC individual
  → guarda walletId em Company.etherfuseWalletId

Bank account PIX (off-ramp):
  via mesmo onboarding hosted OU POST /ramp/customer/{customerId}/bank-account
  Business (BRL/PIX): { name, cnpj, pixKey, pixKeyType, transactionId, countryIsoCode }
  Personal  (BRL/PIX): { firstName, lastName, cpf, pixKey, pixKeyType, transactionId }
  → webhook bank_account_updated → Company.etherfuseBankAccountId

Guards (ramp.service):
  onramp/offramp recusam se kycStatus != APPROVED → 403
  offramp recusa se etherfuseBankAccountId nulo → 422
```

---

## 9. Specifics Stellar (extensão de `StellarService`) **[verificado]**

```
ensureTrustline(address, asset=USDC):  // necessário p/ OFF-ramp e p/ receber USDC do vault
  - checa trustline; se faltar: changeTrust XDR → assina → submit (fee-bump patrocinado)
  - ON-ramp NÃO precisa: o stellarClaimTransaction já inclui ChangeTrust

ensureXLM(address, min=~1.5 XLM):  // reserva p/ conta + 1 trustline (off-ramp)
  - usa ensureAccountFunded existente; garante saldo p/ reserva

submitSignedXdr(xdrAssinado): // claim e burn
  - reusa attachAndSubmit/fee-bump existentes; trata tx_too_late → sinaliza regenerate_tx

(on-ramp de wallet nova é fundado pela Etherfuse via fee do quote — não gastamos XLN próprio)
```

USDC asset Stellar (`CODE:ISSUER`): obtido de `GET /ramp/assets?blockchain=stellar`. **Issuer de sandbox ≠ produção.** Deve corresponder ao ativo subjacente do vault Defindex:
- A Etherfuse entrega o **asset clássico** `USDC:ISSUER`; o vault usa o **SAC** (contrato Soroban) desse mesmo asset. O SAC encapsula o asset clássico (mesmo lastro). **Validar no boot** que o issuer do `/ramp/assets` corresponde ao SAC configurado em `USDC_ADDRESS` (falha rápido se divergir).

---

## 10. Config / env **[verificado]**

```
ETHERFUSE_API_KEY          # api_{env}:{key_id}:{org_id} (env embutido)
ETHERFUSE_BASE_URL         # https://api.sand.etherfuse.com (sandbox) | https://api.etherfuse.com (prod)
ETHERFUSE_WEBHOOK_SECRET   # base64, retornado na criação do webhook → guardar
ETHERFUSE_CUSTOMER_ID      # (opcional) org/customer raiz, se aplicável
RAMP_FIAT_CURRENCY         # BRL
RAMP_REDIRECT_URL          # retorno pós-KYC hosted
```

Adicionar ao `apps/api/src/config/env.ts` (zod) + `.env.example`, padrão dos `DEFINDEX_*`. **Sem `Bearer`** no client. O USDC identifier não é fixo no env (lido de `/ramp/assets`, cacheado).

---

## 11. Segurança, idempotência, falhas

- **Idempotência:** `orderId`/`quoteId`/`walletId`/`bankAccount.transactionId` são UUIDs que **nós** geramos e reenviamos em retries. Únicos no DB.
- **Webhook:** `X-Signature` HMAC obrigatória (RFC 8785 + base64 secret); rejeita inválido.
- **Bind por empresa:** toda ordem amarrada ao `companyId` do AuthGuard; nunca confiar em id vindo do client (mesmo princípio do fix "bind submit address to company").
- **Valores:** BigInt base units interno; string decimal na borda Etherfuse. Sem float.
- **Falhas parciais:**
  - On-ramp pago mas claim falha/expira → ordem fica com `claimableBalanceId`; `regenerate_tx` + re-submit (idempotente).
  - On-ramp claimed mas auto-deposit falha → USDC na wallet; retry do deposit (flag `autoDeposited=false`).
  - Off-ramp: withdraw do vault ok mas burn falha/expira → USDC na wallet; `regenerate_tx` + re-submit.
  - **Off-ramp sem XLM/trustline → burnTransaction nunca chega** (falha silenciosa): garantir pré-checagem no passo 0 e mensagem de erro clara.
- **Off-ramp valida `spendable`** antes de criar a ordem.
- **Duplicidade:** Etherfuse rejeita (409) ordem aberta com mesmo bankAccount+valor → tratar e orientar cancelar a anterior.

---

## 12. Estratégia de testes

```
Unit (jest, mock do HTTP Etherfuse):
  - etherfuse.client: header Authorization SEM Bearer; base url por ambiente; idempotency
  - etherfuse.service: monta quote/order/wallet/bank corretos; parseia respostas/erros
  - ramp.service: guards (KYC/bank/spendable), encadeamento on/off, conversão BigInt↔string decimal
  - webhook: verificação X-Signature (RFC 8785 + HMAC base64), status map, eventos fora de ordem
  - ramp.state: transições válidas/inválidas, estados terminais

Integration (deferido, guard RUN_INTEGRATION=1, SANDBOX Etherfuse):
  - quote + order onramp (simular fiat via POST /ramp/order/fiat_received)
  - claim do claimable balance no testnet Stellar (ChangeTrust+Claim numa tx)
  - offramp: burnTransaction + submit no testnet
  - NOTA: sandbox NÃO tem faucet de USDC → para ter USDC, onramp CETES e swap CETES→USDC
  espelha apps/api/test/vault.integration-spec.ts (deferido até credenciais sandbox)
```

---

## 13. Sequência de implementação sugerida

1. Config/env + `EtherfuseClient` (auth sem Bearer, base url) + `EtherfuseService` (wrappers) + tipos do OpenAPI.
2. Prisma: `RampOrder` + campos em `Company` + migration.
3. Onboarding: `POST /ramp/wallet` (claimOwnership) + `GET /ramp/onboarding-url` + webhook `kyc_updated`/`bank_account_updated`.
4. Webhook controller + verificação `X-Signature` + state machine.
5. On-ramp: quote → order → claim (regenerate_tx) → auto-deposit.
6. Off-ramp: ensureTrustline/XLM → withdraw vault → quote → order → burn submit.
7. Testes unit + integração deferida (sandbox).

---

## 14. Fora de escopo (YAGNI no MVP)

- Swap MXNe/EURC/CETES ↔ USDC (`/ramp/swap`) — exceto para *obter USDC de teste em sandbox*.
- Múltiplas contas bancárias por empresa.
- WebSocket/SSE (`/ramp/ws`) — polling no MVP.
- Embedded wallet Etherfuse (signer P-256) — usamos Privy BYO (G-address).
- Anchor mode (`useAnchor`) no off-ramp — usamos burn flow default.

---

## 15. Pontos a confirmar em sandbox (residuais)

1. **Resposta on-ramp para BRL/PIX:** o objeto `onramp` do `POST /ramp/order` mostrado na doc é MX-cêntrico (`depositClabe`, `depositAccountHolder:"Etherfuse MX"`). Confirmar quais campos vêm para BRL (PIX QR / chave) e como apresentar a instrução de pagamento.
2. **`sourceAmount` no off-ramp:** confirmar se é o montante em token (USDC) ou o alvo em fiat.
3. **`pixKeyType`:** valores aceitos do enum (cpf/cnpj/email/phone/evp).
4. **Onboarding hosted (`/ramp/onboarding-url`):** confirmar se coleta a conta PIX (bank) além do KYC, ou se o bank precisa do endpoint API à parte.
5. **Disponibilidade BRL em produção:** boa parte dos guias é MXN/SPEI. Confirmar com a Etherfuse que o corredor BRL on/off via PIX está GA (e limites/fees).
6. **Registro de webhook:** via `POST /ramp/webhook` no boot vs painel; e onde guardar o `secret` retornado.
</content>
</invoke>
