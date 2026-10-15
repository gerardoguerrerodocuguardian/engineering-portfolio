import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Table, useTableSort } from './Table';

const data = [
  { name: 'Spring launch', spend: 300 },
  { name: 'Autumn promo', spend: 120 },
  { name: 'Brand video', spend: 900 },
];
const accessors = { name: (r: (typeof data)[number]) => r.name, spend: (r: (typeof data)[number]) => r.spend };

function SortableTable() {
  const { rows, toggle, directionOf } = useTableSort(data, accessors);
  return (
    <Table>
      <Table.Caption>Campaign spend (synthetic)</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head sortDirection={directionOf('name')} onSort={() => toggle('name')}>Name</Table.Head>
          <Table.Head sortDirection={directionOf('spend')} onSort={() => toggle('spend')}>Spend</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((r) => (
          <Table.Row key={r.name}>
            <Table.Cell>{r.name}</Table.Cell>
            <Table.Cell>{r.spend}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

const meta = { title: 'Components/Table', component: Table } satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sortable: Story = {
  render: () => <SortableTable />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Spend' }));
    await expect(within(canvasElement).getByRole('columnheader', { name: 'Spend' })).toHaveAttribute('aria-sort', 'ascending');
  },
};
