import React from 'react';
import { MetalCard } from '../metal-card/MetalCard.jsx';
import { Badge } from '../badge/Badge.jsx';

/**
 * The investment panel — the product's hero centerpiece. A metal surface showing
 * capital balance, annual yield, a growth chart, and returns/coverage stats.
 */
export function StatPanel({
  label = 'Capital working',
  status = 'Active',
  balance = '$18,400.00',
  growth = '+8.4% / yr',
  returnsLabel = 'Returns / month',
  returns = '$214.80',
  coveredLabel = 'Covered',
  covered = '7 tools',
  width = 444,
  style = {},
  ...rest
}) {
  const gid = React.useId();
  const mono = 'var(--fx-font-mono)';
  return (
    <MetalCard
      sweep="loop"
      padding={0}
      radius="var(--fx-radius-2xl)"
      style={{ width, boxShadow: 'var(--fx-elev-hero)', border: '1px solid var(--fx-border-metal)', ...style }}
      {...rest}
    >
      <div style={{ padding: '26px 28px', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--fx-text-2)' }}>{label}</span>
          <Badge dot>{status}</Badge>
        </div>

        <div style={{ marginTop: 22, fontFamily: mono, fontSize: 'clamp(28px,4.4vw,36px)', fontWeight: 600, color: 'var(--fx-text-strong)', letterSpacing: '.01em', textShadow: '0 1px 0 rgba(0,0,0,.5)' }}>{balance}</div>
        <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--fx-silver)', marginTop: 7, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 9 }}>▲</span>{growth}
        </div>

        <svg viewBox="0 0 360 96" preserveAspectRatio="none" style={{ width: '100%', height: 74, marginTop: 20, display: 'block' }} aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#C0C2C5" stopOpacity=".22" />
              <stop offset="1" stopColor="#C0C2C5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,80 C44,74 70,50 116,54 C166,58 188,30 232,34 C278,38 312,14 360,8 L360,96 L0,96 Z" fill={`url(#${gid})`} />
          <path d="M0,80 C44,74 70,50 116,54 C166,58 188,30 232,34 C278,38 312,14 360,8" fill="none" stroke="#D4D6D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,var(--fx-border-strong),transparent)', margin: '18px 0' }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fx-text-3)' }}>{returnsLabel}</div>
            <div style={{ fontFamily: mono, fontSize: 16, color: 'var(--fx-text)', marginTop: 5 }}>{returns}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fx-text-3)' }}>{coveredLabel}</div>
            <div style={{ fontFamily: mono, fontSize: 16, color: 'var(--fx-text)', marginTop: 5 }}>{covered}</div>
          </div>
        </div>
      </div>
    </MetalCard>
  );
}
