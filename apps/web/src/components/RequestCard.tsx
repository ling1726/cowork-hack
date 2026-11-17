import { ActionRequestCard } from '@app/ui';
import { CircleAlert } from 'lucide-react';
import { useUsers } from '../hooks.ts';
import { useActionRequestOwner } from '../hooks/useRequestOwner.ts';
import { useDecide, type ActionRequestDetail } from '../hooks/useActionRequests.ts';
import { AlertLink } from './AlertLink.tsx';

/** An action request with Approve / Reject wired up, shown only to the user Claude acted for. */
export function RequestCard({ detail }: { detail: ActionRequestDetail }) {
  const { approve, reject } = useDecide(detail.id);
  const { canDecide, ownerName } = useActionRequestOwner(detail.onBehalfOf);
  const { data: users = [] } = useUsers();
  const decidedByName = detail.decidedBy
    ? (users.find((u) => u.id === detail.decidedBy)?.name ?? detail.decidedBy)
    : undefined;
  const error = approve.error ?? reject.error;
  const decidable = detail.status === 'pending' && canDecide;
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4" />
          {error.message}
        </p>
      )}
      <ActionRequestCard
        request={detail}
        alert={detail.alert}
        busy={approve.isPending || reject.isPending}
        {...(decidedByName ? { decidedByName } : {})}
        {...(decidable
          ? {
              onApprove: () => approve.mutate(),
              onReject: (reason?: string) => reject.mutate(reason),
            }
          : {})}
        renderAlertLink={(id, label) => (
          <AlertLink id={id}>
            <span className="hover:underline">{label}</span>
          </AlertLink>
        )}
      />
      {detail.status === 'pending' && !canDecide && (
        <p className="text-sm text-muted-foreground">Only {ownerName} can decide this request.</p>
      )}
    </div>
  );
}
