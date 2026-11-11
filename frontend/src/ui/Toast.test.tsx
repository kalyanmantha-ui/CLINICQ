import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast, type ToastKind } from './Toast';

function Trigger({ text, kind = 'ok' }: { text: string; kind?: ToastKind }) {
  const toast = useToast();
  return <button onClick={() => toast(kind, text)}>{`Show ${text}`}</button>;
}

describe('Toast', () => {
  it('announces a message politely and removes it after the duration', async () => {
    render(<ToastProvider durationMs={200}><Trigger text="Saved" /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Show Saved' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 2000 });
  });

  it('uses an alert for errors and replaces the previous message', async () => {
    render(<ToastProvider><Trigger text="First" /><Trigger text="Failed" kind="error" /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Show First' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show Failed' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.queryByText('First')).not.toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    render(<ToastProvider><Trigger text="Saved" /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Show Saved' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
