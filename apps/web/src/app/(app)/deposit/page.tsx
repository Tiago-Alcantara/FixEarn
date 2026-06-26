'use client';

import React, { useState } from 'react';
import { MetalCard } from '@/components/MetalCard';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
import { BrandHeader } from '@/components/BrandHeader';
import { TxResultCard } from '@/components/TxResultCard';
import { TxErrorBox } from '@/components/TxErrorBox';
import { useStellarTx } from '@/lib/useStellarTx';
import { toBaseUnits } from '@/lib/money';
import { validateAmount } from '@/lib/validateAmount';
import { getErrorMessage } from '@/lib/errors';
import { useIsMobile } from '@/lib/useIsMobile';

// ── Tools list (reference: design/ui_kits/yield2pay-deposit/index.html) ────────
const TOOLS: [string, number][] = [
  ['OpenAI', 20],
  ['Anthropic', 20],
  ['Notion', 16],
  ['Figma', 12],
  ['GitHub', 21],
  ['Linear', 8],
  ['Slack', 15],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Step indicator ────────────────────────────────────────────────────────────
const STEP_LABELS = ['Deposit', 'Tools', 'Confirm'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 22,
        fontFamily: 'var(--fx-font-mono)',
        fontSize: 11,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
      }}
    >
      {STEP_LABELS.map((s, i) => (
        <React.Fragment key={s}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              color: i <= current ? 'var(--fx-silver-bright)' : 'var(--fx-text-3)',
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: i <= current ? '1px solid transparent' : '1px solid var(--fx-border-metal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                background: i <= current ? 'var(--fx-chrome)' : 'transparent',
                color: i <= current ? '#0E0F11' : 'inherit',
              }}
            >
              {i < current ? '✓' : i + 1}
            </span>
            {s}
          </span>
          {i < 2 && (
            <span
              style={{ width: 22, height: 1, background: 'var(--fx-border)', display: 'inline-block' }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Quick-select chips ────────────────────────────────────────────────────────
const CHIPS = [5000, 10000, 18400, 20000];

// ── Row + Divider ─────────────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 0',
      }}
    >
      <span style={{ color: 'var(--fx-text-2)', fontSize: 14 }}>{label}</span>
      <span style={{ fontFamily: 'var(--fx-font-mono)', color: 'var(--fx-text)' }}>{value}</span>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ height: 1, background: 'var(--fx-border)', margin: '0' }} />
  );
}

// ── Currency select (reference: <Select label="Currency" options={['USD','BRL']}/>) ──
const CURRENCIES = ['USD', 'BRL'];

