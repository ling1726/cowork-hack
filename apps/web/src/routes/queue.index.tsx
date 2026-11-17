import { ACTION_REQUEST_STATUS_LABELS, ActionRequestStatus, QueueSearchSchema } from '@app/domain';
import { Spinner, Tab, TabList, Text, makeStyles, tokens } from '@fluentui/react-components';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RequestCard } from '../components/RequestCard.tsx';
import { useRequestList } from '../hooks/useActionRequests.ts';
import { validateWith } from '../search.ts';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    maxWidth: '860px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
});

export const Route = createFileRoute('/queue/')({
  validateSearch: validateWith(QueueSearchSchema),
  component: QueuePage,
});

function QueuePage() {
  const styles = useStyles();
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { list, details } = useRequestList(status);

  return (
    <div className={styles.page}>
      <Text as="h1" size={700} weight="semibold">
        Queue
      </Text>
      <Text>What Claude wants to do on your behalf. Nothing changes until you approve it.</Text>
      <TabList
        selectedValue={status}
        onTabSelect={(_e, d) =>
          navigate({ search: { status: ActionRequestStatus.parse(d.value) } })
        }
        aria-label="Request status"
      >
        {ActionRequestStatus.options.map((s) => (
          <Tab key={s} value={s}>
            {ACTION_REQUEST_STATUS_LABELS[s]}
          </Tab>
        ))}
      </TabList>
      {list.isPending ? (
        <Spinner label="Loading requests…" />
      ) : details.length === 0 && (list.data?.length ?? 0) === 0 ? (
        <Text>No requests here.</Text>
      ) : (
        <div className={styles.list}>
          {details.map((d) => (
            <RequestCard key={d.id} detail={d} />
          ))}
        </div>
      )}
    </div>
  );
}
