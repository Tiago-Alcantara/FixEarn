import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TxErrorBox } from './TxErrorBox';

describe('TxErrorBox', () => {
  it('renders the given message', () => {
    render(<TxErrorBox message="Insufficient balance" />);
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
  });
});
