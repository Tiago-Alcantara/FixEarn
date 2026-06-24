import React from 'react';
import { Eyebrow } from '../eyebrow/Eyebrow.jsx';

/** Section header block: mono kicker + embossed h2 + lead paragraph. */
export function SectionHeading({ kicker, title, lead, align = 'center', style = {} }) {
  return (
    <div style={{ textAlign: align, maxWidth: align === 'center' ? 680 : 'none', margin: align === 'center' ? '0 auto' : 0, ...style }}>
      {kicker && <Eyebrow style={{ marginBottom: 16 }}>{kicker}</Eyebrow>}
      <h2 style={{ fontFamily: 'var(--fx-font-display)', fontSize: 'clamp(30px,3.4vw,40px)', fontWeight: 700, letterSpacing: '-.02em', color: 'var(--fx-text)', margin: 0, textShadow: 'var(--fx-emboss)' }}>{title}</h2>
      {lead && <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--fx-text-2)', margin: '14px 0 0' }}>{lead}</p>}
    </div>
  );
}
