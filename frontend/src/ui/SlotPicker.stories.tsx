import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { Slot } from '../api';
import { SlotPicker } from './SlotPicker';

const slots: Slot[] = [];
for (const day of [4, 5, 6]) for (const [h, m] of [[9, 0], [9, 30], [10, 30], [13, 0], [14, 30], [16, 0]]) {
  const iso = new Date(Date.UTC(2030, 2, day, h + 8, m)).toISOString();
  slots.push({ id: `${day}-${h}-${m}`, doctorId: 'd1', startAt: iso, endAt: iso, status: 'OPEN' });
}

const meta: Meta = { title: 'Patient/SlotPicker' };
export default meta;
export const ThreeDays: StoryObj = {
  render: () => { const [id, setId] = useState<string | null>(null); return <SlotPicker slots={slots} selectedId={id} onSelect={(s) => setId(s.id)} />; },
};
