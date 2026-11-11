import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Slot } from '../api';
import { SlotPicker } from './SlotPicker';
import { expectNoA11yViolations } from '../test/axe';

// Winter dates, so Pacific time is UTC-8: 17:00Z is 9:00 AM.
const slot = (id: string, iso: string): Slot => ({ id, doctorId: 'd1', startAt: iso, endAt: iso, status: 'OPEN' });
const SLOTS = [
  slot('a', '2030-03-04T17:00:00Z'),
  slot('b', '2030-03-04T18:30:00Z'),
  slot('c', '2030-03-04T22:00:00Z'),
  slot('d', '2030-03-05T17:00:00Z'),
];

describe('SlotPicker', () => {
  it('shows a chip per day with how many times are open', () => {
    render(<SlotPicker slots={SLOTS} onSelect={() => {}} />);
    const strip = screen.getByRole('group', { name: 'Choose a day' });
    expect(within(strip).getAllByRole('button')).toHaveLength(2);
    expect(within(strip).getByRole('button', { name: /Mon 4 3 open ?, March 4/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(strip).getByRole('button', { name: /Tue 5 1 open ?, March 5/ })).toBeInTheDocument();
  });

  it('groups the chosen day into morning and afternoon', () => {
    render(<SlotPicker slots={SLOTS} onSelect={() => {}} />);
    expect(within(screen.getByRole('region', { name: 'Morning' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['9:00 AM', '10:30 AM']);
    expect(within(screen.getByRole('region', { name: 'Afternoon' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['2:00 PM']);
    expect(screen.queryByRole('region', { name: 'Evening' })).not.toBeInTheDocument();
  });

  it('switches day and reports the chosen slot', async () => {
    const onSelect = vi.fn();
    render(<SlotPicker slots={SLOTS} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Tue 5 1 open/ }));
    expect(screen.queryByRole('button', { name: '10:30 AM' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'd' }));
  });

  it('marks the selected time', () => {
    render(<SlotPicker slots={SLOTS} selectedId="b" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: '10:30 AM' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '9:00 AM' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SlotPicker slots={SLOTS} onSelect={() => {}} />);
    await expectNoA11yViolations(container);
  });
});
