import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './Button';

const meta = { title: 'Components/Button', component: Button, args: { children: 'Launch campaign', onClick: fn() } } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Launch campaign' });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Delete' } };
export const Loading: Story = {
  args: { loading: true, children: 'Saving' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button'));
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
export const AsLink: Story = { args: { asChild: true, children: <a href="#campaigns">Go to campaigns</a> } };
