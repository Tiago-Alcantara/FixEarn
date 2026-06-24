import React from 'react';

/** Styled native select with a silver chevron. Options are strings or {value,label}. */
export function Select({ label, options = [], style = {}, ...rest }) {
  return (
    <label style={{ display: 'block', ...style }}>
      {label && (
        <span style={{ display: 'block', fontFamily: 'var(--fx-font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fx-text-3)', marginBottom: 8 }}>{label}</span>
      )}
      <span style={{ position: 'relative', display: 'block' }}>
        <select
          style={{ appearance: 'none', WebkitAppearance: 'none', width: '100%', background: 'var(--fx-surface-2)', border: '1px solid var(--fx-border)', borderRadius: 'var(--fx-radius-md)', padding: '12px 38px 12px 14px', color: 'var(--fx-text)', fontFamily: 'var(--fx-font-display)', fontSize: 15, cursor: 'pointer' }}
          {...rest}
        >
          {options.map((o, i) => {
            const v = typeof o === 'string' ? o : o.value;
            const l = typeof o === 'string' ? o : o.label;
            return <option key={i} value={v}>{l}</option>;
          })}
        </select>
        <span aria-hidden="true" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--fx-silver)', fontSize: 12 }}>▾</span>
      </span>
    </label>
  );
}
