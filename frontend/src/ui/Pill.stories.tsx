import type { Meta, StoryObj } from '@storybook/react';
import { Pill } from './Pill';

const meta: Meta<typeof Pill> = { title: 'Display/Pill', component: Pill, args: { children: 'booked', tone: 'booked' } };
export default meta;
type Story = StoryObj<typeof Pill>;

export const Booked: Story = {};
export const Waiting: Story = { args: { tone: 'waiting', children: 'waiting' } };
export const Offered: Story = { args: { tone: 'offered', children: 'offered' } };
export const Completed: Story = { args: { tone: 'completed', children: 'completed' } };
export const Cancelled: Story = { args: { tone: 'cancelled', children: 'cancelled' } };
export const AllTones: Story = {
  render: () => <div className="row">{(['neutral', 'booked', 'waiting', 'offered', 'completed', 'cancelled', 'role', 'open'] as const).map((t) => <Pill key={t} tone={t}>{t}</Pill>)}</div>,
};
