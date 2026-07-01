# Yield2Pay — Guia do Usuário

> Para empresas de tecnologia que querem pagar suas ferramentas com o rendimento do próprio caixa.

---

## O que é o Yield2Pay?

O Yield2Pay é uma plataforma que permite à sua empresa pagar assinaturas de SaaS e APIs usando o **rendimento** do seu caixa ocioso — sem nunca gastar o principal.

**Como funciona em uma frase:** você deposita um colateral em stablecoin, esse colateral rende juros, e os juros pagam suas ferramentas automaticamente. Quando quiser sair, o colateral volta 100% para você via Pix.

Não é necessário entender de criptomoedas. O login é com Google, o depósito é via Pix, e o resgate também.

---

## Primeiros Passos

### 1. Criar conta

1. Acesse a plataforma e clique em **"Get started"** (ou "Começar").
2. Faça login com sua conta Google corporativa.
3. Uma carteira digital é criada automaticamente para a sua empresa — nenhuma extensão de navegador, nenhuma seed phrase.

> **Nota:** Sua conta Stellar é criada e financiada automaticamente pela plataforma. Você não precisa comprar XLM nem pagar taxas de rede.

---

### 2. Entender o dashboard

Após o login, você vê o **Dashboard**, dividido em painéis:

#### Painel de capital (MoneyPanel)

Mostra três valores em tempo real:

| Campo | O que significa |
|---|---|
| **Saldo da carteira** | USDC disponível na sua carteira, ainda não depositado no cofre |
| **Valor no cofre** | Capital já alocado no cofre DeFindex, rendendo ativamente |
| **APY** | Taxa de rendimento anual do cofre (atualizada em tempo real) |

#### Cards de resumo

- **Seus ativos** — total (carteira + cofre).
- **Rendimento mensal** — quanto o cofre gerou desde o último período; compara com o mês anterior.
- **Disponível para usar** — yield já gerado menos o que está comprometido com assinaturas ativas.

#### Barra de rendimento

Mostra o % do rendimento mensal já comprometido com assinaturas. O que sobrar fica disponível para uso futuro ou reinvestimento.

---

### 3. Fazer um depósito

O depósito coloca capital no cofre DeFindex, que passa a render e a pagar suas assinaturas.

**Passo a passo:**

1. No dashboard, clique em **"Deposit via PIX"** (ou use o botão no MoneyPanel).
2. Escolha um valor ou digite o montante desejado.
3. O sistema gera um QR Code Pix. Pague pelo app do seu banco.
4. Assim que o pagamento for confirmado, o USDC cai na sua carteira automaticamente.
5. Clique em **"Depositar no cofre"** para mover o USDC para o cofre DeFindex.
6. Confirme a transação no popup (uma assinatura digital com sua conta Google — não é senha, é criptografia invisível).

> **Quanto depositar?** Use a fórmula: `Colateral = (mensalidade × 12) / APY`. Para uma assinatura de R$ 500/mês com APY de 12%, você precisa de R$ 50.000 em colateral. O sistema calcula isso para você na tela de ativação de serviços.

---

### 4. Ativar serviços

Os serviços são as ferramentas que o rendimento do seu cofre vai pagar.

**Passo a passo:**

1. No dashboard, vá até **"Available services"** (ou "Serviços disponíveis").
2. Use as abas para filtrar por categoria: **Todos / IA / Produtividade / Dev**.
3. Clique em **"Activate"** no serviço que deseja ativar.
4. A plataforma verifica se o seu rendimento disponível cobre o custo mensal.
5. Se sim, a assinatura é criada e começa a contar.
6. Para desativar, clique em **"Deactivate"** na mesma grade.

**Serviços disponíveis no catálogo atual:**

| Serviço | Categoria | Custo mensal (USDC) |
|---|---|---|
| OpenAI | IA | $49.90 |
| Anthropic Claude | IA | $99.00 |
| Midjourney | IA | $59.00 |
| Notion | Produtividade | $24.90 |
| Slack | Produtividade | $9.50 |
| Figma | Produtividade | $39.90 |
| GitHub | Dev | $21.00 |
| Linear | Dev | $16.00 |

> O catálogo é expandido regularmente. Precisa de um serviço que não está na lista? Entre em contato com o suporte.

---

