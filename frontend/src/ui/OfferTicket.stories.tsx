import type { Meta, StoryObj } from '@storybook/react';
import { OfferTicket } from './OfferTicket';

const now = Date.now();
const inSeconds = (s: number) => new Date(now + s * 1000).toISOString();
const meta: Meta<typeof OfferTicket> = {
  title: 'Patient/OfferTicket', component: OfferTicket,
  args: { doctorName: 'Dr. Sarah Chen', when: 'Mon, Mar 4 · 9:00 AM', now, expiresAt: inSeconds(14 * 60), onAccept: () => {}, onDecline: () => {} },
};
export default meta;
type Story = StoryObj<typeof OfferTicket>;

export const Fresh: Story = {};
export const Urgent: Story = { args: { expiresAt: inSeconds(75) } };
export const Expired: Story = { args: { expiresAt: inSeconds(-1) } };
