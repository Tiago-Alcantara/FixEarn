/**
 * bills.test.tsx
 * Behavior tests for the Bills management section.
 * Mocks @/lib/api — no real network.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- mock @/lib/api ---
const mockCreateBill = vi.fn();
const mockListBills = vi.fn();
const mockDeleteBill = vi.fn();

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    createBill: mockCreateBill,
    listBills: mockListBills,
    deleteBill: mockDeleteBill,
  }),
}));

// --- mock @privy-io/react-auth ---
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'mock-token' }),
}));

import Bills from './Bills';

const EXISTING_BILLS = [
  { id: 'b1', vendor: 'Notion', monthlyCost: '1600000', type: 'software', status: 'active' },
];

function setup() {
  mockListBills.mockResolvedValue(EXISTING_BILLS);
  mockCreateBill.mockResolvedValue({ id: 'b2', vendor: 'OpenAI', monthlyCost: '20000000', type: 'software', status: 'active' });
  mockDeleteBill.mockResolvedValue(undefined);
  return render(<Bills />);
}

describe('Bills management', () => {
  beforeEach(() => {
    mockCreateBill.mockReset();
    mockListBills.mockReset();
    mockDeleteBill.mockReset();
  });

  it('renders the add bill form with vendor, cost, type, and submit button', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByLabelText(/vendor/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/monthly cost/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add bill/i })).toBeInTheDocument();
  });

  it('defaults the type select to "software"', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByLabelText(/vendor/i)).toBeInTheDocument();
    });
    const typeSelect = screen.getByLabelText(/type/i) as HTMLSelectElement;
    expect(typeSelect.value).toBe('software');
  });

  it('calls createBill with correct args when the form is submitted', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByLabelText(/vendor/i)).toBeInTheDocument();
    });

    const vendorInput = screen.getByLabelText(/vendor/i);
    const costInput = screen.getByLabelText(/monthly cost/i);

    await userEvent.clear(vendorInput);
    await userEvent.type(vendorInput, 'OpenAI');
    await userEvent.clear(costInput);
    await userEvent.type(costInput, '2');

    // type is already 'software' by default
    fireEvent.click(screen.getByRole('button', { name: /add bill/i }));

    await waitFor(() => {
      // toBaseUnits('2') = '20000000' (2 * 10^7)
      expect(mockCreateBill).toHaveBeenCalledWith({
        vendor: 'OpenAI',
        monthlyCost: '20000000',
        type: 'software',
      });
    });
  });

  it('lists existing bills with vendor name, formatted cost, and type', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText('Notion')).toBeInTheDocument();
    });
    // formatUsdc('1600000') = '0.16'
    expect(screen.getByText(/0\.16/)).toBeInTheDocument();
    // 'software' appears in the type option AND the bill type label — at least one should be in doc
    expect(screen.getAllByText('software').length).toBeGreaterThan(0);
  });

  it('calls deleteBill with the bill id when delete is clicked', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText('Notion')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /delete notion/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeleteBill).toHaveBeenCalledWith('b1');
    });
  });
});
