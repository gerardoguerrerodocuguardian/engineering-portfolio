import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent } from 'storybook/test';
import { Tooltip } from './Tooltip';
import { Button } from './Button';

const meta = { title: 'Components/Tooltip', component: Tooltip, args: { content: 'Tooltip text', children: <span /> } } satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OnFocus: Story = {
  render: () => (
    <Tooltip content="Archived campaigns stay in reports">
      <Button variant="secondary">Archive</Button>
    </Tooltip>
  ),
  play: async () => {
    await userEvent.tab();
    await expect(await screen.findByRole('tooltip')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(screen.queryByRole('tooltip')).toBeNull();
  },
};
