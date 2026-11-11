import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';
import { Notice } from './Notice';
import { SkeletonRows } from './Skeleton';
import { Avatar } from './Avatar';

const meta: Meta = { title: 'Display/Feedback' };
export default meta;

export const Notices: StoryObj = {
  render: () => <div className="stack"><Notice kind="ok">Appointment booked.</Notice><Notice kind="info">Your offer is held for 15 minutes.</Notice><Notice kind="error">Someone just took that time. Pick another, or join the waitlist.</Notice></div>,
};
export const Loading: StoryObj = { render: () => <SkeletonRows count={3} /> };
export const Empty: StoryObj = { render: () => <EmptyState>No appointments yet. Pick a doctor to book one.</EmptyState> };
export const Avatars: StoryObj = { render: () => <div className="row"><Avatar name="Dr. Sarah Chen" /><Avatar name="Pat Patient" /></div> };
