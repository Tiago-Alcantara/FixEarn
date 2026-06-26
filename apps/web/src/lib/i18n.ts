'use client';

import React, { createContext, useContext, ReactNode } from 'react';

export const dict = {
  en: {
    navHow: 'How it works',
    navServices: 'Services',
    navWhy: 'Why Yield2Pay',
    login: 'Log in',
    getStarted: 'Get started',
    heroTagline: 'Banking, reinvented for software',
    heroTitle: 'Your capital pays for your software. You spend nothing.',
    heroSub: 'Deposit once. We put your capital to work, and the returns cover your AI and SaaS subscriptions — automatically. Your money stays yours.',
    heroCta1: 'Get started',
    heroCta2: 'See how it works',
    cardLabel: 'Capital working',
    cardBalance: '$18,400.00',
    cardReturns: '$214.80',
    cardStatus: 'Active',
    cardYield: '+8.4% / yr',
    cardReturnsLabel: 'Returns / month',
    cardCoveredLabel: 'Covered',
    cardCovered: '7 tools',
    cardName: 'YIELD2PAY BUSINESS',
    cardCovers: 'covers 7 subscriptions',
    howTitle: 'How it works',
    howSub: 'Three simple steps to put your capital to work.',
    benTitle: 'Why businesses choose Yield2Pay',
    benSub: 'Built to keep your tools running without ever touching your cash flow.',
    swTitle: 'Pay for the tools you already use',
    swSub: 'Your returns cover the subscriptions your team relies on.',
    swNote: 'Example integrations',
    trustTitle: 'Security you can rely on',
    finalTitle: 'Put your idle capital to work',
    finalSub: 'Open an account in minutes. Your capital stays yours — your tools stay paid.',
    finalCta: 'Get started',
    footProduct: 'Product',
    footCompany: 'Company',
    footLegal: 'Legal',
    footTagline: 'The bank that pays your software.',
    copyright: '© 2026 Yield2Pay. All rights reserved.',
  },
  pt: {
    navHow: 'Como funciona',
    navServices: 'Serviços',
    navWhy: 'Por que Yield2Pay',
    login: 'Entrar',
    getStarted: 'Começar',
    heroTagline: 'O banco que paga seus softwares',
    heroTitle: 'Seu capital paga seus softwares. Você não gasta nada.',
    heroSub: 'Deposite uma vez. Colocamos seu capital para trabalhar, e o rendimento cobre suas assinaturas de IA e SaaS — automaticamente. Seu dinheiro continua seu.',
    heroCta1: 'Começar agora',
    heroCta2: 'Veja como funciona',
    cardLabel: 'Capital rendendo',
    cardBalance: 'R$ 92.000,00',
    cardReturns: 'R$ 1.074',
    cardStatus: 'Ativo',
    cardYield: '+8,4% / ano',
    cardReturnsLabel: 'Rendimento / mês',
    cardCoveredLabel: 'Cobertas',
    cardCovered: '7 ferramentas',
    cardName: 'YIELD2PAY BUSINESS',
    cardCovers: 'cobre 7 assinaturas',
    howTitle: 'Como funciona',
    howSub: 'Três passos simples para colocar seu capital para trabalhar.',
    benTitle: 'Por que empresas escolhem Yield2Pay',
    benSub: 'Desenvolvido para manter suas ferramentas em funcionamento sem nunca tocar no fluxo de caixa.',
    swTitle: 'Pague pelas ferramentas que você já usa',
    swSub: 'Seus rendimentos cobrem as assinaturas das quais sua equipe depende.',
    swNote: 'Exemplos de integrações',
    trustTitle: 'Segurança em que você pode confiar',
    finalTitle: 'Coloque seu capital ocioso para trabalhar',
    finalSub: 'Abra uma conta em minutos. Seu capital continua seu — suas ferramentas permanecem pagas.',
    finalCta: 'Começar',
    footProduct: 'Produto',
    footCompany: 'Empresa',
    footLegal: 'Legal',
    footTagline: 'O banco que paga seus softwares.',
    copyright: '© 2026 Yield2Pay. Todos os direitos reservados.',
  },
} as const;

type Language = keyof typeof dict;
type TranslationKey = keyof typeof dict['en'];

const LangContext = createContext<{ lang: Language; setLang: (lang: Language) => void } | undefined>(
  undefined,
);

export function LangProvider({ children, initialLang = 'en' }: { children: ReactNode; initialLang?: Language }) {
  const [lang, setLang] = React.useState<Language>(initialLang);
  return React.createElement(
    LangContext.Provider,
    { value: { lang, setLang } },
    children,
  );
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) {
    return {
      lang: 'en' as Language,
      setLang: () => {},
      t: (key: TranslationKey) => dict.en[key],
    };
  }
  const { lang, setLang } = context;
  return {
    lang,
    setLang,
    t: (key: TranslationKey) => dict[lang][key],
  };
}
