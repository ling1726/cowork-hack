import {
  ACTION_REQUEST_KIND_LABELS,
  ACTION_REQUEST_STATUS_LABELS,
  type ActionRequest,
  type ActionRequestStatus,
  type AlertSummary,
} from '@app/domain';
import { Bot } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatDateTime } from '../format.ts';
import { Badge } from '../primitives/badge.tsx';
import { Button } from '../primitives/button.tsx';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../primitives/card.tsx';
import { Input } from '../primitives/input.tsx';

const STATUS_TONE: Record<ActionRequestStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  failed: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
};

/** The request's status as a coloured badge (`data-testid="request-status"`). */
export function RequestStatusBadge({ status }: { status: ActionRequestStatus }) {
  return (
    <Badge data-testid="request-status" variant="outline" className={STATUS_TONE[status]}>
      {ACTION_REQUEST_STATUS_LABELS[status]}
    </Badge>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium text-muted-foreground">{children}</div>;
}

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
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const pending = request.status === 'pending';

  return (
    <Card data-testid="action-request-card" data-request-id={request.id}>
      <CardHeader className="gap-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Bot aria-hidden className="size-4 text-violet-600 dark:text-violet-400" />
            {ACTION_REQUEST_KIND_LABELS[request.kind]}
          </CardTitle>
          <RequestStatusBadge status={request.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          Requested by Claude for {request.onBehalfOf} · {formatDateTime(request.createdAt)} ·{' '}
          {request.id}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-sm font-medium">
          {renderAlertLink(alert.id, `${alert.id} ${alert.title}`)}
        </div>

        <div className="flex flex-col gap-1">
          <Label>Claude's rationale</Label>
          <p className="text-sm" data-testid="rationale">
            {request.rationale}
          </p>
        </div>

        {request.kind === 'add_comment' ? (
          <div className="flex flex-col gap-1">
            <Label>Comment to be posted</Label>
            <blockquote
              className="rounded-r-md border-l-2 border-violet-500/60 bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap"
              data-testid="payload-preview"
            >
              {request.payload.body}
            </blockquote>
          </div>
        ) : (
          <Label>Moves the alert to In Progress.</Label>
        )}

        {request.status === 'failed' && request.failure && (
          <p
            className="rounded-md bg-orange-500/10 px-3 py-2 text-sm text-orange-800 dark:text-orange-300"
            data-testid="failure"
          >
            Could not be applied: {request.failure.message}
          </p>
        )}
        {request.status === 'rejected' && request.rejectReason && (
          <p className="text-sm text-muted-foreground" data-testid="reject-reason">
            Reason: {request.rejectReason}
          </p>
        )}
      </CardContent>

      {pending && (onApprove || onReject) && (
        <CardFooter className="flex flex-wrap items-center gap-2">
          {onApprove && (
            <Button disabled={busy} onClick={onApprove}>
              Approve
            </Button>
          )}
          {onReject && !rejecting && (
            <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          )}
          {onReject && rejecting && (
            <>
              <Input
                aria-label="Rejection reason"
                placeholder="Reason (optional)"
                className="w-64"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  onReject(reason.trim() || undefined);
                  setRejecting(false);
                  setReason('');
                }}
              >
                Confirm reject
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
