import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatClock, OfferTicket } from './OfferTicket';
import { expectNoA11yViolations } from '../test/axe';

const NOW = Date.parse('2030-03-04T17:00:00Z');
const props = { doctorName: 'Dr. Sarah Chen', when: 'Mon, Mar 4 · 9:00 AM', onAccept: () => {}, onDecline: () => {} };
const expires = (secondsLeft: number) => new Date(NOW + secondsLeft * 1000).toISOString();

describe('OfferTicket', () => {
  it('formats the clock as minutes and seconds', () => {
    expect(formatClock(872)).toBe('14:32');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
  });

  it('shows the time left and lets the patient accept or decline', async () => {
    const onAccept = vi.fn(); const onDecline = vi.fn();
    render(<OfferTicket {...props} onAccept={onAccept} onDecline={onDecline} now={NOW} expiresAt={expires(872)} />);
    expect(screen.getByText('Offer held for 14:32')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Book it' }));
    await userEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('turns urgent in the last two minutes', () => {
    render(<OfferTicket {...props} now={NOW} expiresAt={expires(90)} />);
    expect(screen.getByTestId('offer')).toHaveClass('urgent');
  });

  it('disables both actions once the offer has expired', () => {
    render(<OfferTicket {...props} now={NOW} expiresAt={expires(-5)} />);
    expect(screen.getByText('This offer has expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book it' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No thanks' })).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<OfferTicket {...props} now={NOW} expiresAt={expires(600)} />);
    await expectNoA11yViolations(container);
  });
});
