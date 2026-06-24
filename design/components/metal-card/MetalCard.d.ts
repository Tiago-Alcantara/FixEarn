import React from 'react';

export interface MetalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Light-sweep behaviour. @default "hover" */
  sweep?: 'hover' | 'loop' | 'none';
  /** Inner padding in px. @default 30 */
  padding?: number;
  /** Border radius (CSS value). @default "var(--fx-radius-xl)" */
  radius?: string;
  style?: React.CSSProperties;
}

/**
 * The signature brushed-metal surface.
 * @startingPoint section="Core" subtitle="Brushed-metal surface with grain + sweep" viewport="700x260"
 */
export function MetalCard(props: MetalCardProps): JSX.Element;
