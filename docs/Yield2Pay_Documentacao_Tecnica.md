# Yield2Pay - Documentação Técnica e de Negócios
## Architecture & Protocol Specification

**Nome do Projeto:** Yield2Pay Protocol (SaaSFree Protocol)  
**Trilha do Hackathon:** Soroban DeFi, RWA & Web2.5 Integration  
**Foco do MVP (Nicho):** Infraestrutura de APIs e Ferramentas para Desenvolvedores (B2B DevTools)  
**Arquitetura:** 100% Não-Custodial (Non-Custodial Escrow Architecture)

---

## 1. Sumário Executivo & Tese de Mercado

O Yield2Pay é um protocolo de infraestrutura financeira Web2.5 projetado para o mercado corporativo (B2B). Para o escopo deste MVP, o protocolo foca estritamente no nicho de APIs e Ferramentas para Desenvolvedores (DevTools), permitindo que startups e empresas de tecnologia contratem serviços essenciais de infraestrutura (como gateways de pagamento, APIs de consulta de dados e serviços de autenticação) sem consumir o seu capital principal (OpEx Zero).

Em vez de queimar caixa em mensalidades tradicionais que somem do balanço patrimonial, as empresas clientes alocam um colateral em stablecoins em um contrato inteligente seguro na rede Stellar (via Soroban). O rendimento bruto gerado por esse colateral em estratégias DeFi automatizadas paga o provedor da API em tempo real. No momento do cancelamento do serviço, o cliente resgata 100% do seu capital principal via Pix.

---

## 2. Visão Geral da Arquitetura (O Tripé Web2.5)

O Yield2Pay oculta totalmente a complexidade da blockchain por trás de interfaces tradicionais da Web2 através de três pilares integrados de forma nativa:

- **Abstração de Identidade e Carteira (Privy):** Remove a necessidade de chaves privadas manuais ou extensões de navegador (como a Freighter). Cria uma embedded wallet institucional via e-mail corporativo (Google Workspace).

- **Rampa Bancária Oficial (Stellar Anchors via SEP-24):** Conecta a tesouraria fiduciária em Reais (BRL) diretamente ao ambiente cripto. O cliente paga um Pix tradicional e recebe stablecoins locais equivalentes na rede.

- **Motor de Rendimento Automatizado (DeFindex):** O smart contract intermediário do Yield2Pay atua como um cano não-custodial que direciona o colateral recebido para os cofres indexados do DeFindex em Soroban, capturando a melhor rentabilidade da rede.

---

## 3. Mecânica Financeira & Modelo Matemático

### 3.1. Cálculo do Colateral Mínimo (Valor Fixo)

O protocolo calcula o colateral mínimo requerido baseado na equivalência matemática entre a mensalidade fixa da API (M) e a taxa de rendimento anual (Y_anual) entregue pelas pools do DeFindex.

**Fórmula do Colateral Mínimo (C):**

```
C = (M * 12) / Y_anual
```

**Exemplo Prático (Plano de API Fixo):**

| Parâmetro | Valor |
|---|---|
| Custo Mensal da API (M) | R$ 500,00 (R$ 6.000,00/ano) |
| Taxa de Rendimento Conservadora (Y_anual) | 12% a.a. (0,12) |
| Colateral Mínimo (C) | **R$ 50.000,00** |

### 3.2. Ajuste por Taxas de Rampa (Spread e Slippage)

Para garantir que o colateral líquido depositado no contrato inteligente seja exatamente o valor C necessário, a interface do Yield2Pay calcula dinamicamente o custo de fricção da rampa de entrada (SEP-24). Se o Anchor parceiro cobrar tarifas de processamento ou spread cambial na conversão de BRL para BRZ, esse valor é discriminado no checkout Web2, de modo que o QR Code do Pix cubra o valor principal acrescido das taxas de rampa.

### 3.3. Mitigação da Volatilidade do Yield (Y_anual Variável)

Como o rendimento proveniente de Soroban é flutuante, o Yield2Pay implementa uma **Margem de Colateral Reativa**. Caso o APY médio da pool caia abaixo da taxa de equilíbrio calculada (ex: queda de 12% para 9%), o protocolo adota as seguintes regras de governança automatizada:

