import { render, screen } from '@testing-library/react';
import { StatTile } from './StatTile';

it('shows label and value', () => {
  render(<StatTile label="CAPITAL WORKING" value="$1.075" hint="USDC" />);
  expect(screen.getByText('CAPITAL WORKING')).toBeInTheDocument();
  expect(screen.getByText('$1.075')).toBeInTheDocument();
});
