import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/withdraw',
}));

import WithdrawPage from './page';

describe('Withdraw page (legacy redirect)', () => {
  beforeEach(() => replace.mockReset());

  it('redireciona pra /dashboard', () => {
    render(<WithdrawPage />);
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });
});
