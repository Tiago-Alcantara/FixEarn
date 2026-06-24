import React from 'react';
export interface ProgressBarProps {
  /** 0–100. */
  value?: number;
  label?: string;
  style?: React.CSSProperties;
}
/** Coverage / allocation bar. */
export function ProgressBar(props: ProgressBarProps): JSX.Element;