function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const mono = 'var(--fx-font-mono)';
  return (
    <label style={{ display: 'block', width: 120 }}>
      <span
        style={{
          display: 'block',
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--fx-text-3)',
          marginBottom: 8,
        }}
      >
        Currency
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--fx-surface-2)',
          border: '1px solid var(--fx-border)',
          borderRadius: 'var(--fx-radius-md)',
          padding: '12px 14px',
        }}
      >
        <select
          aria-label="Currency"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--fx-text)',
            fontFamily: mono,
            fontSize: 16,
            cursor: 'pointer',
            appearance: 'none',
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c} style={{ background: 'var(--fx-surface-2)', color: 'var(--fx-text)' }}>
              {c}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DepositPage() {
  const { deposit } = useStellarTx();
  const isMobile = useIsMobile();

  const [step, setStep] = useState(0);
  const [amountRaw, setAmountRaw] = useState('18400');
  const [touched, setTouched] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TOOLS.map(([name]) => [name, true])),
  );
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountNum = parseFloat(amountRaw) || 0;
  const monthly = amountNum * 0.084 / 12;
  const pickedTotal = TOOLS.filter(([name]) => picked[name]).reduce((s, [, cost]) => s + cost, 0);
  const validationError = validateAmount(amountRaw);
  const isValid = validationError === null;

  async function handleConfirm() {
    setSubmitting(true);
    setTxError(null);
    try {
      const baseUnits = toBaseUnits(amountRaw);
      const hash = await deposit(baseUnits);
      setTxHash(hash);
    } catch (err) {
      setTxError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (txHash) {
    return (
      <TxResultCard
        title="Deposit confirmed!"
        subtitle="Your capital is now working for you."
        txHash={txHash}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? '24px 12px' : '48px 24px',
      }}
    >
      <div style={{ width: 520, maxWidth: '100%' }}>
        {/* Brand */}
        <BrandHeader />

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Card */}
        <MetalCard sweep="loop" padding={0} radius="var(--fx-radius-2xl)"
          style={{ border: '1px solid var(--fx-border-metal)', boxShadow: 'var(--fx-elev-hero)' }}
        >
          <div style={{ padding: 30 }}>

            {/* ── Step 0: Amount ─────────────────────────────────────── */}
            {step === 0 && (
              <>
                <h2
                  style={{
                    fontFamily: 'var(--fx-font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: '-.02em',
                    color: 'var(--fx-text)',
                    margin: 0,
                    textShadow: 'var(--fx-emboss)',
                  }}
                >
                  How much capital?
                </h2>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 14.5, margin: '8px 0 0', lineHeight: 1.55 }}>
                  Deposit once. Your capital stays yours and can be withdrawn anytime — only the returns pay for your tools.
                </p>

                {/* Amount input + currency select */}
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <Input
                    label="Deposit amount"
                    prefix="$"
                    value={amountRaw}
                    onChange={(e) => {
                      setTouched(true);
                      setAmountRaw(e.target.value);
                    }}
                    style={{ flex: 1 }}
                    hint={touched && validationError ? validationError : undefined}
                  />
                  <CurrencySelect value={currency} onChange={setCurrency} />
                </div>

                {/* Quick-select chips */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {CHIPS.map((a) => (
                    <span
                      key={a}
                      onClick={() => {
                        setTouched(true);
                        setAmountRaw(String(a));
                      }}
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 13,
                        color: amountNum === a ? 'var(--fx-text)' : 'var(--fx-text-2)',
                        background: 'var(--fx-surface-2)',
                        border: `1px solid ${amountNum === a ? 'var(--fx-silver)' : 'var(--fx-border)'}`,
                        borderRadius: 'var(--fx-radius-pill)',
                        padding: '8px 14px',
                        cursor: 'pointer',
                      }}
                    >
                      {fmtUsd(a).replace('.00', '')}
                    </span>
                  ))}
                </div>

                {/* Live projection */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: '1px solid var(--fx-border)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 10.5,
                        letterSpacing: '.12em',
                        textTransform: 'uppercase',
                        color: 'var(--fx-text-3)',
                      }}
                    >
                      Projected returns
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 20,
                        color: 'var(--fx-text-strong)',
                        marginTop: 5,
                      }}
                    >
                      {fmtUsd(monthly)}{' '}
                      <span style={{ fontSize: 13, color: 'var(--fx-silver)' }}>/ mo</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 10.5,
                        letterSpacing: '.12em',
                        textTransform: 'uppercase',
                        color: 'var(--fx-text-3)',
                      }}
                    >
                      Covers up to
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 20,
                        color: 'var(--fx-text-strong)',
                        marginTop: 5,
                      }}
                    >
                      {Math.max(0, Math.floor(monthly / 16))} tools
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 26 }}>
                  <Button onClick={() => setStep(1)} disabled={!isValid}>
                    Continue
                  </Button>
                </div>
              </>
            )}

            {/* ── Step 1: Tools ──────────────────────────────────────── */}
            {step === 1 && (
              <>
                <h2
                  style={{
                    fontFamily: 'var(--fx-font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: '-.02em',
                    color: 'var(--fx-text)',
                    margin: 0,
                    textShadow: 'var(--fx-emboss)',
                  }}
                >
                  Which tools should returns cover?
                </h2>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 14.5, margin: '8px 0 0', lineHeight: 1.55 }}>
                  Pick the subscriptions to auto-pay. You can change these anytime.
                </p>

                <div style={{ marginTop: 16 }}>
                  {TOOLS.map(([name, cost], i) => (
                    <React.Fragment key={name}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '11px 0',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: 'linear-gradient(160deg,#43464b,#1b1d21)',
                              border: '1px solid var(--fx-border-metal)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: 'var(--fx-font-mono)',
                              fontSize: 11,
                              color: 'var(--fx-silver-bright)',
                            }}
                          >
                            {name.slice(0, 2)}
                          </span>
                          <span style={{ fontSize: 15, color: 'var(--fx-text)' }}>{name}</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 13, color: 'var(--fx-text-2)' }}>
                            {fmtUsd(cost)}
                          </span>
                          {/* Toggle */}
                          <button
                            role="switch"
                            aria-checked={!!picked[name]}
                            aria-label={`Toggle ${name}`}
                            onClick={() => setPicked((p) => ({ ...p, [name]: !p[name] }))}
                            style={{
                              width: 38,
                              height: 22,
                              borderRadius: 11,
                              border: 'none',
                              cursor: 'pointer',
                              background: picked[name] ? 'var(--fx-chrome)' : 'var(--fx-surface-2)',
                              position: 'relative',
                              transition: 'background .2s',
                              outline: 'none',
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: 3,
                                left: picked[name] ? 19 : 3,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'left .2s',
                              }}
                            />
                          </button>
                        </span>
                      </div>
                      {i < TOOLS.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </div>

                {/* Coverage projection */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: '1px solid var(--fx-border)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 10.5,
                        letterSpacing: '.12em',
                        textTransform: 'uppercase',
                        color: 'var(--fx-text-3)',
                      }}
                    >
                      Monthly cost
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 20,
                        color: 'var(--fx-text-strong)',
                        marginTop: 5,
                      }}
                    >
                      {fmtUsd(pickedTotal)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 10.5,
                        letterSpacing: '.12em',
                        textTransform: 'uppercase',
                        color: 'var(--fx-text-3)',
                      }}
                    >
                      Covered by returns
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--fx-font-mono)',
                        fontSize: 20,
                        marginTop: 5,
                        color: monthly >= pickedTotal ? 'var(--fx-silver-bright)' : 'var(--fx-text-3)',
                      }}
                    >
                      {monthly >= pickedTotal ? 'Fully covered' : 'Add capital'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <ProgressBar
                    label="Returns vs. cost"
                    value={Math.min(100, Math.round((monthly / Math.max(1, pickedTotal)) * 100))}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 26 }}>
                  <Button variant="secondary" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(2)}>Review</Button>
                </div>
              </>
            )}

            {/* ── Step 2: Confirm ────────────────────────────────────── */}
            {step === 2 && (
              <>
                <h2
                  style={{
                    fontFamily: 'var(--fx-font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: '-.02em',
                    color: 'var(--fx-text)',
                    margin: 0,
                    textAlign: 'center',
                    textShadow: 'var(--fx-emboss)',
                  }}
                >
                  Confirm your deposit
                </h2>
                <p
                  style={{
                    color: 'var(--fx-text-2)',
                    fontSize: 14.5,
                    margin: '8px 0 0',
                    lineHeight: 1.55,
                    textAlign: 'center',
                  }}
                >
                  Your capital is transferred securely and starts working immediately.
                </p>

                {/* Big amount */}
                <div
                  style={{
                    fontFamily: 'var(--fx-font-mono)',
                    fontSize: 40,
                    fontWeight: 600,
                    color: 'var(--fx-text-strong)',
                    textAlign: 'center',
                    textShadow: '0 1px 0 rgba(0,0,0,.5)',
                    marginTop: 22,
                  }}
                >
                  {fmtUsd(amountNum)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                  <Badge dot>Capital stays yours</Badge>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Row label="Projected returns" value={`${fmtUsd(monthly)} / mo`} />
                  <Divider />
                  <Row
                    label="Tools auto-paid"
                    value={TOOLS.filter(([name]) => picked[name]).length}
                  />
                  <Divider />
                  <Row
                    label="From your cash"
                    value={<span style={{ color: 'var(--fx-silver)' }}>$0.00</span>}
                  />
                </div>

                {/* Error state */}
                {txError && <TxErrorBox message={txError} />}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 26 }}>
                  <Button variant="secondary" onClick={() => setStep(1)} disabled={submitting}>
                    Back
                  </Button>
                  <Button onClick={handleConfirm} disabled={submitting}>
                    {submitting ? 'Confirming…' : 'Confirm deposit'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </MetalCard>
      </div>
    </div>
  );
}
