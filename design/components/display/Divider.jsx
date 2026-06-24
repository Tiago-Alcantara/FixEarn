import React from 'react';

/** Center-fading hairline rule — the FixEarn divider. */
export function Divider({ style = {} }) {
  return <div aria-hidden="true" style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--fx-border-strong), transparent)', ...style }} />;
}
