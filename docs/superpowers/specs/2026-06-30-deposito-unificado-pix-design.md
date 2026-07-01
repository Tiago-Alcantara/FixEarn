# Design — Depósito unificado via Pix (on-ramp Etherfuse → cofre USDC)

**Data:** 2026-06-30
**Status:** aprovado (design), pronto pra planejamento

## Objetivo

Unificar os dois depósitos de hoje (depósito direto da carteira Stellar + on-ramp Pix
que para no `funded`) num **fluxo único via Pix**, encadeando `order → claim →
auto-depósito no cofre DeFindex`, de forma que o usuário **não perceba que é web3**.

## Decisões (do brainstorming)

1. Os "dois depósitos" = trilha carteira-direto + trilha Pix on-ramp. Unificar em uma.
2. UX: **fluxo único Pix**, sem escolha de origem. A trilha cripto **some da UI**.
3. Escopo assíncrono: **demo síncrono** — poll + botão "simular Pix" (sandbox), numa sessão.
4. Asset do cofre: **cofre USDC** (fluxo real do README). Ambos os passos operam em USDC.
5. Orquestração: **frontend orquestra**, backend fino (2 endpoints novos de claim).
6. Sem passo de seleção de tools no fluxo Pix (fica só no dashboard).
7. Web3 invisível: 2 assinaturas Privy (claim + depósito) atrás de **um** gesto
   "Confirmar" (ou automáticas se o Privy embedded permitir background).

## Fluxo (máquina de estados no front)

```
Tela "Depositar" (valor em R$)
   │
   ├─ A. cria order Etherfuse (onramp BRL→USDC)
   ├─ B. mostra Pix (chave/QR) + "você recebe ~X no cofre"
   ├─ C. poll status  (sandbox: botão "Simular Pix")
   │        │ funded
   │        ▼
   │  ── tela única "Aplicando no seu cofre…" (claim+depósito escondidos) ──
   ├─ D. GET claim tx da order  (se sem claimable → pula pro F)
   ├─ E. assina CLAIM (ChangeTrust+ClaimClaimableBalance) — 1ª assinatura
   ├─ F. build depósito no cofre USDC
   ├─ G. assina DEPÓSITO — 2ª assinatura
   ├─ H. submit → registra no ledger
   ▼
✓ "Seu dinheiro está rendendo"
```

Estados: `idle → quoting → awaiting_pix → funded → claiming → claimed → depositing → done`.
Cada assinatura para e espera o gesto do usuário. Erro num passo mantém o estado
(retry do passo, não do fluxo inteiro). Se a order não tem claimable (carteira já com
trustline), `claiming`/`claimed` são pulados.

## Backend (fino)

### 1. Cofre vira USDC (config)
- `VAULT_ADDRESS` → vault DeFindex de **USDC** na testnet.
- `USDC_ADDRESS` → contrato USDC testnet real (hoje `C_DUMMY`).
- **Dependência de investigação:** obter/criar o vault USDC (DeFindex factory ou vault
  existente na testnet). Se indisponível, reavaliar com o usuário.

### 2. Endpoints de claim (novos)
| Endpoint | Comportamento |
|---|---|
| `GET /ramp/order/:id/claim` | Retorna `{ xdr, hash }` da tx de claim vinda de `order.stellarClaimTransaction`. Se a sequence estiver velha → chama `regenerate_tx` antes. Se a order não tem claimable → `{ skip: true }`. |
| `POST /ramp/order/:id/claim` | Recebe `{ xdr, signatureHex, stellarAddress }`, anexa assinatura, submete a tx **clássica**, faz poll até confirmar, retorna `{ txHash }`. |

Autorização: `AuthGuard` + `requireOwnOrder` (a order tem de pertencer à company).

### 3. Submit de tx clássica (`StellarService.submitClassic`)
A tx de claim é uma transação Stellar **clássica** (não Soroban). O `attachAndSubmit`
atual embrulha em fee-bump Soroban e faz poll via RPC — serve pro depósito no cofre,
não pro claim. Novo método `submitClassic(xdr, signatureHex)` que anexa a assinatura e
submete (Stellar RPC `sendTransaction` aceita tx clássica na testnet; se não, Horizon).
Este é o principal trabalho novo do backend e o maior risco técnico.

### 4. Reconciliação do depósito (`deposit.service`)
O `build` atual checa saldo **XLM nativo** + reserve buffer. Pro cofre USDC:
- O valor a depositar = USDC recebido no on-ramp (`order.targetAmount` em base units).
- O check de saldo passa a considerar o token **USDC**; o buffer de ~1.5 XLM continua
  só pra garantir XLM de fee/reserve na carteira.

