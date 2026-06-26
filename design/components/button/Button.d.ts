import React from 'react';

export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Size. @default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Element/tag to render (e.g. "a"). @default "button" */
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * The Yield2Pay action button.
 * @startingPoint section="Core" subtitle="Chrome / hairline / ghost actions" viewport="700x150"
 */
export function Button(props: ButtonProps): JSX.Element;
