import React from 'react';

/**
 * The brushed-metal surface that backs cards, panels and chips. Adds the grain
 * overlay and a light sweep. `sweep="loop"` runs continuously (hero/CTA panels);
 * `sweep="hover"` fires once on hover (grid cards); `sweep="none"` disables it.
 */
export function MetalCard({ children, sweep = 'hover', padding = 30, radius = 'var(--fx-radius-xl)', style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const loop = sweep === 'loop';
  const active = sweep !== 'none';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        border: '1px solid ' + (hover && active ? 'var(--fx-border-metal)' : 'var(--fx-border-strong)'),
        background: 'var(--fx-metal)',
        boxShadow: 'var(--fx-shadow-card)',
        transition: 'border-color var(--fx-dur-fast) var(--fx-ease)',
        ...style,
      }}
      {...rest}
    >
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--fx-metal-grain)', opacity: 0.5, pointerEvents: 'none' }} />
      {active && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: loop ? '42%' : '55%',
            background: 'var(--fx-sweep)',
            pointerEvents: 'none',
            zIndex: 1,
            ...(loop
              ? { transform: 'translateX(-130%) skewX(-12deg)', animation: 'fx-sweep var(--fx-dur-sweep) ease-in-out infinite' }
              : { transform: hover ? 'translateX(170%) skewX(-12deg)' : 'translateX(-130%) skewX(-12deg)', transition: 'transform .9s var(--fx-ease)' }),
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 2, padding }}>{children}</div>
    </div>
  );
}
