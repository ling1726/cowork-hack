import { USER_ROLE_LABELS, type Assignees, type User } from '@app/domain';
import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { formatDateTime, nameOf } from '../format.ts';
import { Button } from '../primitives/button.tsx';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../primitives/card.tsx';
import { UserAvatar } from './UserAvatar.tsx';

function Who({ users, id }: { users: readonly User[]; id: string }) {
  const user = users.find((u) => u.id === id);
  const name = nameOf(users, id);
  return (
    <div className="flex items-center gap-2.5">
      <UserAvatar name={name} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        {user && (
          <div className="truncate text-xs text-muted-foreground">
            {USER_ROLE_LABELS[user.role]}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

export interface AssigneesPanelProps {
  assignees: Assignees;
  users: User[];
  onEdit?: () => void;
}

export function AssigneesPanel({ assignees, users, onEdit }: AssigneesPanelProps) {
  return (
    <Card size="sm" role="region" data-testid="assignees-panel" aria-label="Assignees">
      <CardHeader>
        <CardTitle>Assignees</CardTitle>
        {onEdit && (
          <CardAction>
            <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit assignees">
              <Pencil />
              Edit
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Group label="Primary">
          <Who users={users} id={assignees.primaryId} />
        </Group>
        <Group label="Backup">
          <Who users={users} id={assignees.backupId} />
        </Group>
        {assignees.escalatedTo.length > 0 && (
          <Group label="Escalated to">
            {assignees.escalatedTo.map((e) => (
              <div key={e.userId} data-testid="escalation" className="flex flex-col gap-1">
                <Who users={users} id={e.userId} />
                <p className="text-xs text-muted-foreground">
                  {e.reason} · by {nameOf(users, e.byUserId)} · {formatDateTime(e.at)}
                </p>
              </div>
            ))}
          </Group>
        )}
      </CardContent>
    </Card>
  );
}