- **Aviso de Subcolaterização:** O backend Web2 notifica o cliente de que o yield gerado no mês corrente não cobrirá integralmente a mensalidade do software.
- **Cobrança Residual Dinâmica:** Em vez de travar o serviço, o contrato inteligente liquida o yield total disponível e cobra a diferença residual do cliente via boleto ou Pix tradicional no fim do ciclo (antecipando a lógica do fundo de amortização da Fase 2).

---

## 4. Ciclos de Vida Técnicos e Fluxos de Dados (MVP)

### 4.1. Fluxo de Entrada: Do Pix até a Alocação no DeFindex

1. **Geração do Canal:** O frontend do app aciona o Privy para assinar uma requisição de On-Ramp via padrão Public SEP-24 direcionada ao Stellar Anchor parceiro.

2. **Emissão de Câmbio:** O cliente visualiza o QR Code Pix do valor calculado. Ao efetuar o pagamento pelo seu banco tradicional, o Anchor liquida o fiat e emite as stablecoins BRZ diretamente para a carteira Privy do cliente.

3. **A Engenharia de Pré-Autorização:** Para manter o fluxo não-custodial sem travar a experiência do usuário, no momento do checkout o Privy solicita a assinatura de duas transações de uma só vez:
   - **Transação 1 (Allowance):** Autoriza o smart contract Yield2Pay a movimentar os BRZ da carteira do cliente.
   - **Transação 2 (Deposit):** Deixa pré-programada a execução da função `deposit_collateral` do seu contrato.

4. **Alocação DeFi:** Assim que os tokens batem na carteira do cliente, o sistema dispara as transações pré-assinadas. O contrato Yield2Pay puxa os fundos (`transfer_from`) e, na mesma linha de execução, chama a função de depósito do cofre do DeFindex. O DeFindex distribui os ativos nas pools de Soroban e emite os tokens de liquidez correspondentes.

### 4.2. Fluxo de Distribuição do Yield (Pagamento da API)

1. **Gatilho de Cobrança:** No dia do vencimento da assinatura, um script automatizado da nossa plataforma chama a função `claim_yield` no contrato inteligente Yield2Pay.

2. **Resgate Isolado:** O contrato do Yield2Pay faz a chamada ao DeFindex e resgata estritamente o lucro gerado no período (ex: 500 BRZ). O colateral de R$ 50.000 permanece intacto.

3. **Split de Receitas (Monetização do Protocolo):** O contrato executa a divisão de taxas na própria linha de código:
   - **95% (475 BRZ):** Direcionados à carteira institucional do Provedor da API.
   - **5% (25 BRZ):** Direcionados à carteira de tesouraria da nossa plataforma (Yield2Pay Fee).

4. **Liquidação Comercial:** A interface do painel do Provedor da API detecta os 475 BRZ e aciona automaticamente o Off-Ramp via Anchor. O Anchor queima as stablecoins e transfere R$ 475,00 via Pix diretamente para a conta corrente tradicional da empresa de software.

### 4.3. Fluxo de Saída: Cancelamento e Resgate do Cliente

1. **Assinatura de Resgate:** O cliente clica em "Cancelar Assinatura" no dashboard. O Privy abre o pop-up de confirmação e colhe a assinatura criptográfica para a função `cancel_subscription`.

2. **Desmontagem de Posição:** O contrato Yield2Pay valida a identidade, acessa o cofre do DeFindex e executa o saque (`withdraw`) do colateral principal. O acesso à API é revogado pelo backend no mesmo instante através da leitura do evento emitido pela blockchain (`SubscriptionCanceled`).

3. **Cálculo Pro-Rata de Fechamento:** Se o cliente cancelar o serviço no meio do mês, o contrato inteligente faz o cálculo do rendimento parcial gerado nos dias utilizados: o principal volta para o cliente, e os juros daqueles dias são enviados proporcionalmente para a empresa dona da API.

4. **Pix de Devolução:** O frontend do app direciona os BRZ recuperados para o fluxo de saída do Anchor. O cliente insere a chave Pix (CNPJ) da sua empresa, o Anchor processa a queima do ativo digital e envia um Pix de volta para a conta bancária da empresa.

### 4.4. Especificação de Eventos On-Chain (Soroban Events)

Para garantir a sincronia em tempo real entre o estado da blockchain e o backend Web2 que gerencia as chaves de API, o contrato emite eventos padronizados:

```
DepositCollateral(client: Address, amount: u128)
YieldClaimed(provider: Address, provider_share: u128, protocol_share: u128)
SubscriptionCanceled(client: Address, principal_returned: u128)
```

