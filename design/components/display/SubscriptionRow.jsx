import React from 'react';

/** One subscription line: name, price, and a paid/unpaid check. */
export function SubscriptionRow({ name, price, paid = true, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', ...style }}>
      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--fx-text)' }}>{name}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 13, color: 'var(--fx-text-2)' }}>{price}</span>
        <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid ' + (paid ? 'var(--fx-border-metal)' : 'var(--fx-border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: paid ? 'var(--fx-silver-bright)' : 'var(--fx-text-disabled)' }}>
          {paid && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-11" /></svg>
          )}
        </span>
      </span>
    </div>
  );
}
