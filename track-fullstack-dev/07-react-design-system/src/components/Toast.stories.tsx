import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, within } from 'storybook/test';
import { ToastProvider, useToast } from './Toast';
import { Button } from './Button';

function Demo() {
  const { toast } = useToast();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button onClick={() => toast({ title: 'Saved', description: 'Campaign updated', tone: 'success' })}>Success</Button>
      <Button variant="danger" onClick={() => toast({ title: 'Payment failed', tone: 'danger', duration: Infinity })}>
        Error
      </Button>
    </div>
  );
}

const meta = { title: 'Components/Toast', component: ToastProvider, args: { children: null }, decorators: [(Story) => <ToastProvider><Story /></ToastProvider>] } satisfies Meta<typeof ToastProvider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Error' }));
    await expect(await screen.findByRole('alert')).toHaveTextContent('Payment failed');
  },
};
