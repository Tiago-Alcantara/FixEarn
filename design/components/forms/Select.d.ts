import React from 'react';
export interface SelectOption { value: string; label: string; }
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: Array<string | SelectOption>;
  style?: React.CSSProperties;
}
/** Styled dropdown select. */
export function Select(props: SelectProps): JSX.Element;
