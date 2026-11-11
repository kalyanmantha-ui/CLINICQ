import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';

function Demo() {
  const [v, setV] = useState<'calendar' | 'list'>('calendar');
  return <SegmentedControl label="View" value={v} onChange={setV} options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]} />;
}

describe('SegmentedControl', () => {
  it('behaves like a radio group', async () => {
    render(<Demo />);
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Calendar' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'List' }));
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
  });

  it('moves with the arrow keys and keeps one tab stop', async () => {
    render(<Demo />);
    screen.getByRole('radio', { name: 'Calendar' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'List' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Calendar' })).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Calendar' })).toBeChecked();
  });
});
