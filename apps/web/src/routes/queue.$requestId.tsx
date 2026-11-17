import { ApiRequestError } from '@app/api-client';
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Link, createFileRoute } from '@tanstack/react-router';
import { AlertLink } from '../components/AlertLink.tsx';
import { RequestCard } from '../components/RequestCard.tsx';
import { useActionRequest } from '../hooks/useActionRequests.ts';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    maxWidth: '860px',
    alignItems: 'flex-start',
  },
});

export const Route = createFileRoute('/queue/$requestId')({ component: RequestPage });

function RequestPage() {
  const styles = useStyles();
  const { requestId } = Route.useParams();
  const { data, isPending, isError, error } = useActionRequest(requestId);

  if (isPending) return <Spinner label="Loading request…" />;
  if (isError) {
    const missing = error instanceof ApiRequestError && error.status === 404;
    return missing ? (
      <div className={styles.page}>
        <Text as="h1" size={700} weight="semibold">
          Request not found
        </Text>
        <Text>There is no request {requestId}.</Text>
        <Link to="/queue" search={{ status: 'pending' }}>
          Back to the queue
        </Link>
      </div>
    ) : (
      <MessageBar intent="error">
        <MessageBarBody>Could not load the request: {error.message}</MessageBarBody>
      </MessageBar>
    );
  }

  return (
    <div className={styles.page}>
      <RequestCard detail={data} />
      {data.status !== 'pending' && <AlertLink id={data.alertId}>View alert</AlertLink>}
    </div>
  );
}
