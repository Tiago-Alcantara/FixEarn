import React from 'react';
export interface HeaderProps {
  nav?: string[];
  lang?: string;
  onLang?: (lang: string) => void;
  ctaLabel?: string;
  loginLabel?: string;
  style?: React.CSSProperties;
}
/**
 * Sticky marketing header.
 * @startingPoint section="Navigation" subtitle="Logo, nav, EN/PT toggle, CTA" viewport="1200x70"
 */
export function Header(props: HeaderProps): JSX.Element;
