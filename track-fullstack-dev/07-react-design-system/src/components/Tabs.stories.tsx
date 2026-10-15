import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Tabs } from './Tabs';

const meta = { title: 'Components/Tabs', component: Tabs } satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Tabs defaultValue="overview" {...args}>
      <Tabs.List aria-label="Campaign sections">
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
        <Tabs.Trigger value="audit">Audit</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview">Delivery and pacing summary.</Tabs.Content>
      <Tabs.Content value="billing">Synthetic invoices.</Tabs.Content>
      <Tabs.Content value="audit">Change history.</Tabs.Content>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Billing' })).toHaveFocus();
    await expect(canvas.getByRole('tabpanel', { name: 'Billing' })).toBeVisible();
  },
};
export const Vertical: Story = {
  ...Default,
  args: { orientation: 'vertical' },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    await expect(within(canvasElement).getByRole('tab', { name: 'Billing' })).toHaveFocus();
  },
};
