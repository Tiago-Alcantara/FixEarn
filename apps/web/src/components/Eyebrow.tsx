import React from 'react';

export interface EyebrowProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Use wider tracking (hero context). @default false */
  wide?: boolean;
  style?: React.CSSProperties;
}

/** Mono uppercase kicker/eyebrow that sits above a heading. */
export function Eyebrow({ children, wide = false, style = {}, ...rest }: EyebrowProps) {
  return (
    <div
      style={{
        fontFamily: 'var(--fx-font-mono)',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: wide ? 'var(--fx-tracking-label-wide)' : 'var(--fx-tracking-label)',
        textTransform: 'uppercase',
        color: 'var(--fx-silver)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
