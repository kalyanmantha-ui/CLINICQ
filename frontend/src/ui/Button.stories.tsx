import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = { title: 'Actions/Button', component: Button, args: { children: 'Book appointment' } };
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};
export const Primary: Story = { args: { variant: 'primary' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Cancel appointment' } };
export const Busy: Story = { args: { variant: 'primary', busy: true, children: 'Saving' } };
export const Disabled: Story = { args: { disabled: true } };
