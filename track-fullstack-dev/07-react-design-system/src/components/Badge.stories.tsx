import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = { title: 'Components/Badge', component: Badge, args: { children: 'Active' } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};
export const Success: Story = { args: { tone: 'success', children: 'Delivering' } };
export const Warning: Story = { args: { tone: 'warning', children: 'Low budget' } };
export const Danger: Story = { args: { tone: 'danger', children: 'Rejected' } };
