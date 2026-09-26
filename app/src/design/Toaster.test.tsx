import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from './Toaster';
import { showToast, useToasts } from './toast';

beforeEach(() => useToasts.setState({ toasts: [] }));

it('shows a toast with an Undo action that runs and dismisses', async () => {
  const run = vi.fn();
  render(<Toaster />);
  act(() => void showToast({ message: 'Moved to Trash', action: { label: 'Undo', run } }, 0));
  expect(screen.getByRole('status')).toHaveTextContent('Moved to Trash');
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(run).toHaveBeenCalledOnce();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps at most three toasts', () => {
  render(<Toaster />);
  act(() => {
    for (let i = 0; i < 5; i++) showToast({ message: `t${i}` }, 0);
  });
  expect(screen.getAllByRole('status').map((n) => n.textContent)).toEqual(['t2', 't3', 't4']);
});
