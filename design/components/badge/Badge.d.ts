import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  /** Show a glowing silver status dot before the label. @default false */
  dot?: boolean;
  style?: React.CSSProperties;
}

/** A small mono status pill. */
export function Badge(props: BadgeProps): JSX.Element;
