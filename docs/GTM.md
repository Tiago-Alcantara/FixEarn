# Yield2Pay — Estratégia Go-to-Market

> Versão inicial: 30/06/2026. Revisitar a cada trimestre ou após cada rodada de validação com clientes.

---

## 1. Tese de Posicionamento

**Para quem:** CFOs, diretores financeiros e fundadores de startups tech com caixa ocioso e pilha de SaaS crescendo.

**O problema que resolvemos:** Software vira despesa pura. O dinheiro sai do balanço e nunca volta.

**O que entregamos:** OpEx Zero — o yield do caixa da empresa paga as ferramentas. O principal fica intacto e voltará via Pix se o cliente cancelar.

**Por que agora:** A infraestrutura Web2.5 (Privy + DeFindex + Stellar) chegou ao ponto em que isso funciona sem pedir que o cliente entenda blockchain.

**Posição única:** Nenhum produto no mercado faz isso — nem no ecossistema Stellar, nem fora dele.

---

## 2. Segmentos-Alvo (ICP — Ideal Customer Profile)

### ICP Primário — Startups tech Series A/B (Brasil)

| Atributo | Critério |
|---|---|
| Tamanho | 20–200 funcionários |
| Receita | R$ 2M–50M ARR |
| Caixa ocioso | R$ 200k–5M parado em CDB/LFT abaixo do CDI |
| Pilha SaaS mensal | R$ 5k–80k/mês em DevTools, IA e produtividade |
| Decisor | CFO, Head of Finance ou cofundador com papel financeiro |
| Sinal de compra | Stack com OpenAI, AWS, Vercel, Anthropic — e RD (reunião com investidor) |

**Por que esse segmento primeiro:**
- Dor validada: eles já têm caixa e já gastam muito em SaaS.
- Sofisticação mínima para aceitar o modelo sem precisar de 6 meses de education.
- Ciclo de vendas curto: decisor acessível, verba de software aprovada em nível de gerência.

### ICP Secundário — Scale-ups e empresas de médio porte (Brasil/LATAM)

Mesmas características mas com tesouraria maior (R$ 5M–50M). Ciclo de vendas mais longo (envolve jurídico e compliance), mas ACV muito mais alto. Endereçar no Trimestre 2 com apoio de um parceiro contábil/financeiro.

### ICP a Evitar (por ora)

- Empresas com caixa abaixo de R$ 100k (retorno insuficiente para cobrir qualquer assinatura relevante).
- Empresas tradicionais sem pilha SaaS expressiva (baixo spend = baixo colateral mínimo = baixo LTV).
- Crypto-native (seriam early adopters mas não a massa crítica do mercado).

---

## 3. Proposta de Valor por Persona

### Para o CFO / Head of Finance

> "Você trava R$ 50k em caixa e paga R$ 500/mês de API para sempre, sem tocar o principal. No cancelamento, os R$ 50k voltam via Pix. É como transformar uma despesa recorrente num depósito que você sempre pode resgatar."

- Eficiência tributária: colateral é ativo, não despesa.
- Preservação de capital: principal intacto.
- Nenhuma exposição a cripto do ponto de vista do balanço: entrada e saída em BRL via Pix.

### Para o CTO / Eng Lead (champion técnico)

> "O time de engenharia continua usando as mesmas APIs. Só muda quem paga — e o pagamento saiu do orçamento para o yield do caixa da empresa."

- Zero mudança no stack técnico.
- As chaves de API continuam ativas enquanto o colateral estiver no cofre.
- Dashboard de visibilidade: qual % do yield está comprometido com quais ferramentas.

### Para o CEO / Fundador

> "Você para de queimar caixa em software e transforma essa saída de dinheiro num capital que sempre fica com você."

- Narrativa de eficiência de caixa para o board.
- Modelo de custo previsível.
- Diferencial competitivo se o concorrente ainda queima SaaS como despesa pura.

---

## 4. Canais de Aquisição

### Fase 1 — 0 a 50 clientes (Founder-led sales, validação manual)

| Canal | Tática | Meta |
|---|---|---|
| Rede pessoal / warm intros | Founder liga diretamente para 3–5 CFOs conhecidos ou via indicação de investidor | 5–10 pilotos gratuitos |
| Comunidades de startups | YC Alumni BR, All-In Startups, Startups LTDA, grupos de WhatsApp de CFOs | 20 conversas qualificadas |
| LinkedIn do founder | Posts semanais com a tese "seu caixa paga seu SaaS" + cases reais dos pilotos | 500 seguidores relevantes |
| Parceiros contábeis | 2–3 escritórios de contabilidade para startups (ex: Contabilidade para Startups, Finpartner) | Referral de clientes |

**O que NÃO fazer nessa fase:** ads pagos, inbound de marketing de conteúdo em escala, press release. Foco em fechar os primeiros 10 clientes com ciclo de vendas < 30 dias.

### Fase 2 — 50 a 500 clientes (Produto-led + parceiros)

| Canal | Tática |
|---|---|
| Integração com plataformas de gestão financeira (ex: Conta Simples, Cora, Stark Bank) | Yield2Pay como feature de "rentabilizar o caixa e pagar SaaS" dentro do app do banco |
| Programa de parceiros contábeis | Contadores recomendam para carteira de clientes startup em troca de % da receita |
| SEO / Content | "Como pagar menos em SaaS" — conteúdo para CFO e fundador, capturando intent de custo |
| Produto-led growth | Calculadora pública: "Cole sua pilha de SaaS e veja quanto caixa você precisa travar" |

### Fase 3 — 500+ clientes (Escala)

- Parcerias com VCs: integrar Yield2Pay como benefício padrão do portfólio.
- Expansão LATAM: México (via Etherfuse nativo), Colômbia, Argentina.
- Whitelabel para bancos digitais que queiram oferecer "SaaS pago pelo yield" como produto.

