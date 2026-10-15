import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton';

const meta = { title: 'Components/Skeleton', component: Skeleton } satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CardPlaceholder: Story = {
  render: () => (
    <section aria-busy="true" aria-label="Loading campaign" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Skeleton circle height="48px" />
      <div style={{ display: 'grid', gap: 8 }}>
        <Skeleton width="12rem" />
        <Skeleton width="8rem" />
      </div>
    </section>
  ),
};
