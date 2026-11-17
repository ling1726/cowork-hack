import { ALERT_STATUS_LABELS, type AlertStatus } from '@app/domain';
import { Badge } from '../primitives/badge.tsx';

const TONE: Record<AlertStatus, string> = {
  open: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  in_progress: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  closed: 'border-border bg-muted text-muted-foreground',
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge
      data-testid="status-badge"
      data-status={status}
      variant="outline"
      className={TONE[status]}
    >
      {ALERT_STATUS_LABELS[status]}
    </Badge>
  );
}
