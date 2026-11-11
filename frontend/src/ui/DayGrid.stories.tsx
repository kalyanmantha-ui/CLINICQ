import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DayGrid, type GridEvent } from './DayGrid';

const t = (h: number, m = 0) => new Date(Date.UTC(2030, 2, 4, h + 8, m)).toISOString();
const events: GridEvent[] = [
  { id: '1', columnId: 'chen', start: t(9), end: t(9, 30), title: 'Pat Patient', subtitle: 'Dr. Chen', tone: 'booked' },
  { id: '2', columnId: 'chen', start: t(9, 30), end: t(10), title: 'Open', tone: 'open' },
  { id: '3', columnId: 'chen', start: t(10), end: t(10, 30), title: 'Sam Lee', subtitle: 'Dr. Chen', tone: 'completed' },
  { id: '4', columnId: 'rao', start: t(9), end: t(10), title: 'Ana Ruiz', subtitle: 'Dr. Rao', tone: 'booked' },
  { id: '5', columnId: 'rao', start: t(11), end: t(11, 30), title: 'Open', tone: 'open' },
];
const columns = [{ id: 'chen', label: 'Dr. Sarah Chen' }, { id: 'rao', label: 'Dr. Priya Rao' }];

const meta: Meta = { title: 'Staff/DayGrid' };
export default meta;
export const TwoDoctors: StoryObj = {
  render: () => { const [id, setId] = useState<string | null>('1'); return <DayGrid label="Schedule for Monday" columns={columns} events={events} selectedId={id} onSelect={(e) => setId(e.id)} fromHour={9} toHour={13} />; },
};
