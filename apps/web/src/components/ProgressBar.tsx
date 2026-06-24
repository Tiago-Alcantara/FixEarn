import React from 'react';

export interface ProgressBarProps {
  /** 0–100. */
  value?: number;
  label?: string;
  style?: React.CSSProperties;
}

/** Thin chrome-filled progress/coverage bar with optional label + percentage. */
export function ProgressBar({ value = 0, label, style = {} }: ProgressBarProps) {
  const v = Math.max(0, Math.min(100, value));

  return (
    <div style={style}>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--fx-font-mono)',
            fontSize: 11,
            letterSpacing: '.04em',
            color: 'var(--fx-text-3)',
            marginBottom: 8,
          }}
        >
          <span>{label}</span>
          <span style={{ color: 'var(--fx-silver)' }}>{v}%</span>
        </div>
      )}
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--fx-surface-2)',
          border: '1px solid var(--fx-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: v + '%',
            background: 'var(--fx-chrome)',
            borderRadius: 999,
            transition: 'width var(--fx-dur-reveal) var(--fx-ease)',
          }}
        />
      </div>
    </div>
  );
}
