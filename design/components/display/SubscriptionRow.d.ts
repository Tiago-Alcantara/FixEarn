import React from 'react';
export interface SubscriptionRowProps {
  name?: React.ReactNode;
  price?: React.ReactNode;
  /** Whether the subscription is covered by returns. @default true */
  paid?: boolean;
  style?: React.CSSProperties;
}
/** A subscription line item (name · price · paid check). */
export function SubscriptionRow(props: SubscriptionRowProps): JSX.Element;
