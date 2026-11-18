import { ApiRequestError } from '@app/api-client';
import { buttonVariants, Skeleton } from '@app/ui';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { AlertLink } from '../components/AlertLink.tsx';
import { OpenInCoworkButton } from '../components/OpenInCowork.tsx';
import { RequestCard } from '../components/RequestCard.tsx';
import { useActionRequest } from '../hooks/useActionRequests.ts';

export const Route = createFileRoute('/queue/$requestId')({ component: RequestPage });

function RequestPage() {
  const { requestId } = Route.useParams();
  const { data, isPending, isError, error } = useActionRequest(requestId);

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3" aria-busy="true">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError) {
    const missing = error instanceof ApiRequestError && error.status === 404;
    return missing ? (
      <div className="flex flex-col items-start gap-3 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Request not found</h1>
        <p className="text-sm text-muted-foreground">There is no request {requestId}.</p>
        <Link
          to="/queue"
          search={{ status: 'pending' }}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to the queue
        </Link>
      </div>
    ) : (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <CircleAlert className="size-4" />
        Could not load the request: {error.message}
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <RequestCard detail={data} />
      {data.status === 'pending' && (
        <div>
          <OpenInCoworkButton
            coworkCase={{ kind: 'explain_request', requestId: data.id, alertId: data.alertId }}
          />
        </div>
      )}
      {data.status !== 'pending' && (
        <AlertLink id={data.alertId}>
          <span className={buttonVariants({ variant: 'outline' })}>
            View alert
            <ArrowRight />
          </span>
        </AlertLink>
      )}
    </div>
  );
}
