import {
  ALLOWED_ACTION_LABELS,
  DESK_LABELS,
  type AllowedAction,
  type AlertSummary,
} from '@app/domain';
import { Badge, Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { AlertStatusBadge } from './AlertStatusBadge.tsx';
import { SeverityBadge } from './SeverityBadge.tsx';

const HEADER_ACTIONS: AllowedAction[] = ['acknowledge', 'close', 'reopen', 'escalate'];

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  title: { margin: 0 },
  meta: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    color: tokens.colorNeutralForeground2,
  },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
});

export interface AlertHeaderProps {
  alert: AlertSummary;
  actions: AllowedAction[];
  onAction: (action: AllowedAction) => void;
  pendingCount?: number;
}

export function AlertHeader({ alert, actions, onAction, pendingCount }: AlertHeaderProps) {
  const styles = useStyles();
  const buttons = HEADER_ACTIONS.filter((a) => actions.includes(a));
  return (
    <header className={styles.root}>
      <div className={styles.titleRow}>
        <Text weight="semibold" size={300}>
          {alert.id}
        </Text>
        <AlertStatusBadge status={alert.status} />
        <SeverityBadge severity={alert.severity} />
        {pendingCount ? (
          <Badge data-testid="pending-count" appearance="tint" color="brand">
            {pendingCount}
          </Badge>
        ) : null}
      </div>
      <h1 className={styles.title}>
        <Text as="span" size={700} weight="semibold">
          {alert.title}
        </Text>
      </h1>
      <div className={styles.meta}>
        <Text>{alert.rule.name}</Text>
        <Text>{DESK_LABELS[alert.desk]}</Text>
        <Text>
          {alert.trader.name} ({alert.trader.id})
        </Text>
        <Text>{alert.instrument.symbol}</Text>
      </div>
      {buttons.length > 0 && (
        <div className={styles.actions}>
          {buttons.map((action) => (
            <Button
              key={action}
              data-testid={`action-${action}`}
              appearance={action === 'acknowledge' || action === 'reopen' ? 'primary' : 'secondary'}
              onClick={() => onAction(action)}
            >
              {ALLOWED_ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      )}
    </header>
  );
}
