import React from 'react';

/** Brushed-metal rounded tile holding a thin line icon (pass an SVG as children). */
export function IconTile({ children, size = 48, style = {}, ...rest }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 'var(--fx-radius-md)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #43464b, #1b1d21)',
        border: '1px solid var(--fx-border-metal)',
        color: 'var(--fx-silver-bright)',
        boxShadow: 'var(--fx-inset-edge-soft)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
