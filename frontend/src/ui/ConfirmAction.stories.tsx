import type { Meta, StoryObj } from '@storybook/react';
import { ConfirmAction } from './ConfirmAction';

const meta: Meta<typeof ConfirmAction> = {
  title: 'Actions/ConfirmAction', component: ConfirmAction,
  args: { label: 'Cancel', confirmLabel: 'Yes, cancel it', keepLabel: 'Keep it', onConfirm: () => new Promise((r) => setTimeout(r, 800)) },
};
export default meta;
export const Default: StoryObj<typeof ConfirmAction> = {};
