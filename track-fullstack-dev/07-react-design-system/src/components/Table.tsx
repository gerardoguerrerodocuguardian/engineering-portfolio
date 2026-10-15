import { forwardRef, useMemo, useState, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cx } from '../internal/utils';

export type SortDirection = 'ascending' | 'descending';

const Root = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(function Table({ className, ...rest }, ref) {
  return <table ref={ref} className={cx('adf-table', className)} {...rest} />;
});
const Caption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(function Caption({ className, ...rest }, ref) {
  return <caption ref={ref} className={cx('adf-table__caption', className)} {...rest} />;
});
const Header = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function Header(props, ref) {
  return <thead ref={ref} {...props} />;
});
const Body = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function Body(props, ref) {
  return <tbody ref={ref} {...props} />;
});
const Row = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(function Row(props, ref) {
  return <tr ref={ref} {...props} />;
});
const Cell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(function Cell({ className, ...rest }, ref) {
  return <td ref={ref} className={cx('adf-table__cell', className)} {...rest} />;
});

export interface TableHeadProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  /** Current sort of this column. Omit for non-sortable columns (no button, no aria-sort). */
  sortDirection?: SortDirection | 'none';
  /** Providing this makes the column sortable: the header renders a real <button>. */
  onSort?: () => void;
}

/** Column header. Sortable headers expose `aria-sort` on the <th> and a native button for the action. */
const Head = forwardRef<HTMLTableCellElement, TableHeadProps>(function Head(
  { sortDirection = 'none', onSort, className, children, scope = 'col', ...rest },
  ref,
) {
  return (
    <th
      ref={ref}
      scope={scope}
      className={cx('adf-table__head', className)}
      aria-sort={onSort ? sortDirection : undefined}
      {...rest}
    >
      {onSort ? (
        <button type="button" className="adf-table__sort" onClick={onSort}>
          {children}
          <span aria-hidden="true" className="adf-table__sort-icon" data-direction={sortDirection} />
        </button>
      ) : (
        children
      )}
    </th>
  );
});

export const Table = Object.assign(Root, { Caption, Header, Body, Row, Head, Cell });

/** Client-side sorting helper: none -> ascending -> descending -> ascending... */
export function useTableSort<T>(rows: readonly T[], accessors: Record<string, (row: T) => string | number>, initial?: { key: string; direction: SortDirection }) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>(initial);

  const sorted = useMemo(() => {
    const accessor = sort && accessors[sort.key];
    if (!sort || !accessor) return [...rows];
    const factor = sort.direction === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return result * factor;
    });
  }, [rows, accessors, sort]);

  const toggle = (key: string) =>
    setSort((prev) => ({ key, direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
  const directionOf = (key: string): SortDirection | 'none' => (sort?.key === key ? sort.direction : 'none');

  return { rows: sorted, sort, toggle, directionOf };
}
