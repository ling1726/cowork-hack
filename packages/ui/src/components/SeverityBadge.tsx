import { SEVERITY_LABELS, type Severity } from '@app/domain';
import { Badge } from '@fluentui/react-components';

const COLOR = {
  low: 'informative',
  medium: 'warning',
  high: 'severe',
  critical: 'danger',
} as const;

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge data-testid="severity-badge" appearance="tint" color={COLOR[severity]}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
