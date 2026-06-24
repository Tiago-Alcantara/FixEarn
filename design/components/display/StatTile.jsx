import React from 'react';
import { MetalCard } from '../metal-card/MetalCard.jsx';

/** Small metric tile on a brushed surface: mono label, big value, optional sub. */
export function StatTile({ label, value, sub, style = {} }) {
  const mono = 'var(--fx-font-mono)';
  return (
    <MetalCard sweep="hover" padding={22} style={style}>
      <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fx-text-3)' }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 600, color: 'var(--fx-text-strong)', marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--fx-silver)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>{sub}</div>}
    </MetalCard>
  );
}
