'use client';

import React, { useState } from 'react';
import { MetalCard } from '@/components/MetalCard';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { BrandHeader } from '@/components/BrandHeader';
import { TxResultCard } from '@/components/TxResultCard';
import { TxErrorBox } from '@/components/TxErrorBox';
import { useStellarTx } from '@/lib/useStellarTx';
import { toBaseUnits } from '@/lib/money';
import { validateAmount } from '@/lib/validateAmount';
import { getErrorMessage } from '@/lib/errors';
import { useIsMobile } from '@/lib/useIsMobile';

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
      setTxError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (txHash) {
    return (
      <TxResultCard
        title="Withdrawal confirmed!"
        subtitle="Your funds are on their way."
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
            {txError && <TxErrorBox message={txError} />}

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
