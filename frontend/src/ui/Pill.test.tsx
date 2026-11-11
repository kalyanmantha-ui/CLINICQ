import { render, screen } from '@testing-library/react';
import { Pill, statusTone } from './Pill';

describe('Pill', () => {
  it('uses the tone as a class and always shows the status as text', () => {
    render(<Pill tone="booked">booked</Pill>);
    expect(screen.getByText('booked')).toHaveClass('pill', 'booked');
  });

  it('maps API statuses to tones and falls back to neutral', () => {
    expect(statusTone('BOOKED')).toBe('booked');
    expect(statusTone('CANCELLED')).toBe('cancelled');
    expect(statusTone('SOMETHING_NEW')).toBe('neutral');
  });
});
