'use client';

import dynamic from 'next/dynamic';

const PrivyProviderWrapper = dynamic(
  () => import('./PrivyProviderWrapper').then((mod) => mod.PrivyProviderWrapper),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  return <PrivyProviderWrapper>{children}</PrivyProviderWrapper>;
}
