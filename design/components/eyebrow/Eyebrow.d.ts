import React from 'react';

export interface EyebrowProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Use wider tracking (hero context). @default false */
  wide?: boolean;
  style?: React.CSSProperties;
}

/** Mono kicker label above a heading. */
export function Eyebrow(props: EyebrowProps): JSX.Element;
