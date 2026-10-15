import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { TextField } from './TextField';

const meta = { title: 'Components/TextField', component: TextField, args: { label: 'Campaign name' } } satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Campaign name');
    await userEvent.type(input, 'Autumn promo');
    await expect(input).toHaveValue('Autumn promo');
  },
};
export const WithDescription: Story = { args: { description: 'Shown only to your team', required: true } };
export const WithError: Story = {
  args: { error: 'Name must be at least 3 characters', defaultValue: 'ab' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Campaign name')).toBeInvalid();
  },
};