---

## 5. Análise de Conformidade Regulatória & Matriz de Riscos

### 5.1. Estrutura Não-Custodial e Blindagem Jurídica

O Yield2Pay enquadra-se estritamente como uma Plataforma de Fornecimento de Software (SaaS Puro), mitigando os gargalos regulatórios do Banco Central e da CVM no Brasil através do conceito de ausência de controle discricionário.

- **Responsabilidade sobre as Chaves (Privy):** Utilizando criptografia de divisão de segredo (SSS), a chave privada é fragmentada. Nem a nossa plataforma nem o Privy possuem controle sobre os fundos isoladamente. A transação só pode ser assinada pela autenticação forte do usuário final. Isso descaracteriza a custódia.

- **Responsabilidade Bancária (Anchors):** Yield2Pay não toca em dinheiro fiduciário (BRL). Todo o fluxo de recepção de Pix, execução de stablecoins, KYC e prevenção à lavagem de dinheiro é processado por Instituições de Pagamento parceiras da Stellar que operam homologadas sob as licenças do Banco Central. Isso descaracteriza a intermediação financeira.

- **Responsabilidade sobre os Fundos (Soroban Contracts):** O contrato inteligente intermediário publicado na Stellar é imutável e descentralizado. Ele funciona estritamente como um Escrow Sem Permissão (Permissionless Trustless Escrow). Não existem chaves administrativas de controle (admin keys) que permitam à nossa empresa desviar, travar ou sacar o colateral dos clientes para benefício próprio.

### 5.2. Matriz de Mitigação de Riscos Técnicos e Financeiros

| Risco | Descrição | Mitigação |
|---|---|---|
| **Liquidez Externa** | Travamento ou falta de liquidez imediata nas pools subjacentes do DeFindex no momento em que um cliente solicita cancelamento. | Alocação exclusiva em cofres de stablecoins emparelhadas de alta rotatividade e liquidez profunda (ex: BRZ/USDC), evitando exposição a ativos voláteis ou pools de baixa profundidade. |
| **Custo de Oportunidade Corporativo** | Empresas tradicionais ou startups em estágio inicial hesitantes em imobilizar grandes quantias de caixa para custear mensalidades de software de baixo valor. | Foco em médias e grandes empresas ou startups capitalizadas com tesourarias de caixa ocioso rendendo abaixo da inflação, oferecendo eficiência tributária e preservação de capital (OpEx Zero). |

---

## 6. Diferencial Competitivo e Mapeamento do Ecossistema

Uma varredura detalhada nos diretórios de propostas e vencedores do Stellar Community Fund (SCF) Projects e no Stellar Ecosystem Directory aponta que não existem competidores executando essa solução no ecossistema atual. Os projetos existentes focam ou em infraestrutura pura (como o próprio DeFindex e Blend) ou em plataformas de financiamento por antecipação de recebíveis (RWA).

O Yield2Pay atua de forma original na ponta de consumo, funcionando como uma camada de captação de liquidez e TVL estável vindo do mercado de tecnologia do mundo real para alimentar o ecossistema DeFi de Soroban.

---

## 7. Roadmap de Produto: Visão de Longo Prazo

Para manter a objetividade exigida pelo ambiente de hackathon, o projeto foi intencionalmente limitado em seu escopo inicial, estabelecendo uma fundação técnica escalável para futuras linhas de receita massivas.

### Fase 1 — MVP (Entrega Atual do Hackathon)

> **⚠️ Testnet:** toda a implementação atual roda na testnet Stellar. O depósito no cofre DeFindex, o saldo on-chain, o fee-bump e o funding do cliente são operações reais na rede de testes — não em produção. A migração para mainnet depende da rampa fiat Etherfuse (BRL↔USDC via PIX) e de um cofre DeFindex financiado em mainnet.

- **Foco:** Assinaturas B2B de Valor Mensal Fixo para DevTools e APIs.
- **Implementação:** Depósito/saque reais no cofre DeFindex (testnet), criação automática de conta Stellar, patrocínio de gas via fee-bump, catálogo de serviços ativáveis, saldo on-chain em tempo real. On-Ramp fiat via Pix ainda não implementado — o funding de testnet é feito diretamente pelo sponsor da plataforma.
- **Caso de Uso Real:** Startups travam caixa ocioso para utilizar APIs de dados e infraestrutura Web2 sem queimar orçamento.

