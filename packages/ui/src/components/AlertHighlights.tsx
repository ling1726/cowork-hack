import type { Highlight } from '@app/domain';
import { cn } from '../lib/utils.ts';
import { Card } from '../primitives/card.tsx';

const TONE = {
  neutral: 'text-foreground',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
} as const;

export function AlertHighlights({ highlights }: { highlights: Highlight[] }) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3"
      data-testid="highlights"
    >
      {highlights.map((h) => (
        <Card key={h.label} size="sm" className="gap-1 px-4 py-3" data-testid="highlight">
          <span className="text-xs font-medium text-muted-foreground">{h.label}</span>
          <span className={cn('text-2xl font-semibold tabular-nums', TONE[h.tone ?? 'neutral'])}>
            {h.value}
          </span>
        </Card>
      ))}
    </div>
  );
}
