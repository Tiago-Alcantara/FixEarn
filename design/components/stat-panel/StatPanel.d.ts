import React from 'react';

export interface StatPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Mono label, top-left. @default "Capital working" */
  label?: string;
  /** Status pill text. @default "Active" */
  status?: string;
  /** Large balance figure. @default "$18,400.00" */
  balance?: string;
  /** Annual yield line. @default "+8.4% / yr" */
  growth?: string;
  returnsLabel?: string;
  returns?: string;
  coveredLabel?: string;
  covered?: string;
  /** Panel width in px. @default 444 */
  width?: number;
  style?: React.CSSProperties;
}

/**
 * Investment / capital panel — the hero centerpiece.
 * @startingPoint section="Core" subtitle="Capital balance, yield & growth chart" viewport="700x420"
 */
export function StatPanel(props: StatPanelProps): JSX.Element;
