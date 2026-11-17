import { ActionRequestCard } from '@app/ui';
import { MessageBar, MessageBarBody, Text } from '@fluentui/react-components';
import { useActionRequestOwner } from '../hooks/useRequestOwner.ts';
import { useDecide, type ActionRequestDetail } from '../hooks/useActionRequests.ts';
import { AlertLink } from './AlertLink.tsx';

/** An action request with Approve / Reject wired up, shown only to the user Claude acted for. */
export function RequestCard({ detail }: { detail: ActionRequestDetail }) {
  const { approve, reject } = useDecide(detail.id);
  const { canDecide, ownerName } = useActionRequestOwner(detail.onBehalfOf);
  const error = approve.error ?? reject.error;
  const decidable = detail.status === 'pending' && canDecide;

  return (
    <div>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error.message}</MessageBarBody>
        </MessageBar>
      )}
      <ActionRequestCard
        request={detail}
        alert={detail.alert}
        busy={approve.isPending || reject.isPending}
        {...(decidable
          ? {
              onApprove: () => approve.mutate(),
              onReject: (reason?: string) => reject.mutate(reason),
            }
          : {})}
        renderAlertLink={(id, label) => <AlertLink id={id}>{label}</AlertLink>}
      />
      {detail.status === 'pending' && !canDecide && (
        <Text block size={200}>
          Only {ownerName} can decide this request.
        </Text>
      )}
    </div>
  );
}
