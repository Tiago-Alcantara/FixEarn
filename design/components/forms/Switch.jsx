import React from 'react';

/** Chrome-filled toggle switch with optional label. Controlled via `checked`/`onChange`. */
export function Switch({ checked = false, onChange, label, style = {} }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 12, cursor: 'pointer', ...style }}>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange && onChange(!checked)}
        style={{ width: 44, height: 26, borderRadius: 999, background: checked ? 'var(--fx-chrome)' : 'var(--fx-surface-2)', border: '1px solid ' + (checked ? 'transparent' : 'var(--fx-border)'), position: 'relative', transition: 'background var(--fx-dur-fast) var(--fx-ease)', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: checked ? '#0E0F11' : 'var(--fx-silver)', transition: 'left var(--fx-dur-fast) var(--fx-ease)' }} />
      </span>
      {label && <span style={{ fontSize: 15, color: 'var(--fx-text)' }}>{label}</span>}
    </label>
  );
}
