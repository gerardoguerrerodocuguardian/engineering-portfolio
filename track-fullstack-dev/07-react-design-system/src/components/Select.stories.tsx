import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Select } from './Select';

const options = [
  { value: 'search', label: 'Search' },
  { value: 'social', label: 'Social' },
  { value: 'video', label: 'Video', disabled: true },
  { value: 'display', label: 'Display' },
];
const meta = { title: 'Components/Select', component: Select, args: { label: 'Channel', options } } satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const combo = within(canvasElement).getByRole('combobox');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect(combo).toHaveTextContent('Social');
  },
};
export const Preselected: Story = { args: { defaultValue: 'display' } };
export const Disabled: Story = { args: { disabled: true } };
