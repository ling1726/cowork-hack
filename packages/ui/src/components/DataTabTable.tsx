import type { DataTab } from '@app/domain';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@fluentui/react-components';
import { formatDateTimeSeconds, formatEuro, formatNumber } from '../format.ts';

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
    <Table size="small" aria-label={tab.title} data-testid="data-table">
      <TableHeader>
        <TableRow>
          {tab.columns.map((c) => (
            <TableHeaderCell key={c.key}>{c.label}</TableHeaderCell>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tab.rows.map((row, i) => (
          <TableRow key={i} data-testid="data-row">
            {tab.columns.map((c) => (
              <TableCell key={c.key}>{formatCell(c.type, row[c.key])}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
