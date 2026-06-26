import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { BrandHeader } from './BrandHeader';

describe('BrandHeader', () => {
  it('renders the brand wordmark and the back button', () => {
    render(<BrandHeader />);
    expect(screen.getByText('Yield2Pay')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /return to dashboard/i }),
    ).toBeInTheDocument();
  });
});
