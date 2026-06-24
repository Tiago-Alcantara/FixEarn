import React from 'react';
export interface SegOption { value: string; label: string; }
export interface SegmentedControlProps {
  options?: Array<string | SegOption>;
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}
/** Segmented control / language toggle. */
export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
