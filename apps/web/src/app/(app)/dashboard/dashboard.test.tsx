/**
 * dashboard.test.tsx
 * Behavior tests for the Dashboard page.
 * Mocks @/lib/api — no real network.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- mock @/lib/api ---
const mockGetDashboard = vi.fn();
const mockListBills = vi.fn();

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    getDashboard: mockGetDashboard,
    listBills: mockListBills,
  }),
}));

// --- mock @privy-io/react-auth (needed for createApi(getAccessToken)) ---
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'mock-token' }),
}));

// --- mock next/navigation ---
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import DashboardPage from './page';

const DASHBOARD_DATA = {
  vaultValue: '10750000',
  principal: '10000000',
  spendable: '750000',
  apyPercent: '7.50',
};

const BILLS_DATA = [
  { id: 'b1', vendor: 'OpenAI', monthlyCost: '2000000', type: 'software', status: 'active' },
];

function setup() {
  mockGetDashboard.mockResolvedValue(DASHBOARD_DATA);
  mockListBills.mockResolvedValue(BILLS_DATA);
  return render(<DashboardPage />);
}

describe('Dashboard page', () => {
  beforeEach(() => {
    mockGetDashboard.mockReset();
    mockListBills.mockReset();
  });

  it('shows loading state initially', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {})); // never resolves
    mockListBills.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders vaultValue via formatUsdc after data loads', async () => {
    setup();
    // formatUsdc('10750000') = '1.075'
    await waitFor(() => {
      expect(screen.getByText('1.075')).toBeInTheDocument();
    });
  });

  it('renders spendable via formatUsdc after data loads', async () => {
    setup();
    // formatUsdc('750000') = '0.075'
    await waitFor(() => {
      expect(screen.getByText('0.075')).toBeInTheDocument();
    });
  });

  it('renders apyPercent as percentage after data loads', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText('7.50%')).toBeInTheDocument();
    });
  });

  it('renders bill vendor name after data loads', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });
  });

  it('shows error state when getDashboard rejects', async () => {
    mockGetDashboard.mockRejectedValue(new Error('Server error'));
    mockListBills.mockResolvedValue([]);
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/error/i).length).toBeGreaterThan(0);
    });
  });
});
