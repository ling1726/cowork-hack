import { Button, cn } from '@app/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Up to five page numbers around the current page. */
function window5(page: number, pages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min(total, (page - 1) * pageSize + 1);
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
      <p className="text-muted-foreground">
        Showing{' '}
        <span className="font-medium text-foreground tabular-nums">
          {from}–{to}
        </span>{' '}
        of <span className="font-medium text-foreground tabular-nums">{total}</span>
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination" data-testid="pagination">
        <span className="mr-2 text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        {window5(Math.min(page, pages), pages).map((n) => (
          <Button
            key={n}
            variant={n === page ? 'outline' : 'ghost'}
            size="icon-sm"
            aria-label={`Page ${n}`}
            aria-current={n === page ? 'page' : undefined}
            className={cn('hidden tabular-nums sm:inline-flex', n === page && 'font-semibold')}
            onClick={() => onPageChange(n)}
          >
            {n}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}