### 5. Acompanhar rendimentos

O painel **"Your returns at a glance"** mostra:

- **Comprometido** — quanto do rendimento mensal já vai para assinaturas ativas.
- **Disponível** — rendimento excedente (não alocado).
- **Total mensal** — rendimento bruto do período.

O cofre faz snapshot diário do estado. O histórico completo estará disponível na aba **Transações** (em breve).

---

### 6. Fazer um saque

Se quiser retirar capital do cofre (parcial ou total):

1. No MoneyPanel, clique em **"Withdraw"**.
2. Digite o valor em USDC que deseja sacar.
3. Confirme a transação.
4. O USDC volta para sua carteira.
5. Para converter para BRL via Pix, use o fluxo de Off-Ramp (disponível em breve com a integração Etherfuse).

> **Atenção:** saques parciais reduzem o rendimento mensal. Se o rendimento cair abaixo do total das suas assinaturas ativas, você receberá uma notificação para ajustar o colateral ou pausar serviços.

---

## Perguntas Frequentes

### O meu dinheiro está seguro?

Sim. O cofre DeFindex é um contrato inteligente imutável na rede Stellar — sem chave administrativa. Nem a Yield2Pay, nem nenhum parceiro, pode mover o seu dinheiro sem a sua autorização. Cada transação exige a sua assinatura digital.

### Preciso entender de cripto?

Não. O login é com Google, o depósito é via Pix, e o resgate também. A blockchain fica completamente invisível para você.

### Quanto custa usar o Yield2Pay?

O cliente não paga nada. A plataforma retém 5% do rendimento gerado como taxa — os outros 95% pagam os provedores dos serviços. Se o cofre não render, a plataforma não recebe nada.

### E se o rendimento não cobrir minha mensalidade?

Se o APY cair e o rendimento do mês não cobrir todas as assinaturas ativas, você receberá uma notificação. Você pode: (a) depositar mais colateral, (b) pausar serviços de menor prioridade, ou (c) complementar a diferença via Pix. O principal nunca é usado para cobrir mensalidades.

### Quando quero sair, quanto tempo leva para receber meu dinheiro de volta?

O saque do cofre é confirmado em minutos na blockchain. A conversão para BRL e o envio via Pix dependem do parceiro bancário (Etherfuse) e levam até 1 dia útil. O processo inteiro é iniciado por você no dashboard — sem formulários nem contato com suporte.

### Qual é o depósito mínimo?

Depende das assinaturas que você quer ativar. A fórmula é `Colateral mínimo = (custo mensal total × 12) / APY`. Com o APY atual e uma assinatura de ~R$ 50/mês, o mínimo é ~R$ 5.000. Para assinaturas mais caras, o mínimo sobe proporcionalmente.

### O Yield2Pay é regulado?

A plataforma não toca em dinheiro fiduciário (BRL). A conversão PIX ↔ USDC é feita pela Etherfuse, que opera como Instituição de Pagamento regulada pelo Banco Central. O protocolo on-chain funciona como escrow — sem intermediação financeira pela Yield2Pay.

---

## Glossário

| Termo | Significado |
|---|---|
| **Colateral** | O capital que você deposita no cofre. Nunca é gasto — só rende. |
| **Cofre (vault)** | Contrato inteligente DeFindex onde o colateral fica alocado e rendendo. |
| **Yield / Rendimento** | Os juros gerados pelo cofre a cada período. |
| **APY** | Annual Percentage Yield — taxa de rendimento anual do cofre. |
| **Spendable** | Rendimento disponível: yield acumulado menos o que já está comprometido com assinaturas. |
| **Principal** | O colateral original depositado. Volta 100% no cancelamento. |
| **Fee-bump** | Mecanismo pelo qual a Yield2Pay paga as taxas de transação na rede Stellar. Você nunca paga gas. |
| **USDC** | Stablecoin 1:1 com o dólar americano, usada como colateral no protocolo. |
| **Pix** | Sistema de pagamento instantâneo brasileiro — usado para entrada (depósito) e saída (resgate) de capital. |

---

## Suporte

Encontrou um problema ou tem dúvidas que não estão aqui?

- **Email:** suporte@yield2pay.com
- **Dashboard:** botão "Ajuda" no canto inferior do menu lateral (em breve).
