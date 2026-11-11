import type { Meta, StoryObj } from '@storybook/react';
import { SelectField, TextAreaField, TextField } from './Field';

const meta: Meta<typeof TextField> = { title: 'Forms/Fields', component: TextField, args: { label: 'Email' } };
export default meta;
type Story = StoryObj<typeof TextField>;

export const Text: Story = {};
export const WithHint: Story = { args: { label: 'Password', type: 'password', hint: 'At least 8 characters.' } };
export const WithError: Story = { args: { error: 'Enter a valid email address.', defaultValue: 'pat@' } };
export const Select: Story = {
  render: () => <SelectField label="Doctor"><option>Dr. Sarah Chen</option><option>Dr. Priya Rao</option></SelectField>,
};
export const TextArea: Story = { render: () => <TextAreaField label="Notes" hint="Only your doctor can read this." /> };
