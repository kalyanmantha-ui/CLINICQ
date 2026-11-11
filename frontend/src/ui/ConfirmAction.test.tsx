import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmAction } from './ConfirmAction';

describe('ConfirmAction', () => {
  it('needs a second click, and moves focus to the confirm button', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmAction label="Cancel" confirmLabel="Yes, cancel it" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Yes, cancel it' });
    expect(confirm).toHaveFocus();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('backs out without calling anything', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmAction label="Cancel" confirmLabel="Confirm cancel" keepLabel="Keep" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
