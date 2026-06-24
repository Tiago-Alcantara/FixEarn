/**
 * landing.test.tsx — Structure/smoke tests for the public landing page.
 *
 * Asserts:
 *   1. Eyebrow text "BANKING, REINVENTED FOR SOFTWARE" is rendered
 *   2. Nav labels: How it works / Services / Why FixEarn
 *   3. Hero CTA ("Get started") is present
 *   4. Clicking the CTA calls router.push('/login')
 *
 * Privy is mocked (the CTA may optionally call login() OR navigate;
 * we assert routing to /login).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Next.js router mock ────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// next/link renders as <a> in jsdom — no extra mock needed.

// ── Privy mock ─────────────────────────────────────────────────────────────────

const mockLogin = vi.fn();

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    login: mockLogin,
    ready: true,
    authenticated: false,
    user: null,
  })),
}));

// ── IntersectionObserver mock (jsdom doesn't have it) ─────────────────────────

const observeMock = vi.fn();
const unobserveMock = vi.fn();
const disconnectMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // @ts-expect-error — jsdom stub
  global.IntersectionObserver = class {
    observe = observeMock;
    unobserve = unobserveMock;
    disconnect = disconnectMock;
    constructor(_cb: unknown, _opts?: unknown) {}
  };
  // matchMedia stub for tilt effect guards
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ── Component under test ───────────────────────────────────────────────────────

import LandingPage from './page';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LandingPage', () => {
  it('renders the eyebrow: BANKING, REINVENTED FOR SOFTWARE', () => {
    render(<LandingPage />);
    // The eyebrow is the heroTagline rendered in uppercase via CSS;
    // the text node itself should contain the exact string (case-insensitive match).
    const eyebrow = screen.getByText(/banking,\s+reinvented\s+for\s+software/i);
    expect(eyebrow).toBeTruthy();
  });

  it('renders nav labels: How it works, Services, Why FixEarn', () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/how it works/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/services/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/why fixearn/i).length).toBeGreaterThan(0);
  });

  it('renders the hero CTA button "Get started"', () => {
    render(<LandingPage />);
    // There may be multiple "Get started" buttons (hero + nav header + final CTA).
    const ctaBtns = screen.getAllByRole('button', { name: /get started/i });
    expect(ctaBtns.length).toBeGreaterThan(0);
  });

  it('clicking the hero CTA routes to /login', () => {
    render(<LandingPage />);
    // The hero primary CTA button should navigate to /login.
    const ctaBtns = screen.getAllByRole('button', { name: /get started/i });
    // Click the first one (hero CTA)
    fireEvent.click(ctaBtns[0]);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
