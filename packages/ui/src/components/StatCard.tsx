import type { ReactNode } from 'react';
import { cn } from '../lib/utils.ts';
import { Card } from '../primitives/card.tsx';
import { Skeleton } from '../primitives/skeleton.tsx';

const TONE = {
  default: 'text-foreground',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
} as const;

export interface StatCardProps {
  label: string;
  /** `undefined` while loading or after an error: shows a skeleton, never a misleading 0. */
  value: number | undefined;
  href: string;
  renderLink: (href: string, children: ReactNode) => ReactNode;
  tone?: keyof typeof TONE;
}

/** An overview number that links to the list it counts. */
export function StatCard({ label, value, href, renderLink, tone = 'default' }: StatCardProps) {
  return (
    <Card
      size="sm"
      data-testid="stat-card"
      className="relative gap-1 px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <span className="text-xs font-medium text-muted-foreground">
        {renderLink(
          href,
          <>
            <span className="absolute inset-0" aria-hidden />
            {label}
          </>,
        )}
      </span>
      {value === undefined ? (
        <Skeleton data-testid="stat-skeleton" className="h-8 w-12" />
      ) : (
        <span className={cn('text-3xl font-semibold tabular-nums', TONE[tone])}>{value}</span>
      )}
    </Card>
  );
}
