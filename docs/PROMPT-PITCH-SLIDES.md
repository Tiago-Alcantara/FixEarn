# Prompt — Gerar Pitch Deck Yield2Pay (HTML/slides)

> Copie o bloco abaixo e cole numa IA de geração (Claude, Gemini, etc.) que produza HTML/slides.
> Ele já carrega o design system real do Yield2Pay e a ordem exata dos 9 slides.

---

## PROMPT

Crie um **pitch deck** para o projeto **Yield2Pay** como um arquivo HTML único, slides em tela cheia (16:9), navegação por teclado (setas) e scroll-snap vertical. Estética **"private bank, digital"**: monocromático preto + prata, superfícies de metal escovado, sem cores vibrantes. Texto enxuto — **no máximo 3 frases por slide** (pode usar mais só se o slide exigir, ex.: business model).

### Design System (use EXATAMENTE estes tokens)

**Cores:**
- Fundo da página: `#0c0d0f` (quase preto)
- Superfícies elevadas: `#131417`, `#16181b`, `#1b1d21`
- Metal escovado (fill de cards/painéis): `linear-gradient(135deg, #3c3f44 0%, #26282c 26%, #16181b 52%, #303338 74%, #1b1d21 100%)`
- Prata accent: `#C0C2C5` · prata brilhante: `#D4D6D9`
- Botão chrome (CTA): `linear-gradient(180deg, #E6E8EA, #A8AAAD)` com texto `#0E0F11`
- Bordas: hairline `#2A2D31`, card `#3a3d42`, metal `#4a4d52`
- Texto: primário `#EDEFF1`, ênfase `#F2F3F4`, secundário/muted `#9A9DA1`, terciário `#8a8d91`

**Tipografia (Google Fonts):**
- Display + body: **Hanken Grotesk** (pesos 400–800)
- Dados/labels/números: **Geist Mono**
- Import: `@import url("https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap");`
- Título hero: `clamp(38px, 5.6vw, 66px)`, peso 700–800, tracking `-0.025em`
- Título de seção: `clamp(30px, 3.4vw, 40px)`
- Eyebrow/kicker: Geist Mono, 12px, `letter-spacing: 0.16em`, UPPERCASE, cor `#9A9DA1`
- Número grande/destaque: Geist Mono, 33px+, cor `#F2F3F4`
- Emboss nos títulos (assinatura metal): `text-shadow: 0 1px 0 rgba(255,255,255,0.13), 0 -1px 1px rgba(0,0,0,0.6);`

**Raios:** cards `18px`, painéis grandes `22px`, CTA slab `26px`, pills `999px`.

**Movimento (sutil, premium):** entradas em fade (sem grande deslocamento vertical); light-sweep diagonal cruzando o metal; float lento. Sempre atrás de `prefers-reduced-motion`.
- Ease padrão: `cubic-bezier(0.2, 0.65, 0.2, 1)`
- Light sweep: `linear-gradient(90deg, transparent, rgba(255,255,255,.26), transparent)` animado translateX -130% → 130%, ~6.5s loop

**Marca:** logo é um losango prata (quadrado rotacionado 45°) com `linear-gradient(135deg,#E6E8EA,#9A9DA1)` e leve glow, ao lado do wordmark "Yield2Pay" em Hanken Grotesk 700.

### Ordem dos slides (siga exatamente)

**Slide 1 — Capa**
- Logo + wordmark "Yield2Pay" centralizado.
- Frase-resumo da solução: *"Seu caixa ocioso paga o seu software. E o caixa continua sendo seu."*
- Sub: "OpEx Zero para o mercado B2B · Rede Stellar (Soroban)".

**Slide 2 — O Problema**
- Eyebrow: "O PROBLEMA".
- Empresas de tecnologia queimam caixa todo mês em SaaS e APIs — dinheiro que sai do balanço e vira despesa pura.
- Ao mesmo tempo, a tesouraria dessas empresas tem caixa parado rendendo abaixo da inflação. Ninguém conecta os dois.

**Slide 3 — A Solução (o processo)**
- Eyebrow: "A SOLUÇÃO".
- A empresa trava um colateral em stablecoin num cofre DeFi; só o rendimento paga as assinaturas; o principal volta 100% via Pix no cancelamento.
- Mostre o fluxo em 3 passos visuais: **1. Deposita colateral → 2. Rendimento paga o SaaS → 3. Principal volta no cancelamento.**
- Fórmula em destaque (Geist Mono): `Colateral = (Mensalidade × 12) / APY`. Ex.: R$ 500/mês a 12% a.a. → R$ 50.000 travados, rendimento cobre o ano, principal intacto.

**Slide 4 — Demo (vídeo)**
- Eyebrow: "DEMO".
- Placeholder de vídeo embed (iframe 16:9 com `[INSERIR_URL_DO_VIDEO]`), moldura em metal escovado com botão play prata.
- Legenda curta: "Veja o fluxo completo: login, depósito e ativação de serviços."

**Slide 5 — Business Model: TAM / SAM / SOM**
- Eyebrow: "MERCADO".
- Três círculos/colunas concêntricos: **TAM** (gasto global B2B em SaaS), **SAM** (startups tech LATAM com caixa ocioso), **SOM** (startups tech Series A/B no Brasil — alvo inicial).
- Deixe os valores como placeholders editáveis: `[TAM: $X bi]`, `[SAM: $Y bi]`, `[SOM: $Z mi]`.

**Slide 6 — Business Model: Nossa Receita**
- Eyebrow: "RECEITA".
- Monetização embutida no contrato: no `claim_yield`, split de **95% para o provedor da API / 5% para a tesouraria Yield2Pay**.
- Cliente não paga mensalidade — só ganhamos quando o colateral rende. Incentivo alinhado.
- Mini-exemplo (Geist Mono): 100 clientes de R$ 500k de colateral a 12% a.a. → ~R$ 300k/ano de receita.

**Slide 7 — Tração e Validação**
- Eyebrow: "TRAÇÃO".
- MVP rodando end-to-end na testnet Stellar: depósito/saque real no cofre DeFindex, conta criada e gas patrocinados, catálogo de 8 serviços ativável.
- Diferencial validado: varredura no Stellar Community Fund mostra que não há concorrente executando isso no ecossistema.
- Use 3–4 "stat cards" em metal: `Testnet ✓ on-chain`, `8 serviços ativos`, `0 taxas de gas p/ usuário`, `100% não-custodial`.

**Slide 8 — O Time**
- Eyebrow: "TIME".
- Cards dos fundadores (avatar circular em gradiente metal, nome, papel) — deixe placeholders `[Nome]`, `[Papel]`, `[1 linha de bio]`.
- Uma frase do porquê esse time resolve isso.

**Slide 9 — Call to Action**
- Slab final em metal escovado, raio 26px.
- Frase forte: *"Yield2Pay transforma caixa ocioso em liquidez perpétua — e devolve à empresa um custo que ela achava perdido."*
- Botão chrome (CTA): "Falar com a gente" + contato `[email / site]`.

### Regras finais

- HTML único, CSS inline ou em `<style>`, zero dependências externas além das Google Fonts.
- Cada slide ocupa 100vh, `scroll-snap-align: center`, navegável por seta ↑↓ e por clique.
- Indicador de progresso discreto (dots prata) na lateral.
- Bilíngue opcional (PT padrão); se fizer toggle EN/PT, espelhe os textos.
- Acessível: `prefers-reduced-motion` desliga sweeps/float; contraste AA no texto.
