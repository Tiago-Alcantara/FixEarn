import React from 'react';
export interface StatTileProps {
  label?: React.ReactNode;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  style?: React.CSSProperties;
}
/** Small metric tile on metal. */
export function StatTile(props: StatTileProps): JSX.Element;