### Fase 2 — Próximos 6 Meses (Cobranças Recorrentes Variáveis)

- **Foco:** Infraestrutura Elástica e Pay-as-you-go (Pague pelo uso).
- **Evolução Técnico-Econômica:** Integração de Oráculos ou Webhooks de Faturamento no Smart Contract. O contrato passará a ler o consumo variável do cliente mensalmente (ex: volume de requisições de IA ou consumo de servidores de nuvem como AWS) e realizará um Split dinâmico do rendimento do DeFindex.
  - Se o yield mensal gerado for **maior** que a fatura flutuante → o excedente é automaticamente reinvestido no colateral do cliente.
  - Se for **menor** → o contrato liquida o yield total e debita a diferença residual de forma automatizada.

### Fase 3 — Próximos 12 Meses (Conexão com o Mundo Real / Utilities)

- **Foco:** Contas de Consumo Industriais e Corporativas de Grande Porte.
- **Evolução Técnica:** Parcerias de integração com ERPs corporativos tradicionais e concessionárias de serviços públicos.
- **Caso de Uso Real:** Indústrias, redes de franquias e condomínios alocam o capital flutuante de suas tesourarias em contratos inteligentes para liquidar faturas de energia elétrica, água e telecomunicações perpetuamente, gerando o maior caso de uso de utilidade real e atração de TVL da história da rede Stellar.

---

## 8. Estado de Implementação (30/06/2026)

### 8.1. Implementado e Rodando em Testnet

| Componente | Status | Detalhe |
|---|---|---|
| Autenticação Privy + embedded wallet | ✅ Produção | Login Google; chave fragmentada por SSS |
| Criação automática de conta Stellar | ✅ Produção | `StellarService.ensureAccountFunded` — sponsor cria a conta no primeiro registro de carteira |
| Patrocínio de gas via fee-bump | ✅ Produção | Todas as txs do cliente são embrulhadas em `FeeBumpTransaction` assinada pelo sponsor |
| Depósito no cofre DeFindex | ✅ Testnet | Build XDR → assina no Privy → submete com fee-bump |
| Saque do cofre DeFindex | ✅ Testnet | Espelho do depósito |
| Funding de testnet para depósito | ✅ Testnet | `StellarService.fundClient` — o sponsor envia XLM ao cliente (substituto do On-Ramp no mainnet) |
| Saldo real da carteira on-chain | ✅ Produção | `getNativeBalance` via `getLedgerEntries` na Soroban RPC |
| Valor real do cofre | ✅ Produção | `VaultService.getPositionValue` via DeFindex SDK |
| Ledger financeiro (principal / yield gastável) | ✅ Produção | `spendable = vaultValue − principal` |
| Catálogo de serviços (8 ferramentas) | ✅ Produção | OpenAI, Claude, Midjourney, Notion, Slack, Figma, GitHub, Linear com filtros por categoria |
| CRUD de assinaturas recorrentes | ✅ Produção | Bills por company, com `status` active/paused |
| Snapshot diário (cron) | ✅ Produção | Às 2h UTC, paralelo por company |
| Dashboard Web2 completo | ✅ Produção | MoneyPanel, StatCards, barra de rendimento, catálogo, cartão virtual; bilíngue EN/PT, responsivo |

### 8.2. Especificado e Planejado (Não Implementado)

| Componente | Referência | Bloqueio |
|---|---|---|
| Contrato escrow próprio (Soroban) | `docs/Yield2Pay_Documentacao_Tecnica.md` §4 | Nenhum — próximo passo de engenharia |
| Rampa fiat Etherfuse (BRL↔USDC via PIX) | `docs/superpowers/specs/2026-06-26-etherfuse-ramp-design.md` | Confirmação de sandbox BRL + aprovação de KYB Etherfuse |
| Motor de cobrança automatizado (`claim_yield` no vencimento) | — | Depende do contrato escrow próprio |
| Split de receita 95/5 on-chain | — | Depende do contrato escrow próprio |
| Margem de colateral reativa | — | Depende do motor de cobrança |
| Cálculo pro-rata no cancelamento | — | Depende do contrato escrow próprio |
| Migração para mainnet | `docs/DEPLOY.md` | Rampa fiat + cofre DeFindex financiado em mainnet |