### 5. Ledger
`recordDeposit(companyId, usdcAmount, vaultTxHash)` cria a `Deposit` no passo do cofre.
Campo opcional `rampOrderId` em `Deposit` liga a jornada Pix→cofre. `principal()` segue
somando `Deposit` sem mudança.

### Reuso (sem mudança)
`ramp/onramp/start`, `ramp/order/:id`, `ramp/onramp/simulate`, `deposit/build`,
`deposit/submit` já existem.

## Frontend

### 1. Hook `useDepositFlow` (novo)
Concentra a máquina de estados.
- `start(amountBrl)` → `rampSetup` se preciso → `startOnramp` → dados do Pix. → `awaiting_pix`.
- `waitForPix()` → poll `getRampOrder`; sandbox expõe `simulate()`. `funded` → `funded`.
- `confirm()` → `getOrderClaim` → assina claim (Privy `signRawHash`) → `submitOrderClaim`
  → `deposit/build` → assina depósito → `deposit/submit`. Guarda sub-progresso (flag
  `claimed`) pra não re-claimar em retry. → `done`.
- Expõe `{ state, order, error, start, simulate, confirm }`. Reusa a lógica de assinatura
  do `useStellarTx` internamente.

### 2. `deposit/page.tsx` (reescrita, Pix-only, sem abas)
| Estado UI | Mostra |
|---|---|
| `amount` | Input **R$**, chips, projeção "rende ~R$Y/mês". Botão "Depositar". |
| `pix` | Chave Pix/QR + valor + "você recebe ~X no cofre". Botão "Já paguei" · sandbox: "Simular Pix". |
| `applying` | Tela única de progresso "Aplicando no seu cofre…". |
| `done` | "Seu dinheiro está rendendo" (reusa `TxResultCard`, sem hash exposto). |

### 3. `lib/api.ts`
Dois métodos novos: `getOrderClaim(orderId)`, `submitOrderClaim(orderId, body)`.

### 4. Remoções (o web3 some da UI)
- `TabBar` + trilha "Stellar wallet" saem do `deposit/page.tsx`.
- `useStellarTx` **fica** (usado por dentro do `useDepositFlow`), só não aparece na UI.
- Linguagem 100% fiat: "R$", "seu cofre", "rendendo". Zero "wallet/XDR/USDC/assinar" na
  tela principal.

### 5. Withdraw (espelho — seção paralela)
Mesmo tratamento: só off-ramp (cofre → USDC → `burnTransaction` → Pix), tira a aba cripto,
linguagem fiat. Detalhado no plano como trilha paralela.

## Dados / Prisma
- `Deposit`: novo campo opcional `rampOrderId` (liga à `RampOrder`).
- `RampOrder`: já existe; `status` progride via poll.

## Tratamento de erros (retry do passo)
| Falha | Tratamento |
|---|---|
| `onramp/start` | Erro na tela `amount`, mantém valor. |
| Pix não confirma | Timeout do poll; mantém a order, permite re-simular/re-poll. |
| claim `tx_too_late`/sequence velha | `regenerate_tx` + retenta claim. |
| depósito no cofre falha | **Não re-faz claim** (USDC já na carteira); retenta só o depósito. |

Idempotência: `orderId` UUID do cliente (`RampOrder` unique); `getOrderClaim` devolve
`skip` se já sem claimable; `Deposit.txHash` unique evita registro duplo.

## Testes
- Backend: unit dos endpoints de claim, `submitClassic`, reconciliação do depósito
  (mock `EtherfuseClient`/`StellarService` — mock mode já existe).
- Front: testes da máquina `useDepositFlow` (mock api + `signRawHash`), no estilo dos
  testes atuais do `useStellarTx`.
- E2E manual: sandbox com a key real, fluxo BRL ponta-a-ponta.

## Riscos / itens de investigação
1. **Vault USDC testnet** — achar/criar endereço (DeFindex factory). Bloqueia o passo do
   cofre; investigar primeiro.
2. **Submit de tx clássica** (claim) — validar caminho (Stellar RPC vs Horizon) na testnet.
3. **Claimable balance no sandbox** — nos testes a order ficou em `funded` sem surgir o
   claim; pode só aparecer no `completed`. Investigar timing/condição.
4. **Assinatura silenciosa no Privy** — se não der background, cai no único "Confirmar".

## Fora de escopo (agora)
- Webhooks Etherfuse + retomar depósitos pendentes entre sessões (fica pro futuro).
- Contrato escrow próprio do Yield2Pay (`claim_yield`/split/`cancel`).
- Seleção de tools dentro do fluxo Pix.
