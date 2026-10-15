import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Dialog } from './Dialog';

const meta = { title: 'Components/Dialog', component: Dialog, args: { children: null } } satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger>Pause campaign</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Pause campaign?</Dialog.Title>
        <Dialog.Description>Spend stops immediately. You can resume at any time.</Dialog.Description>
        <Dialog.Close>Keep running</Dialog.Close> <Dialog.Close>Pause</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Pause campaign' });
    await userEvent.click(trigger);
    await expect(await screen.findByRole('dialog', { name: 'Pause campaign?' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(screen.queryByRole('dialog')).toBeNull();
    await expect(trigger).toHaveFocus();
  },
};
