import React from 'react';

export interface IconTileProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** A thin line icon (24×24 SVG with stroke="currentColor"). */
  children?: React.ReactNode;
  /** Square size in px. @default 48 */
  size?: number;
  style?: React.CSSProperties;
}

/** Metal tile that frames a line icon. */
export function IconTile(props: IconTileProps): JSX.Element;
