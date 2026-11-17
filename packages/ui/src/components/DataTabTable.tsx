import type { DataTab } from '@app/domain';
import { cn } from '../lib/utils.ts';
import { formatDateTimeSeconds, formatEuro, formatNumber } from '../format.ts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../primitives/table.tsx';

const isNumeric = (type: DataTab['columns'][number]['type']) =>
  type === 'number' || type === 'currency';

function formatCell(
  type: DataTab['columns'][number]['type'],
  value: string | number | undefined,
): string {
  if (value === undefined || value === '') return '';
  switch (type) {
    case 'currency':
      return typeof value === 'number' ? formatEuro(value) : String(value);
    case 'number':
      return typeof value === 'number' ? formatNumber(value) : String(value);
    case 'datetime':
      return formatDateTimeSeconds(String(value));
    case 'string':
      return String(value);
  }
}

export function DataTabTable({ tab }: { tab: DataTab }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table aria-label={tab.title} data-testid="data-table">
        <TableHeader className="bg-muted/50">
          <TableRow>
            {tab.columns.map((c) => (
              <TableHead key={c.key} className={cn(isNumeric(c.type) && 'text-right')}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tab.rows.map((row, i) => (
            <TableRow key={i} data-testid="data-row">
              {tab.columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(isNumeric(c.type) && 'text-right tabular-nums')}
                >
                  {formatCell(c.type, row[c.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
