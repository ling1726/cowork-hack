import { DESK_LABELS, type AlertSort, type AlertSummary } from '@app/domain';
import {
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  TableCellLayout,
  createTableColumn,
  type TableColumnDefinition,
} from '@fluentui/react-components';
import type { ReactNode } from 'react';
import { formatDateTime } from '../format.ts';
import { AlertStatusBadge } from './AlertStatusBadge.tsx';
import { SeverityBadge } from './SeverityBadge.tsx';

type SortField = 'createdAt' | 'updatedAt' | 'severity';

export interface AlertTableProps {
  items: AlertSummary[];
  sort?: AlertSort;
  onSortChange?: (sort: AlertSort) => void;
  renderAlertLink: (id: string, label: string) => ReactNode;
}

function parseSort(sort: AlertSort | undefined): { field?: SortField; descending: boolean } {
  if (!sort) return { descending: true };
  const descending = sort.startsWith('-');
  return { field: sort.replace(/^-/, '') as SortField, descending };
}

export function AlertTable({ items, sort, onSortChange, renderAlertLink }: AlertTableProps) {
  const current = parseSort(sort);
  // Sorting happens on the server. Fluent treats a column as sortable only when `compare` declares
  // parameters (`compare.length > 0`), so this no-op comparator must keep both of them.
  const sortable = { compare: (_a: AlertSummary, _b: AlertSummary) => 0 };

  const columns: TableColumnDefinition<AlertSummary>[] = [
    createTableColumn<AlertSummary>({
      columnId: 'id',
      renderHeaderCell: () => 'ID',
      renderCell: (a) => <TableCellLayout>{renderAlertLink(a.id, a.id)}</TableCellLayout>,
    }),
    createTableColumn<AlertSummary>({
      columnId: 'title',
      renderHeaderCell: () => 'Title',
      renderCell: (a) => <TableCellLayout truncate>{a.title}</TableCellLayout>,
    }),
    createTableColumn<AlertSummary>({
      columnId: 'severity',
      ...sortable,
      renderHeaderCell: () => 'Severity',
      renderCell: (a) => <SeverityBadge severity={a.severity} />,
    }),
    createTableColumn<AlertSummary>({
      columnId: 'status',
      renderHeaderCell: () => 'Status',
      renderCell: (a) => <AlertStatusBadge status={a.status} />,
    }),
    createTableColumn<AlertSummary>({
      columnId: 'desk',
      renderHeaderCell: () => 'Desk',
      renderCell: (a) => DESK_LABELS[a.desk],
    }),
    createTableColumn<AlertSummary>({
      columnId: 'trader',
      renderHeaderCell: () => 'Trader',
      renderCell: (a) => `${a.trader.name} (${a.trader.id})`,
    }),
    createTableColumn<AlertSummary>({
      columnId: 'createdAt',
      ...sortable,
      renderHeaderCell: () => 'Created',
      renderCell: (a) => formatDateTime(a.createdAt),
    }),
    createTableColumn<AlertSummary>({
      columnId: 'updatedAt',
      ...sortable,
      renderHeaderCell: () => 'Updated',
      renderCell: (a) => formatDateTime(a.updatedAt),
    }),
  ];

  const handleSort = (field: SortField) => {
    // First click on a column sorts descending (highest severity / newest first); a second click flips it.
    const descending = current.field === field ? !current.descending : true;
    onSortChange?.((descending ? `-${field}` : field) as AlertSort);
  };

  return (
    <DataGrid
      items={items}
      columns={columns}
      getRowId={(a: AlertSummary) => a.id}
      sortable
      sortState={
        current.field
          ? {
              sortColumn: current.field,
              sortDirection: current.descending ? 'descending' : 'ascending',
            }
          : undefined
      }
      onSortChange={(_e, state) => handleSort(state.sortColumn as SortField)}
      focusMode="composite"
      aria-label="Alerts"
    >
      <DataGridHeader>
        <DataGridRow>
          {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
        </DataGridRow>
      </DataGridHeader>
      <DataGridBody<AlertSummary>>
        {({ item, rowId }) => (
          <DataGridRow<AlertSummary> key={rowId} data-testid="alert-row">
            {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
          </DataGridRow>
        )}
      </DataGridBody>
    </DataGrid>
  );
}
