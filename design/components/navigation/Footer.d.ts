import React from 'react';
export interface FooterColumn { title: string; links: string[]; }
export interface FooterProps {
  tagline?: string;
  columns?: FooterColumn[];
  copyright?: string;
  style?: React.CSSProperties;
}
/** Marketing footer with link columns. */
export function Footer(props: FooterProps): JSX.Element;
