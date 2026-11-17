import { USER_ROLE_LABELS, type Assignees, type User } from '@app/domain';
import { Button, Persona, Text, makeStyles, tokens } from '@fluentui/react-components';
import { formatDateTime, nameOf } from '../format.ts';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  row: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS },
});

function Who({ users, id, role }: { users: readonly User[]; id: string; role?: string }) {
  const user = users.find((u) => u.id === id);
  return (
    <Persona
      size="small"
      name={nameOf(users, id)}
      secondaryText={role ?? (user ? USER_ROLE_LABELS[user.role] : undefined)}
    />
  );
}

export interface AssigneesPanelProps {
  assignees: Assignees;
  users: User[];
  onEdit?: () => void;
}

export function AssigneesPanel({ assignees, users, onEdit }: AssigneesPanelProps) {
  const styles = useStyles();
  return (
    <section className={styles.root} data-testid="assignees-panel" aria-label="Assignees">
      <div className={styles.head}>
        <Text weight="semibold">Assignees</Text>
        {onEdit && (
          <Button size="small" appearance="subtle" onClick={onEdit} aria-label="Edit assignees">
            Edit
          </Button>
        )}
      </div>
      <div className={styles.row}>
        <Text size={200}>Primary</Text>
        <Who users={users} id={assignees.primaryId} />
      </div>
      <div className={styles.row}>
        <Text size={200}>Backup</Text>
        <Who users={users} id={assignees.backupId} />
      </div>
      {assignees.escalatedTo.length > 0 && (
        <div className={styles.row}>
          <Text size={200}>Escalated to</Text>
          {assignees.escalatedTo.map((e) => (
            <div key={e.userId} data-testid="escalation">
              <Who users={users} id={e.userId} />
              <Text size={200} block>
                {e.reason} · by {nameOf(users, e.byUserId)} · {formatDateTime(e.at)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
