import React from 'react';

/**
 * FixEarn primary action. Polished-chrome primary, hairline secondary, quiet ghost.
 * Renders a <button> by default; pass as="a" for links.
 */
export function Button({ variant = 'primary', size = 'md', as = 'button', children, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);

  const sizes = {
    sm: { padding: '10px 18px', fontSize: 14 },
    md: { padding: '15px 30px', fontSize: 15 },
    lg: { padding: '16px 36px', fontSize: 16 },
  };

  const base = {
    fontFamily: 'var(--fx-font-display)',
    fontWeight: 600,
    borderRadius: 'var(--fx-radius-pill)',
    cursor: 'pointer',
    border: '1px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    textDecoration: 'none',
    transition: 'transform var(--fx-dur-fast) var(--fx-ease), box-shadow var(--fx-dur-fast) var(--fx-ease), filter var(--fx-dur-fast) var(--fx-ease), border-color var(--fx-dur-fast) var(--fx-ease)',
    ...sizes[size],
  };

  const rest_ = {
    primary: { color: 'var(--fx-chrome-ink)', background: 'var(--fx-chrome)', boxShadow: 'var(--fx-elev-chrome)' },
    secondary: { color: 'var(--fx-text)', background: 'rgba(255,255,255,.025)', borderColor: 'var(--fx-border-strong)' },
    ghost: { color: 'var(--fx-text-2)', background: 'transparent' },
  };

  const hovered = {
    primary: { transform: 'translateY(-1px) scale(1.02)', filter: 'brightness(1.04)', boxShadow: 'var(--fx-elev-chrome-hover)' },
    secondary: { transform: 'translateY(-1px)', borderColor: 'var(--fx-silver)', background: 'rgba(192,194,197,.06)' },
    ghost: { color: 'var(--fx-text)' },
  };

  const Tag = as;
  return (
    <Tag
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...rest_[variant], ...(hover ? hovered[variant] : {}), ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
