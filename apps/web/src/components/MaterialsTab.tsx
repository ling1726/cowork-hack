import type { Alert, User } from '@app/domain';
import { Link, Text, makeStyles, tokens } from '@fluentui/react-components';
import { nameOf, formatDateTime } from '@app/ui';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  list: {
    listStyleType: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  meta: { color: tokens.colorNeutralForeground2 },
});

const formatSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function MaterialsTab({ alert, users }: { alert: Alert; users: User[] }) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <section aria-label="Links">
        <Text as="h2" weight="semibold" size={400}>
          Links
        </Text>
        {alert.links.length === 0 ? (
          <Text block>No links yet.</Text>
        ) : (
          <ul className={styles.list}>
            {alert.links.map((l) => (
              <li key={l.id} data-testid="link-item">
                <Link href={l.url} target="_blank" rel="noreferrer">
                  {l.title}
                </Link>
                <Text block size={200} className={styles.meta}>
                  Added by {nameOf(users, l.addedBy)} · {formatDateTime(l.addedAt)}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Attachments">
        <Text as="h2" weight="semibold" size={400}>
          Attachments
        </Text>
        {alert.attachments.length === 0 ? (
          <Text block>No attachments yet.</Text>
        ) : (
          <ul className={styles.list}>
            {alert.attachments.map((a) => (
              <li key={a.id} data-testid="attachment-item">
                <Link href={`/api/attachments/${a.id}/content`} download={a.filename}>
                  {a.filename}
                </Link>
                <Text block size={200} className={styles.meta}>
                  {formatSize(a.sizeBytes)} · uploaded by {nameOf(users, a.uploadedBy)} ·{' '}
                  {formatDateTime(a.uploadedAt)}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
