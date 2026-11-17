import { Skeleton } from '@app/ui';
import { Bot } from 'lucide-react';
import { useActionRequest } from '../hooks/useActionRequests.ts';
import { RequestCard } from './RequestCard.tsx';

function Item({ id }: { id: string }) {
  const { data } = useActionRequest(id);
  return data ? <RequestCard detail={data} /> : <Skeleton className="h-32 w-full" />;
}

/** Claude's pending requests for this alert, with Approve / Reject inline. */
export function PendingRequestsBanner({ requestIds }: { requestIds: string[] }) {
  if (requestIds.length === 0) return null;
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"
      data-testid="pending-requests-banner"
      aria-label="Pending requests from Claude"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Bot className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
        Claude is waiting for your approval ({requestIds.length})
      </p>
      {requestIds.map((id) => (
        <Item key={id} id={id} />
      ))}
    </section>
  );
}
