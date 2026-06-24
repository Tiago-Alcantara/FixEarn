'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createApi } from '@/lib/api';
import { toBaseUnits, formatUsdc } from '@/lib/money';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import type { Bill, BillType } from '@fixearn/shared';

// ── Types ──────────────────────────────────────────────────────────────────────

const BILL_TYPES: BillType[] = ['software', 'utility', 'other'];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns null if valid, error string if invalid */
function validateCost(raw: string): string | null {
  if (!raw || raw === '0') return 'Enter a positive amount';
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed <= 0) return 'Enter a positive amount';
  try {
    toBaseUnits(raw);
    return null;
  } catch {
    return 'Max 7 decimal places';
  }
}

// ── Bills component ────────────────────────────────────────────────────────────

export default function Bills() {
  const { getAccessToken } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  const [type, setType] = useState<BillType>('software');
  const [costTouched, setCostTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load bills on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listBills()
      .then((list) => {
        if (!cancelled) {
          setBills(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const costError = validateCost(cost);
  const isValid = vendor.trim().length > 0 && costError === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const monthlyCost = toBaseUnits(cost);
      const newBill = await api.createBill({ vendor: vendor.trim(), monthlyCost, type });
      setBills((prev) => [...prev, newBill]);
      setVendor('');
      setCost('');
      setType('software');
      setCostTouched(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add bill');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteBill(id);
      setBills((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bill');
    }
  }

  const mono = "'Geist Mono', monospace";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Add bill form ──────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#1A1C1F',
          border: '1px solid #2A2D31',
          borderRadius: 18,
          padding: 26,
        }}
      >
        <h3
          style={{
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: '#9A9DA1',
            margin: '0 0 18px',
          }}
        >
          Add a recurring bill
        </h3>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* Vendor */}
            <Input
              label="Vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. OpenAI"
              style={{ flex: '2 1 160px' }}
              aria-label="Vendor"
            />

            {/* Monthly cost */}
            <Input
              label="Monthly cost"
              prefix="$"
              value={cost}
              onChange={(e) => {
                setCostTouched(true);
                setCost(e.target.value);
              }}
              placeholder="0.00"
              style={{ flex: '1 1 120px' }}
              hint={costTouched && costError ? costError : undefined}
              aria-label="Monthly cost"
            />

            {/* Type select */}
            <label style={{ display: 'block', flex: '1 1 120px' }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: mono,
                  fontSize: 11,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: '#9A9DA1',
                  marginBottom: 8,
                }}
              >
                Type
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#16181B',
                  border: '1px solid #2A2D31',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
              >
                <select
                  aria-label="Type"
                  value={type}
                  onChange={(e) => setType(e.target.value as BillType)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#F2F3F4',
                    fontFamily: mono,
                    fontSize: 15,
                    cursor: 'pointer',
                    appearance: 'none',
                  }}
                >
                  {BILL_TYPES.map((t) => (
                    <option key={t} value={t} style={{ background: '#16181B', color: '#F2F3F4' }}>
                      {t}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>

          {formError && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'rgba(220,50,50,.08)',
                border: '1px solid rgba(220,50,50,.25)',
                borderRadius: 10,
                fontFamily: mono,
                fontSize: 13,
                color: '#ff6b6b',
              }}
            >
              {formError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button type="submit" disabled={!isValid || submitting} size="sm">
              {submitting ? 'Adding…' : 'Add bill'}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Bills list ────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#1A1C1F',
          border: '1px solid #2A2D31',
          borderRadius: 18,
          padding: 26,
        }}
      >
        <h3
          style={{
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: '#9A9DA1',
            margin: '0 0 18px',
          }}
        >
          Your bills
        </h3>

        {loading && (
          <p style={{ color: '#9A9DA1', fontFamily: mono, fontSize: 13 }}>Loading…</p>
        )}
        {error && (
          <p style={{ color: '#ff6b6b', fontFamily: mono, fontSize: 13 }}>{error}</p>
        )}
        {!loading && !error && bills.length === 0 && (
          <p style={{ color: '#9A9DA1', fontSize: 14 }}>No bills yet. Add one above.</p>
        )}

        {!loading && bills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {bills.map((bill, i) => (
              <div
                key={bill.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: i < bills.length - 1 ? '1px solid #2A2D31' : 'none',
                }}
              >
                {/* Left: avatar + vendor info */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(160deg,#43464b,#1b1d21)',
                      border: '1px solid #4a4d52',
                      fontFamily: mono,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#D4D6D9',
                    }}
                  >
                    {bill.vendor.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <span
                      style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#F2F3F4' }}
                    >
                      {bill.vendor}
                    </span>
                    <span
                      style={{ display: 'block', fontFamily: mono, fontSize: 12, color: '#9A9DA1', marginTop: 2 }}
                    >
                      {bill.type}
                    </span>
                  </span>
                </span>

                {/* Right: cost + delete */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span
                    style={{ fontFamily: mono, fontSize: 14, color: '#C0C2C5' }}
                  >
                    {formatUsdc(bill.monthlyCost)}/mo
                  </span>
                  <button
                    aria-label={`Delete ${bill.vendor}`}
                    onClick={() => handleDelete(bill.id)}
                    style={{
                      background: 'rgba(220,50,50,.08)',
                      border: '1px solid rgba(220,50,50,.2)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontFamily: mono,
                      fontSize: 12,
                      color: '#ff8080',
                      transition: 'all .2s ease',
                    }}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
