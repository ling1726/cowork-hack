import { ALERT_STATUS_LABELS, type AlertStatus } from '@app/domain';
import { Badge } from '@fluentui/react-components';

const COLOR = { open: 'warning', in_progress: 'brand', closed: 'success' } as const;

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge data-testid="status-badge" appearance="filled" color={COLOR[status]}>
      {ALERT_STATUS_LABELS[status]}
    </Badge>
  );
}
