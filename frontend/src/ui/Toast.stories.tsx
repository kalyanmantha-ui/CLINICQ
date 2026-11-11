import type { Meta, StoryObj } from '@storybook/react';
import { ToastProvider, useToast } from './Toast';

function Buttons() {
  const toast = useToast();
  return (
    <div className="row">
      <button onClick={() => toast('ok', 'Appointment booked.')}>Success</button>
      <button onClick={() => toast('info', 'Offer declined. The next person has been notified.')}>Info</button>
      <button onClick={() => toast('error', 'Someone just took that time.')}>Error</button>
    </div>
  );
}

const meta: Meta = { title: 'Feedback/Toast', decorators: [(Story) => <ToastProvider><Story /></ToastProvider>] };
export default meta;
export const Playground: StoryObj = { render: () => <Buttons /> };
