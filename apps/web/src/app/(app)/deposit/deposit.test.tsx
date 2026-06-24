/**
 * deposit.test.tsx
 * Behavior tests for the 3-step deposit onboarding flow.
 * Mocks useStellarTx — no real network or Privy.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- mock useStellarTx ---
const mockDeposit = vi.fn();
vi.mock('@/lib/useStellarTx', () => ({
  useStellarTx: () => ({ deposit: mockDeposit }),
}));

// --- mock next/navigation (App Router) ---
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/deposit',
}));

import DepositPage from './page';

function setup() {
  return render(<DepositPage />);
}

describe('Deposit onboarding flow', () => {
  beforeEach(() => {
    mockDeposit.mockReset();
  });

  // ── Step 1: Amount entry ──────────────────────────────────────────────────

  it('renders Step 1 with amount input and Continue button', () => {
    setup();
    expect(screen.getByRole('heading', { name: /how much capital/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/deposit amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('shows live returns projection that updates as the user types', async () => {
    setup();
    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '12000');
    // monthly = 12000 * 0.084 / 12 = 84
    expect(screen.getByText(/84\.00/)).toBeInTheDocument();
  });

  it('blocks Continue when amount is 0', () => {
    setup();
    const input = screen.getByLabelText(/deposit amount/i);
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('blocks Continue when amount has more than 7 decimal places', async () => {
    setup();
    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '1.123456789');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('enables Continue for a valid amount with ≤7 decimals', async () => {
    setup();
    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '500.12');
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
  });

  // ── Step 2: Review (Tools) ────────────────────────────────────────────────

  it('advances to Step 2 (tools) when Continue is clicked with a valid amount', async () => {
    setup();
    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '10000');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /tools/i })).toBeInTheDocument();
  });

  it('goes back to Step 1 from Step 2 via Back button', async () => {
    setup();
    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '10000');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('heading', { name: /how much capital/i })).toBeInTheDocument();
  });

  // ── Step 3: Confirm ───────────────────────────────────────────────────────

  it('advances to Step 3 (confirm) via Review button', async () => {
    setup();
    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '10000');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    expect(screen.getByRole('heading', { name: /confirm your deposit/i })).toBeInTheDocument();
  });

  it('calls deposit with base-unit string (toBaseUnits applied) on Confirm', async () => {
    mockDeposit.mockResolvedValue('abc123txhash');
    setup();

    // Step 1
    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2
    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    // Step 3 — confirm
    fireEvent.click(screen.getByRole('button', { name: /confirm deposit/i }));

    await waitFor(() => {
      // toBaseUnits('100') = '1000000000' (100 * 10^7 = 1,000,000,000)
      expect(mockDeposit).toHaveBeenCalledWith('1000000000');
    });
  });

  it('shows txHash in success state after confirm', async () => {
    mockDeposit.mockResolvedValue('abc123txhash');
    setup();

    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm deposit/i }));

    await waitFor(() => {
      expect(screen.getByText(/abc123txhash/i)).toBeInTheDocument();
    });
  });

  it('shows error state when deposit throws', async () => {
    mockDeposit.mockRejectedValue(new Error('Network error'));
    setup();

    const input = screen.getByLabelText(/deposit amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm deposit/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
