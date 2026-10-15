import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Table, useTableSort } from './Table';

const rows = [
  { name: 'Spring launch', spend: 300 },
  { name: 'Autumn promo', spend: 120 },
  { name: 'Brand video', spend: 900 },
];
const accessors = { name: (r: (typeof rows)[number]) => r.name, spend: (r: (typeof rows)[number]) => r.spend };

function Example() {
  const { rows: sorted, toggle, directionOf } = useTableSort(rows, accessors);
  return (
    <Table>
      <Table.Caption>Campaign spend</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head sortDirection={directionOf('name')} onSort={() => toggle('name')}>
            Name
          </Table.Head>
          <Table.Head sortDirection={directionOf('spend')} onSort={() => toggle('spend')}>
            Spend
          </Table.Head>
          <Table.Head>Notes</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sorted.map((r) => (
          <Table.Row key={r.name}>
            <Table.Cell>{r.name}</Table.Cell>
            <Table.Cell>{r.spend}</Table.Cell>
            <Table.Cell>-</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

const firstColumn = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]!.textContent);

describe('Table', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Example />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('only sortable columns expose aria-sort, starting as none', () => {
    render(<Example />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: 'Notes' })).not.toHaveAttribute('aria-sort');
  });

  it('sorts ascending then descending from the keyboard and updates aria-sort', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending');
    expect(firstColumn()).toEqual(['Autumn promo', 'Brand video', 'Spring launch']);
    await user.keyboard(' ');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'descending');
    expect(firstColumn()).toEqual(['Spring launch', 'Brand video', 'Autumn promo']);
  });

  it('sorts numerically and resets the previous column', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: 'Name' }));
    await user.click(screen.getByRole('button', { name: 'Spend' }));
    expect(firstColumn()).toEqual(['Autumn promo', 'Spring launch', 'Brand video']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'none');
  });
});
