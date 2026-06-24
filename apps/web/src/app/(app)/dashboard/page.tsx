'use client';

import React, { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createApi } from '@/lib/api';
import { formatUsdc } from '@/lib/money';
import type { SpendableView } from '@fixearn/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bill {
  id: string;
  vendor: string;
  monthlyCost: string;
  type: string;
  status: string;
}

// ── i18n dictionary (dashboard-specific, mirrors the reference HTML) ──────────

const T = {
  en: {
    nav: {
      overview: 'Overview',
      deposit: 'My deposit',
      services: 'Services',
      card: 'Virtual card',
      transactions: 'Transactions',
      settings: 'Settings',
    },
    logout: 'Log out',
    greeting: 'Welcome back, Acme',
    greetingSub: 'Your capital is working. Returns are covering your tools.',
    capitalTitle: 'Your deposit',
    capitalLabel: 'Total capital',
    capitalSub: 'Your money, always',
    returnsTitle: 'Monthly returns',
    returnsLabel: 'Generated this month',
    spendableTitle: 'Available to spend',
    spendableLabel: 'After active subscriptions',
    spendableSub: 'Unused returns are reinvested',
    apyLabel: 'Annual yield',
    barTitle: 'Your returns at a glance',
    committedLabel: 'Committed',
    availableLabel: 'Available',
    totalLabel: 'Total monthly return',
    servicesTitle: 'Registered subscriptions',
    servicesSub: 'Bills covered by your returns.',
    tabs: { all: 'All', software: 'Software', utility: 'Utility', other: 'Other' },
    activeBadge: 'Active',
    loading: 'Loading…',
    error: 'Error loading dashboard.',
    noServices: 'No subscriptions found.',
  },
  pt: {
    nav: {
      overview: 'Visão geral',
      deposit: 'Meu aporte',
      services: 'Serviços',
      card: 'Cartão virtual',
      transactions: 'Transações',
      settings: 'Configurações',
    },
    logout: 'Sair',
    greeting: 'Bem-vindo, Acme',
    greetingSub: 'Seu capital está rendendo. O rendimento cobre suas ferramentas.',
    capitalTitle: 'Seu aporte',
    capitalLabel: 'Capital total',
    capitalSub: 'Sempre seu',
    returnsTitle: 'Rendimento mensal',
    returnsLabel: 'Gerado este mês',
    spendableTitle: 'Disponível para usar',
    spendableLabel: 'Após assinaturas ativas',
    spendableSub: 'A sobra é reinvestida',
    apyLabel: 'Rendimento anual',
    barTitle: 'Seu rendimento de relance',
    committedLabel: 'Comprometido',
    availableLabel: 'Disponível',
    totalLabel: 'Rendimento mensal total',
    servicesTitle: 'Assinaturas registradas',
    servicesSub: 'Contas cobertas pelo seu rendimento.',
    tabs: { all: 'Todos', software: 'Software', utility: 'Utilidade', other: 'Outros' },
    activeBadge: 'Ativo',
    loading: 'Carregando…',
    error: 'Erro ao carregar o painel.',
    noServices: 'Nenhuma assinatura encontrada.',
  },
} as const;

type Lang = keyof typeof T;

// ── Nav icons (SVG, copied from reference) ────────────────────────────────────

function IconOverview() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}
function IconDeposit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M4 19h16" />
    </svg>
  );
}
function IconServices() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="3.2" />
      <circle cx="17" cy="7" r="3.2" />
      <circle cx="7" cy="17" r="3.2" />
      <circle cx="17" cy="17" r="3.2" />
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 9.5h18" />
    </svg>
  );
}
function IconTransactions() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h9" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 16l4-4-4-4" />
      <path d="M14 12H4" />
    </svg>
  );
}

