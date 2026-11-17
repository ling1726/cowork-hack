import type { AlertSort, AlertSummary, User } from '@app/domain';
import {
  createColumnHelper,
  FlexRender,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../lib/utils.ts';
import { formatDateTime, formatShortDateTime, nameOf } from '../format.ts';
import { AvatarGroup } from '../primitives/avatar.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../primitives/table.tsx';
import { AlertStatusBadge } from './AlertStatusBadge.tsx';
import { SeverityBadge } from './SeverityBadge.tsx';
import { UserAvatar } from './UserAvatar.tsx';

type SortField = 'createdAt' | 'updatedAt' | 'severity';
const SORT_FIELDS: readonly string[] = ['createdAt', 'updatedAt', 'severity'];

export interface AlertTableProps {
  items: AlertSummary[];
  sort?: AlertSort;
  onSortChange?: (sort: AlertSort) => void;
  renderAlertLink: (id: string, label: string) => ReactNode;
  /** Called when a row is clicked outside its links and buttons. */
  onRowClick?: (id: string) => void;
  /** Resolves assignee names; ids are shown when missing. */
  users?: User[];
  /** A trailing per-row control (for example Investigate in Cowork). Row clicks ignore buttons. */
  renderRowAction?: (alert: AlertSummary) => ReactNode;
}

function parseSort(sort: AlertSort | undefined): SortingState {
  if (!sort) return [];
  return [{ id: sort.replace(/^-/, ''), desc: sort.startsWith('-') }];
}

const features = tableFeatures({ rowSortingFeature });
const col = createColumnHelper<typeof features, AlertSummary>();

export function AlertTable({
  items,
  sort,
  onSortChange,
  renderAlertLink,
  onRowClick,
  users = [],
  renderRowAction,
}: AlertTableProps) {
  const sorting = parseSort(sort);
  const current = sorting[0];

  const columns = col.columns([
    col.accessor('id', {
      header: 'ID',
      cell: (c) => (
        <span className="font-mono text-xs font-medium">
          {renderAlertLink(c.getValue(), c.getValue())}
        </span>
      ),
    }),
    col.accessor('title', {
      header: 'Title',
      cell: (c) => (
        <span className="block max-w-[22rem] truncate font-medium" title={c.getValue()}>
          {c.getValue()}
        </span>
      ),
    }),
    col.accessor('severity', {
      header: 'Severity',
      cell: (c) => <SeverityBadge severity={c.getValue()} />,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (c) => <AlertStatusBadge status={c.getValue()} />,
    }),
    col.accessor('assignees', {
      header: 'Assignees',
      cell: (c) => {
        const { primaryId, backupId } = c.getValue();
        const primary = nameOf(users, primaryId);
        const backup = nameOf(users, backupId);
        return (
          <span
            className="flex items-center gap-2"
            title={`${primary} (primary), ${backup} (backup)`}
          >
            <AvatarGroup className="-space-x-1">
              <UserAvatar name={primary} />
              <UserAvatar name={backup} />
            </AvatarGroup>
            <span className="sr-only">
              {primary} (primary), {backup} (backup)
            </span>
          </span>
        );
      },
    }),
    col.accessor('trader', {
      header: 'Trader',
      cell: (c) => (
        <span className="whitespace-nowrap">
          {c.getValue().name} <span className="text-muted-foreground">({c.getValue().id})</span>
        </span>
      ),
    }),
    col.accessor('createdAt', {
      header: 'Created',
      cell: (c) => (
        <span
          className="whitespace-nowrap text-muted-foreground"
          title={formatDateTime(c.getValue())}
        >
          {formatShortDateTime(c.getValue())}
        </span>
      ),
    }),
    col.accessor('updatedAt', {
      header: 'Updated',
      cell: (c) => (
        <span
          className="whitespace-nowrap text-muted-foreground"
          title={formatDateTime(c.getValue())}
        >
          {formatShortDateTime(c.getValue())}
        </span>
      ),
    }),
    ...(renderRowAction
      ? [
          col.display({
            id: 'actions',
            header: 'Actions',
            cell: (c) => (
              <span className="flex justify-end">{renderRowAction(c.row.original)}</span>
            ),
          }),
        ]
      : []),
  ]);

  // Sorting and paging happen on the server: the table renders what it is given.
  const table = useTable({
    features,
    columns,
    data: items,
    getRowId: (a) => a.id,
    manualSorting: true,
    state: { sorting },
  });

  const handleSort = (field: SortField) => {
    // First click sorts descending (highest severity / newest first); a second click flips it.
    const descending = current?.id === field ? !current.desc : true;
    onSortChange?.((descending ? `-${field}` : field) as AlertSort);
  };

  const handleRowClick = (e: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    onRowClick?.(id);
  };

  return (
    <Table aria-label="Alerts">
      <TableHeader className="bg-muted/50">
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((header) => {
              const field = header.column.id;
              const label = String(header.column.columnDef.header);
              if (field === 'actions') {
                return (
                  <TableHead key={header.id}>
                    <span className="sr-only">{label}</span>
                  </TableHead>
                );
              }
              if (!SORT_FIELDS.includes(field)) {
                return (
                  <TableHead key={header.id} className="text-xs font-medium text-muted-foreground">
                    {label}
                  </TableHead>
                );
              }
              const active = current?.id === field;
              const Icon = !active ? ArrowUpDown : current.desc ? ArrowDown : ArrowUp;
              return (
                <TableHead
                  key={header.id}
                  aria-sort={active ? (current.desc ? 'descending' : 'ascending') : 'none'}
                  className="text-xs font-medium text-muted-foreground"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(field as SortField)}
                    className={cn(
                      '-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                      active && 'text-foreground',
                    )}
                  >
                    {label}
                    <Icon aria-hidden className={cn('size-3.5', !active && 'opacity-50')} />
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-testid="alert-row"
            onClick={(e) => handleRowClick(e, row.id)}
            className={cn(onRowClick && 'cursor-pointer')}
          >
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id} className="py-2.5">
                <FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
