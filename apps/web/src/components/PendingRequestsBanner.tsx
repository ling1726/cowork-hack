import { Spinner, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useActionRequest } from '../hooks/useActionRequests.ts';
import { RequestCard } from './RequestCard.tsx';

const useStyles = makeStyles({
  banner: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
  },
});

function Item({ id }: { id: string }) {
  const { data } = useActionRequest(id);
  return data ? <RequestCard detail={data} /> : <Spinner size="tiny" />;
}

/** Claude's pending requests for this alert, with Approve / Reject inline. */
export function PendingRequestsBanner({ requestIds }: { requestIds: string[] }) {
  const styles = useStyles();
  if (requestIds.length === 0) return null;
  return (
    <section
      className={styles.banner}
      data-testid="pending-requests-banner"
      aria-label="Pending requests from Claude"
    >
      <Text weight="semibold">Claude is waiting for your approval ({requestIds.length})</Text>
      {requestIds.map((id) => (
        <Item key={id} id={id} />
      ))}
    </section>
  );
}
