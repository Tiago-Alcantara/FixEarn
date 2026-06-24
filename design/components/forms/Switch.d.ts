import React from 'react';
export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
  style?: React.CSSProperties;
}
/** Toggle switch. */
export function Switch(props: SwitchProps): JSX.Element;
