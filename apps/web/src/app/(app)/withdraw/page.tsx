'use client';

import React, { useState } from 'react';
import { MetalCard } from '@/components/MetalCard';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { useStellarTx } from '@/lib/useStellarTx';
import { toBaseUnits } from '@/lib/money';
import { useIsMobile } from '@/lib/useIsMobile';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns null if valid, error string if invalid */
function validateAmount(raw: string): string | null {
  if (!raw || raw === '0' || raw === '') return 'Enter a positive amount';
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed <= 0) return 'Enter a positive amount';
  try {
    toBaseUnits(raw); // throws if >7 decimals or non-numeric
    return null;
  } catch {
    return 'Max 7 decimal places';
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WithdrawPage() {
  const { withdraw } = useStellarTx();
  const isMobile = useIsMobile();

  const [amountRaw, setAmountRaw] = useState('');
  const [touched, setTouched] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validationError = validateAmount(amountRaw);
  const isValid = validationError === null;

  async function handleConfirm() {
    if (!isValid) return;
    setSubmitting(true);
    setTxError(null);
    try {
      const baseUnits = toBaseUnits(amountRaw);
      const hash = await withdraw(baseUnits);
      setTxHash(hash);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (txHash) {
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
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 26 }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                background: 'var(--fx-chrome)',
                transform: 'rotate(45deg)',
                borderRadius: 2,
                boxShadow: 'var(--fx-glow-silver)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--fx-font-display)',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-.01em',
                color: 'var(--fx-text)',
              }}
            >
              FixEarn
            </span>
          </div>

          <MetalCard
            sweep="loop"
            padding={0}
            radius="var(--fx-radius-2xl)"
            style={{ border: '1px solid var(--fx-border-metal)', boxShadow: 'var(--fx-elev-hero)' }}
          >
            <div style={{ padding: 30, textAlign: 'center' }}>
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
                Withdrawal confirmed!
              </h2>
              <p style={{ color: 'var(--fx-text-2)', fontSize: 14.5, margin: '8px 0 0', lineHeight: 1.55 }}>
                Your funds are on their way.
              </p>
              <div
                style={{
                  marginTop: 24,
                  padding: '18px',
                  background: 'var(--fx-surface-2)',
                  border: '1px solid var(--fx-border)',
                  borderRadius: 'var(--fx-radius-md)',
                  fontFamily: 'var(--fx-font-mono)',
                  fontSize: 13,
                  color: 'var(--fx-silver)',
                  wordBreak: 'break-all',
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: 'var(--fx-text-3)',
                    marginBottom: 8,
                  }}
                >
                  Transaction hash
                </div>
                <span style={{ color: 'var(--fx-text)' }}>{txHash}</span>
              </div>
              <div style={{ marginTop: 24 }}>
                <Badge dot>Capital stays yours</Badge>
              </div>
            </div>
          </MetalCard>
        </div>
      </div>
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
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 26 }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              background: 'var(--fx-chrome)',
              transform: 'rotate(45deg)',
              borderRadius: 2,
              boxShadow: 'var(--fx-glow-silver)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--fx-font-display)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-.01em',
              color: 'var(--fx-text)',
            }}
          >
            FixEarn
          </span>
        </div>

        {/* Card */}
        <MetalCard
          sweep="loop"
          padding={0}
          radius="var(--fx-radius-2xl)"
          style={{ border: '1px solid var(--fx-border-metal)', boxShadow: 'var(--fx-elev-hero)' }}
        >
          <div style={{ padding: 30 }}>
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
              Withdraw funds
            </h2>
            <p style={{ color: 'var(--fx-text-2)', fontSize: 14.5, margin: '8px 0 0', lineHeight: 1.55 }}>
              Withdraw your capital anytime. Your tools keep running from previous returns.
            </p>

            {/* Amount input */}
            <div style={{ marginTop: 22 }}>
              <Input
                label="Withdraw amount"
                prefix="$"
                value={amountRaw}
                onChange={(e) => {
                  setTouched(true);
                  setAmountRaw(e.target.value);
                }}
                placeholder="0.00"
                hint={touched && validationError ? validationError : undefined}
                aria-label="Withdraw amount"
              />
            </div>

            {/* Badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <Badge dot>Capital stays yours</Badge>
            </div>

            {/* Error state */}
            {txError && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  background: 'rgba(220,50,50,.08)',
                  border: '1px solid rgba(220,50,50,.25)',
                  borderRadius: 'var(--fx-radius-md)',
                  fontFamily: 'var(--fx-font-mono)',
                  fontSize: 13,
                  color: '#ff6b6b',
                }}
              >
                {txError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 26 }}>
              <Button onClick={handleConfirm} disabled={!isValid || submitting}>
                {submitting ? 'Confirming…' : 'Confirm withdraw'}
              </Button>
            </div>
          </div>
        </MetalCard>
      </div>
    </div>
  );
}
