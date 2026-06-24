import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

it('renders label and fires onClick', async () => {
  const onClick = vi.fn();
  render(<Button variant="chrome" onClick={onClick}>Get started</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Get started' }));
  expect(onClick).toHaveBeenCalledOnce();
});

it('does not fire when disabled', async () => {
  const onClick = vi.fn();
  render(<Button variant="ghost" onClick={onClick} disabled>X</Button>);
  await userEvent.click(screen.getByRole('button'));
  expect(onClick).not.toHaveBeenCalled();
});
