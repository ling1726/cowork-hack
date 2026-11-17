import {
  ACTION_REQUEST_KIND_LABELS,
  ACTION_REQUEST_STATUS_LABELS,
  type ActionRequest,
  type ActionRequestStatus,
  type AlertSummary,
} from '@app/domain';
import { Badge, Button, Card, Input, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useState, type ReactNode } from 'react';
import { formatDateTime } from '../format.ts';

const STATUS_COLOR: Record<ActionRequestStatus, 'warning' | 'success' | 'danger' | 'important'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  failed: 'important',
};

const useStyles = makeStyles({
  card: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  label: { color: tokens.colorNeutralForeground2 },
  preview: {
    margin: 0,
    padding: tokens.spacingVerticalS,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorNeutralBackground3,
    whiteSpace: 'pre-wrap',
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});

export interface ActionRequestCardProps {
  request: ActionRequest;
  alert: AlertSummary;
  onApprove?: () => void;
  onReject?: (reason?: string) => void;
  busy?: boolean;
  renderAlertLink: (id: string, label: string) => ReactNode;
}

export function ActionRequestCard({
  request,
  alert,
  onApprove,
  onReject,
  busy,
  renderAlertLink,
}: ActionRequestCardProps) {
  const styles = useStyles();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const pending = request.status === 'pending';

  return (
    <Card className={styles.card} data-testid="action-request-card" data-request-id={request.id}>
      <div className={styles.head}>
        <Text weight="semibold">{ACTION_REQUEST_KIND_LABELS[request.kind]}</Text>
        <Badge data-testid="request-status" appearance="tint" color={STATUS_COLOR[request.status]}>
          {ACTION_REQUEST_STATUS_LABELS[request.status]}
        </Badge>
      </div>
      <Text size={200} className={styles.label}>
        Requested by Claude for {request.onBehalfOf} · {formatDateTime(request.createdAt)} ·{' '}
        {request.id}
      </Text>
      <div>{renderAlertLink(alert.id, `${alert.id} ${alert.title}`)}</div>

      <Text size={200} className={styles.label}>
        Claude's rationale
      </Text>
      <Text data-testid="rationale">{request.rationale}</Text>

      {request.kind === 'add_comment' ? (
        <>
          <Text size={200} className={styles.label}>
            Comment to be posted
          </Text>
          <blockquote className={styles.preview} data-testid="payload-preview">
            {request.payload.body}
          </blockquote>
        </>
      ) : (
        <Text size={200} className={styles.label}>
          Moves the alert to In Progress.
        </Text>
      )}

      {request.status === 'failed' && request.failure && (
        <Text data-testid="failure">Could not be applied: {request.failure.message}</Text>
      )}
      {request.status === 'rejected' && request.rejectReason && (
        <Text data-testid="reject-reason">Reason: {request.rejectReason}</Text>
      )}

      {pending && (onApprove || onReject) && (
        <div className={styles.actions}>
          {onApprove && (
            <Button appearance="primary" disabled={busy} onClick={onApprove}>
              Approve
            </Button>
          )}
          {onReject && !rejecting && (
            <Button disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          )}
          {onReject && rejecting && (
            <>
              <Input
                aria-label="Rejection reason"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(_e, d) => setReason(d.value)}
              />
              <Button
                disabled={busy}
                onClick={() => {
                  onReject(reason.trim() || undefined);
                  setRejecting(false);
                  setReason('');
                }}
              >
                Confirm reject
              </Button>
              <Button appearance="subtle" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
