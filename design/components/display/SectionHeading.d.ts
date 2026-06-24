import React from 'react';
export interface SectionHeadingProps {
  kicker?: string;
  title?: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'center' | 'left';
  style?: React.CSSProperties;
}
/** Eyebrow + heading + lead block. */
export function SectionHeading(props: SectionHeadingProps): JSX.Element;
