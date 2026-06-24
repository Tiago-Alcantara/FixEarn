import React from 'react';
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Leading adornment, e.g. a currency symbol. */
  prefix?: React.ReactNode;
  /** Trailing adornment, e.g. "/ mo". */
  suffix?: React.ReactNode;
  /** Helper text below the field. */
  hint?: string;
  style?: React.CSSProperties;
}
/** Mono text/number field with prefix & hint. */
export function Input(props: InputProps): JSX.Element;
