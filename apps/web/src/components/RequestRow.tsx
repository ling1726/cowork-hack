import { ACTION_REQUEST_KIND_LABELS, DECISION_SURFACE_LABELS } from '@app/domain';
import {
  Button,
  buttonVariants,
  formatDateTime,
  formatShortDateTime,
  RequestStatusBadge,
  TableCell,
  TableRow,
} from '@app/ui';
import { Link } from '@tanstack/react-router';
import { useActionRequestOwner } from '../hooks/useRequestOwner.ts';
import { useDecide, type ActionRequestDetail } from '../hooks/useActionRequests.ts';
import { AlertLink } from './AlertLink.tsx';

/** One request in the queue table. Approve works in place; rejecting (with a reason) opens it. */
export function RequestRow({ detail }: { detail: ActionRequestDetail }) {
  const { approve } = useDecide(detail.id);
  const { canDecide } = useActionRequestOwner(detail.onBehalfOf);
  const decidable = detail.status === 'pending' && canDecide;
  return (
    <TableRow data-testid="action-request-card" data-request-id={detail.id}>
      <TableCell className="align-top">
        <Link
          to="/queue/$requestId"
          params={{ requestId: detail.id }}
          className="font-mono text-xs font-medium hover:underline"
        >
          {detail.id}
        </Link>
      </TableCell>
      <TableCell className="max-w-56 align-top">
        <AlertLink id={detail.alert.id}>
          <span className="font-mono text-xs hover:underline">{detail.alert.id}</span>
        </AlertLink>
        <div className="truncate text-xs text-muted-foreground" title={detail.alert.title}>
          {detail.alert.title}
        </div>
      </TableCell>
      <TableCell className="max-w-72 align-top">
        <div className="font-medium">{ACTION_REQUEST_KIND_LABELS[detail.kind]}</div>
        {detail.kind === 'add_comment' && (
          <div
            className="truncate text-xs text-muted-foreground"
            title={detail.payload.body}
            data-testid="payload-preview"
          >
            {detail.payload.body}
          </div>
        )}
      </TableCell>
      <TableCell className="max-w-72 align-top">
        <div
          className="line-clamp-2 text-sm whitespace-normal text-muted-foreground"
          title={detail.rationale}
          data-testid="rationale"
        >
          {detail.rationale}
        </div>
      </TableCell>
      <TableCell
        className="align-top whitespace-nowrap text-muted-foreground"
        title={formatDateTime(detail.createdAt)}
      >
        {formatShortDateTime(detail.createdAt)}
      </TableCell>
      <TableCell className="align-top">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <RequestStatusBadge status={detail.status} />
          {detail.decidedIn === 'cowork' && (
            <span className="text-xs text-muted-foreground" data-testid="decided-in">
              {DECISION_SURFACE_LABELS.cowork}
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex justify-end gap-1.5">
          {decidable && (
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}>
              Approve
            </Button>
          )}
          <Link
            to="/queue/$requestId"
            params={{ requestId: detail.id }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {decidable ? 'Review' : 'Open'}
          </Link>
        </div>
        {approve.isError && (
          <p role="alert" className="mt-1 text-right text-xs text-destructive">
            {approve.error.message}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
