import React from 'react';

/** Marketing footer: brand + tagline, link columns, and copyright row. */
export function Footer({ tagline = 'The bank that pays your software.', columns = [], copyright = '© 2026 Yield2Pay. All rights reserved.', style = {} }) {
  return (
    <footer style={{ borderTop: '1px solid var(--fx-border-faint)', padding: '64px 0 40px', background: 'transparent', ...style }}>
      <div style={{ maxWidth: 'var(--fx-container)', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, justifyContent: 'space-between' }}>
          <div style={{ flex: '2 1 260px', minWidth: 240 }}>
            <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <span style={{ width: 11, height: 11, background: 'var(--fx-chrome)', transform: 'rotate(45deg)', borderRadius: 2 }} />
              <span style={{ fontFamily: 'var(--fx-font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--fx-text)' }}>Yield2Pay</span>
            </a>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--fx-text-2)', margin: '16px 0 0', maxWidth: 260 }}>{tagline}</p>
          </div>
          {columns.map((col, i) => (
            <div key={i} style={{ minWidth: 130 }}>
              <div style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fx-text-2)', marginBottom: 16 }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {col.links.map((l, j) => <a key={j} href="#" style={{ fontSize: 14, color: '#C8CACD', textDecoration: 'none' }}>{l}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--fx-border-faint)', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--fx-text-4)' }}>{copyright}</span>
          <span style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 11, letterSpacing: '.08em', color: 'var(--fx-text-disabled)', textTransform: 'uppercase' }}>Prototype</span>
        </div>
      </div>
    </footer>
  );
}
