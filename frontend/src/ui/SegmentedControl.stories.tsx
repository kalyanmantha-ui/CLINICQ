import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SegmentedControl } from './SegmentedControl';

const meta: Meta = { title: 'Actions/SegmentedControl' };
export default meta;

export const CalendarOrList: StoryObj = {
  render: () => {
    const [v, setV] = useState<'calendar' | 'list'>('calendar');
    return <SegmentedControl label="View" value={v} onChange={setV} options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]} />;
  },
};
