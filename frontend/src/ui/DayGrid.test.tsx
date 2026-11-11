import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayGrid, type GridEvent } from './DayGrid';
import { expectNoA11yViolations } from '../test/axe';

// 17:00Z is 9:00 AM Pacific in winter.
const events: GridEvent[] = [
  { id: '1', columnId: 'chen', start: '2030-03-04T17:00:00Z', end: '2030-03-04T17:30:00Z', title: 'Pat Patient', subtitle: 'Dr. Chen', tone: 'booked' },
  { id: '2', columnId: 'chen', start: '2030-03-04T18:00:00Z', end: '2030-03-04T18:30:00Z', title: 'Open', tone: 'open' },
  { id: '3', columnId: 'park', start: '2030-03-04T19:00:00Z', end: '2030-03-04T20:00:00Z', title: 'Sam Lee', tone: 'completed' },
];
const columns = [{ id: 'chen', label: 'Dr. Chen' }, { id: 'park', label: 'Dr. Park' }];
const grid = (extra = {}) => <DayGrid label="Schedule" columns={columns} events={events} fromHour={9} toHour={17} {...extra} />;

describe('DayGrid', () => {
  it('has one column heading per doctor', () => {
    render(grid());
    expect(screen.getByText('Dr. Chen')).toBeInTheDocument();
    expect(screen.getByText('Dr. Park')).toBeInTheDocument();
  });

  it('places each block by its start time and sizes it by its length', () => {
    render(grid({ hourHeight: 80 }));
    expect(screen.getByRole('button', { name: /9:00 AM Pat Patient/ })).toHaveStyle({ top: '0px', height: '36px' });
    expect(screen.getByRole('button', { name: /11:00 AM Sam Lee/ })).toHaveStyle({ top: '160px', height: '76px' });
  });

  it('names each block with its time, person and status', () => {
    render(grid());
    expect(screen.getByRole('button', { name: '9:00 AM Pat Patient, Dr. Chen, booked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10:00 AM Open, open' })).toBeInTheDocument();
  });

  it('reports a clicked block and marks the selected one', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(grid({ onSelect }));
    await userEvent.click(screen.getByRole('button', { name: /Pat Patient/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    rerender(grid({ selectedId: '1' }));
    expect(screen.getByRole('button', { name: /Pat Patient/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(grid());
    await expectNoA11yViolations(container);
  });
});
