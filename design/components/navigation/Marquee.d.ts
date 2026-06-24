import React from 'react';
export interface MarqueeProps {
  /** Items to scroll (strings or nodes). Duplicated internally for a seamless loop. */
  items?: React.ReactNode[];
  /** CSS duration for one loop. @default "36s" */
  duration?: string;
  style?: React.CSSProperties;
}
/** Infinite, hover-pausing logo carousel. */
export function Marquee(props: MarqueeProps): JSX.Element;