const NAV_ITEMS: Array<{ id: string; icon: React.ReactNode; key: keyof typeof T['en']['nav'] }> = [
  { id: 'overview', icon: <IconOverview />, key: 'overview' },
  { id: 'deposit', icon: <IconDeposit />, key: 'deposit' },
  { id: 'services', icon: <IconServices />, key: 'services' },
  { id: 'card', icon: <IconCard />, key: 'card' },
  { id: 'transactions', icon: <IconTransactions />, key: 'transactions' },
  { id: 'settings', icon: <IconSettings />, key: 'settings' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  label,
  sub,
  silver = false,
}: {
  title: string;
  value: string;
  label: string;
  sub: string;
  silver?: boolean;
}) {
  return (
    <div
      style={{
        background: '#1A1C1F',
        border: '1px solid #2A2D31',
        borderRadius: 18,
        padding: 24,
      }}
    >
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: '#9A9DA1',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 32,
          fontWeight: 600,
          color: silver ? '#C0C2C5' : '#F2F3F4',
          marginTop: 14,
          letterSpacing: '.01em',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 13.5, color: '#9A9DA1', marginTop: 8 }}>{label}</div>
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          color: '#C0C2C5',
          marginTop: 6,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function BillCard({ bill, activeBadge }: { bill: Bill; activeBadge: string }) {
  const initial = bill.vendor.slice(0, 2).toUpperCase();
  const isActive = bill.status === 'active';

  return (
    <div
      style={{
        position: 'relative',
        background: '#1A1C1F',
        borderRadius: 16,
        padding: 22,
        border: `1px solid ${isActive ? '#6a6d72' : '#2A2D31'}`,
        boxShadow: isActive ? '0 0 0 1px rgba(192,194,197,.25), 0 14px 34px rgba(0,0,0,.35)' : 'none',
        transition: 'border-color .25s ease, transform .25s ease, box-shadow .25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(160deg,#43464b,#1b1d21)',
            border: '1px solid #4a4d52',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 15,
            fontWeight: 600,
            color: '#D4D6D9',
          }}
        >
          {initial}
        </span>
        {isActive && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: '#D4D6D9',
              border: '1px solid #4a4d52',
              borderRadius: 999,
              padding: '3px 9px',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#D4D6D9',
                boxShadow: '0 0 6px rgba(212,214,217,.8)',
              }}
            />
            {activeBadge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#F2F3F4', marginTop: 16 }}>
        {bill.vendor}
      </div>
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 13,
          color: '#9A9DA1',
          marginTop: 4,
        }}
      >
        {formatUsdc(bill.monthlyCost)}/mo
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 18,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? '#C0C2C5' : '#9A9DA1' }}>
          {isActive ? activeBadge : 'Inactive'}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { getAccessToken } = usePrivy();
  const api = createApi(getAccessToken);

  const [lang, setLang] = useState<Lang>('en');
  const [nav, setNav] = useState('overview');
  const [tab, setTab] = useState('all');

  const [dashboard, setDashboard] = useState<SpendableView | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = T[lang];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([api.getDashboard(), api.listBills()])
      .then(([dash, billList]) => {
        if (cancelled) return;
        setDashboard(dash);
        setBills(billList as Bill[]);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEn = lang === 'en';

  // Tab filter for bills
  const visibleBills =
    tab === 'all' ? bills : bills.filter((b) => b.type === tab);

  const tabOrder: Array<{ id: string; label: string }> = [
    { id: 'all', label: t.tabs.all },
    { id: 'software', label: t.tabs.software },
    { id: 'utility', label: t.tabs.utility },
    { id: 'other', label: t.tabs.other },
  ];

  const tabBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all .2s ease',
  };

  const langTabBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '.03em',
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: '#0E0F11',
          color: '#9A9DA1',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Geist Mono', monospace",
          fontSize: 14,
        }}
      >
        {t.loading}
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: '#0E0F11',
          color: '#F2F3F4',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <span style={{ color: '#ff6b6b', fontSize: 16 }}>{t.error}</span>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#9A9DA1' }}>
          {error}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#0E0F11',
        color: '#F2F3F4',
        fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        style={{
          flex: '0 0 240px',
          background: '#16181B',
          borderRight: '1px solid #2A2D31',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 14px',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Brand */}
        <a
          href="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            padding: '6px 10px 22px',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)',
              transform: 'rotate(45deg)',
              borderRadius: 2,
              boxShadow: '0 0 12px rgba(192,194,197,.35)',
            }}
          />
          <span
            style={{
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: '-.01em',
              color: '#F2F3F4',
            }}
          >
            FixEarn
          </span>
        </a>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV_ITEMS.map((item) => {
            const on = nav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setNav(item.id)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 10,
                  padding: '11px 12px',
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  fontWeight: on ? 600 : 500,
                  color: on ? '#F2F3F4' : '#9A9DA1',
                  background: on ? '#1f2226' : 'transparent',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: '0 3px 3px 0',
                    background: on ? '#C0C2C5' : 'transparent',
                  }}
                />
                <span style={{ display: 'flex', color: on ? '#F2F3F4' : '#9A9DA1' }}>
                  {item.icon}
                </span>
                <span>{t.nav[item.key]}</span>
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '12px 10px',
            borderTop: '1px solid #2A2D31',
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(160deg,#43464b,#1b1d21)',
              border: '1px solid #4a4d52',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Geist Mono', monospace",
              fontSize: 12,
              color: '#D4D6D9',
            }}
          >
            AC
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: 13.5,
                fontWeight: 600,
                color: '#F2F3F4',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Acme Ltda.
            </span>
            <span
              style={{
                display: 'block',
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10.5,
                color: '#9A9DA1',
              }}
            >
              Business
            </span>
          </span>
          <button
            aria-label={t.logout}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9A9DA1',
              display: 'flex',
              padding: 4,
            }}
          >
            <IconLogout />
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '20px 32px',
            borderBottom: '1px solid #2A2D31',
            position: 'sticky',
            top: 0,
            background: 'rgba(14,15,17,.82)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            zIndex: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-.015em',
                color: '#F2F3F4',
              }}
            >
              {t.greeting}
            </div>
            <div style={{ fontSize: 13.5, color: '#9A9DA1', marginTop: 2 }}>{t.greetingSub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Language switcher */}
            <div
              role="group"
              aria-label="Language"
              style={{
                display: 'inline-flex',
                border: '1px solid #2A2D31',
                borderRadius: 999,
                padding: 3,
                gap: 2,
                background: '#16181B',
              }}
            >
              <button
                onClick={() => setLang('en')}
                aria-pressed={isEn}
                style={{
                  ...langTabBase,
                  background: isEn ? '#2E3136' : 'transparent',
                  color: isEn ? '#F2F3F4' : '#9A9DA1',
                }}
              >
                EN
              </button>
              <button
                onClick={() => setLang('pt')}
                aria-pressed={!isEn}
                style={{
                  ...langTabBase,
                  background: !isEn ? '#2E3136' : 'transparent',
                  color: !isEn ? '#F2F3F4' : '#9A9DA1',
                }}
              >
                PT
              </button>
            </div>

            {/* Avatar */}
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'linear-gradient(160deg,#43464b,#1b1d21)',
                border: '1px solid #4a4d52',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Geist Mono', monospace",
                fontSize: 12,
                color: '#D4D6D9',
              }}
            >
              AC
            </span>
          </div>
        </header>

        {/* Body */}
        <div
          style={{
            padding: 32,
            maxWidth: 1180,
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* ── Stat panels ─────────────────────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
              gap: 16,
            }}
          >
            {/* Capital working (vaultValue) */}
            <StatCard
              title={t.capitalTitle}
              value={formatUsdc(dashboard!.vaultValue)}
              label={t.capitalLabel}
              sub={t.capitalSub}
            />

            {/* Spendable / returns */}
            <StatCard
              title={t.spendableTitle}
              value={formatUsdc(dashboard!.spendable)}
              label={t.spendableLabel}
              sub={t.spendableSub}
              silver
            />

            {/* APY */}
            <div
              style={{
                background: '#1A1C1F',
                border: '1px solid #2A2D31',
                borderRadius: 18,
                padding: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: '#9A9DA1',
                }}
              >
                {t.apyLabel}
              </div>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#C0C2C5',
                  marginTop: 14,
                  letterSpacing: '.01em',
                }}
              >
                {dashboard!.apyPercent}%
              </div>
              <div style={{ fontSize: 13.5, color: '#9A9DA1', marginTop: 8 }}>
                {t.returnsLabel}
              </div>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 12,
                  color: '#C0C2C5',
                  marginTop: 6,
                }}
              >
                {t.returnsTitle}
              </div>
            </div>
          </div>

          {/* ── Subscriptions list ───────────────────────────────────────── */}
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '-.015em',
                    color: '#F2F3F4',
                    margin: 0,
                  }}
                >
                  {t.servicesTitle}
                </h2>
                <p style={{ fontSize: 14.5, color: '#9A9DA1', margin: '7px 0 0' }}>
                  {t.servicesSub}
                </p>
              </div>

              {/* Category tabs */}
              <div
                style={{
                  display: 'inline-flex',
                  border: '1px solid #2A2D31',
                  borderRadius: 999,
                  padding: 3,
                  gap: 2,
                  background: '#16181B',
                }}
              >
                {tabOrder.map(({ id, label }) => {
                  const on = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      style={{
                        ...tabBase,
                        background: on ? '#2E3136' : 'transparent',
                        color: on ? '#F2F3F4' : '#9A9DA1',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bill cards grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))',
                gap: 16,
                marginTop: 20,
              }}
            >
              {visibleBills.length === 0 ? (
                <p style={{ color: '#9A9DA1', fontSize: 14, gridColumn: '1/-1' }}>
                  {t.noServices}
                </p>
              ) : (
                visibleBills.map((bill) => (
                  <BillCard key={bill.id} bill={bill} activeBadge={t.activeBadge} />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
