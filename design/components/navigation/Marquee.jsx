import React from 'react';

/** Infinite logo/tool marquee on brushed-metal chips. Pauses on hover. */
export function Marquee({ items = [], duration = '36s', style = {} }) {
  const [paused, setPaused] = React.useState(false);
  const loop = [...items, ...items];
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ position: 'relative', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)', ...style }}
    >
      <div style={{ display: 'flex', width: 'max-content', animation: `fx-marquee ${duration} linear infinite`, animationPlayState: paused ? 'paused' : 'running' }}>
        {loop.map((it, i) => (
          <div key={i} style={{ position: 'relative', overflow: 'hidden', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 76, padding: '0 40px', marginRight: 14, border: '1px solid var(--fx-border-strong)', borderRadius: 'var(--fx-radius-lg)', background: 'var(--fx-metal)', color: 'var(--fx-silver)' }}>
            <span style={{ position: 'relative', zIndex: 2, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
