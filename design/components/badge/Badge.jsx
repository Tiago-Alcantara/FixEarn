import React from 'react';

/** Mono status pill — silver outline, optional glowing dot. Used for "Active", tags, kickers. */
export function Badge({ children, dot = false, style = {}, ...rest }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'var(--fx-font-mono)',
        fontSize: 10.5,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'var(--fx-silver-bright)',
        border: '1px solid var(--fx-border-metal)',
        borderRadius: 'var(--fx-radius-pill)',
        padding: '4px 11px',
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fx-silver-bright)', boxShadow: 'var(--fx-glow-silver)' }}
        />
      )}
      {children}
    </span>
  );
}
