import React from 'react';
import { MetalCard } from './MetalCard';

export interface StatTileProps {
  label?: React.ReactNode;
  value?: React.ReactNode;
  /** Optional sub-label / hint below the value. */
  sub?: React.ReactNode;
  /** Alias for sub — accepted per brief. */
  hint?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Small metric tile on a brushed metal surface: mono label, big value, optional sub. */
export function StatTile({ label, value, sub, hint, style = {} }: StatTileProps) {
  const subContent = sub ?? hint;
  const mono = 'var(--fx-font-mono)';
  return (
    <MetalCard sweep="hover" padding={22} style={style}>
      <div
        style={{
          fontFamily: mono,
          fontSize: 10.5,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--fx-text-3)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 26,
          fontWeight: 600,
          color: 'var(--fx-text-strong)',
          marginTop: 8,
        }}
      >
        {value}
      </div>
      {subContent && (
        <div
          style={{
            fontFamily: mono,
            fontSize: 12,
            color: 'var(--fx-silver)',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {subContent}
        </div>
      )}
    </MetalCard>
  );
}
