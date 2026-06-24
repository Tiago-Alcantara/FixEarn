/**
 * withdraw.test.tsx
 * Behavior tests for the Withdraw page.
 * Mocks useStellarTx — no real network or Privy.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- mock useStellarTx ---
const mockWithdraw = vi.fn();
vi.mock('@/lib/useStellarTx', () => ({
  useStellarTx: () => ({ withdraw: mockWithdraw }),
}));

// --- mock next/navigation ---
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/withdraw',
}));

import WithdrawPage from './page';

function setup() {
  return render(<WithdrawPage />);
}

describe('Withdraw page', () => {
  beforeEach(() => {
    mockWithdraw.mockReset();
  });

  it('renders the amount input and confirm button', () => {
    setup();
    expect(screen.getByLabelText(/withdraw amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm withdraw/i })).toBeInTheDocument();
  });

  it('calls withdraw with base-unit string on confirm', async () => {
    mockWithdraw.mockResolvedValue('txhash123');
    setup();

    const input = screen.getByLabelText(/withdraw amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '5');

    fireEvent.click(screen.getByRole('button', { name: /confirm withdraw/i }));

    await waitFor(() => {
      // toBaseUnits('5') = '50000000' (5 * 10^7)
      expect(mockWithdraw).toHaveBeenCalledWith('50000000');
    });
  });

  it('shows txHash in success state after confirm', async () => {
    mockWithdraw.mockResolvedValue('txhash123');
    setup();

    const input = screen.getByLabelText(/withdraw amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '5');
    fireEvent.click(screen.getByRole('button', { name: /confirm withdraw/i }));

    await waitFor(() => {
      expect(screen.getByText(/txhash123/i)).toBeInTheDocument();
    });
  });

  it('blocks confirm when amount is 0 or empty', async () => {
    setup();
    const input = screen.getByLabelText(/withdraw amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(screen.getByRole('button', { name: /confirm withdraw/i })).toBeDisabled();
  });

  it('blocks confirm when amount has more than 7 decimal places', async () => {
    setup();
    const input = screen.getByLabelText(/withdraw amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '1.123456789');
    expect(screen.getByRole('button', { name: /confirm withdraw/i })).toBeDisabled();
  });

  it('shows error when withdraw throws', async () => {
    mockWithdraw.mockRejectedValue(new Error('Insufficient balance'));
    setup();

    const input = screen.getByLabelText(/withdraw amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '10');
    fireEvent.click(screen.getByRole('button', { name: /confirm withdraw/i }));

    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
    });
  });
});
