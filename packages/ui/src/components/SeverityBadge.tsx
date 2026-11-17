import { SEVERITY_LABELS, type Severity } from '@app/domain';
import { cn } from '../lib/utils.ts';
import { Badge } from '../primitives/badge.tsx';

const TONE: Record<Severity, { badge: string; dot: string }> = {
  low: { badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/60' },
  medium: {
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  high: {
    badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  critical: {
    badge: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
    dot: 'bg-destructive',
  },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone = TONE[severity];
  return (
    <Badge data-testid="severity-badge" data-severity={severity} className={tone.badge}>
      <span aria-hidden className={cn('size-1.5 rounded-full', tone.dot)} />
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