---

## 5. Modelo de Precificação e Monetização

### Para o cliente final

**Gratuito.** O cliente não paga mensalidade nem taxa de uso à plataforma. O yield do cofre paga as assinaturas; o cliente recupera 100% do principal no cancelamento.

### Para o Yield2Pay (receita da plataforma)

**5% do yield gerado**, deduzido automaticamente no `claim_yield` (split on-chain: 95% provedor da API / 5% Yield2Pay).

O modelo alinha completamente os incentivos: Yield2Pay só ganha se o colateral do cliente render. Não há custo fixo para o cliente.

### Exemplo de unit economics

| Cenário | Colateral | Yield anual (12% a.a.) | Fee Y2P (5%) | Receita Y2P/ano |
|---|---|---|---|---|
| Startup pequena | R$ 50k | R$ 6.000 | R$ 300 | R$ 300 |
| Startup média | R$ 500k | R$ 60.000 | R$ 3.000 | R$ 3.000 |
| Scale-up | R$ 5M | R$ 600.000 | R$ 30.000 | R$ 30.000 |

Com 100 clientes de porte médio (R$ 500k de colateral cada), a receita anual seria **R$ 300k**. Com 1.000 clientes, **R$ 3M/ano** — sem custo marginal relevante por cliente (o contrato on-chain faz o split).

### Alavancas de crescimento de receita

- **TVL**: mais colateral = mais yield = mais fee.
- **Novos serviços no catálogo**: ampliar o leque de ferramentas aumenta o comprometimento de yield por cliente (e o colateral mínimo necessário).
- **Pay-as-you-go (Fase 2)**: cobranças variáveis terão colateral dinâmico, potencialmente 3–5× maior.

---

## 6. Estratégia de Entrada no Mercado (18 meses)

### Trimestre 1–2 (Jul–Dez 2026) — Validação

**Objetivo:** 10 clientes pagando (colateral real em mainnet), NPS > 50.

- Lançar mainnet com rampa Etherfuse (PIX → USDC).
- Onboarding manual: founder acompanha cada cliente na primeira ativação.
- Medir: taxa de conversão piloto → cliente ativo, tempo de onboarding, ticket médio de colateral.
- Artefatos a produzir: deck para CFOs, calculadora de colateral público, 3 case studies.

### Trimestre 3–4 (Jan–Jun 2027) — Tração

**Objetivo:** 100 clientes ativos, R$ 5M em TVL.

- Lançar programa de parceiros (2–3 contabilidades para startups).
- Produto-led: fluxo de cadastro self-serve (sem onboarding manual).
- Expandir catálogo para 20+ serviços, incluindo AWS, Vercel, Stripe.
- Iniciar conversas com 1–2 bancos digitais para integração whitelabel.

### Trimestre 5–6 (Jul–Dez 2027) — Escala

**Objetivo:** 500 clientes ativos, R$ 25M em TVL, expansão LATAM.

- Lançar Fase 2: cobranças variáveis (pay-as-you-go).
- Primeiro cliente de grande porte (R$ 1M+ de colateral).
- Pipeline de parceria com banco digital fechado.
- Expansão México: parceria com Etherfuse para corredor MXN.

---

## 7. Objeções Comuns e Como Responder

| Objeção | Resposta |
|---|---|
| "Não entendo de cripto / blockchain." | "Você não precisa. A experiência é idêntica a um app de banco: login Google, Pix para depositar, Pix para resgatar. A blockchain fica invisível." |
| "Meu dinheiro está seguro?" | "O contrato é imutável e não tem chave administrativa — nem nós conseguimos mover seu dinheiro. É o mesmo princípio de um escrow tradicional, mas auditável por qualquer pessoa na blockchain." |
| "E se o rendimento cair e não cobrir minha mensalidade?" | "O protocolo avisa antes do vencimento. Se o yield não cobrir, você escolhe: complementar a diferença via Pix ou pausar a assinatura temporariamente. O principal nunca é usado." |
| "E se eu precisar do dinheiro de volta urgente?" | "O resgate leva o mesmo tempo de um Pix. Você cancela no dashboard, o contrato devolve o principal, e o Pix cai em até 1 dia útil." |
| "Por que não usar um fundo de renda fixa e pagar o SaaS manual?" | "Você pode. Mas aí você lembra de pagar todo mês, negocia com cada fornecedor, e o dinheiro ainda sai do balanço todo mês. Com o Yield2Pay, o yield paga automaticamente, e o dinheiro nunca sai — ele só rende e volta." |
| "Tem regulação? É legal no Brasil?" | "Sim. Não tocamos em BRL — a conversão é feita pela Etherfuse, que opera como Instituição de Pagamento regulada pelo Banco Central. O protocolo on-chain funciona como escrow — sem intermediação financeira da nossa parte." |

---

## 8. Métricas de Sucesso (North Star e Secundárias)

| Métrica | North Star? | Definição |
|---|---|---|
| TVL (Total Value Locked) | ✅ | Soma do colateral ativo de todos os clientes |
| Clientes ativos | Secundária | Empresas com pelo menos 1 assinatura ativa e colateral depositado |
| Yield gerado (mensal) | Secundária | Soma do rendimento distribuído — proxy da receita do ecossistema |
| Receita Y2P (5% fee) | Secundária | Receita real da plataforma |
| Tempo de onboarding | Saúde | Minutos entre cadastro e primeiro depósito confirmado |
| NPS | Saúde | Net Promoter Score dos clientes ativos |
| Churn de colateral | Saúde | % do TVL retirado no mês (cancelamentos) |

**Meta de 12 meses:** R$ 5M em TVL, 100 clientes ativos, < 5% churn mensal de colateral.
