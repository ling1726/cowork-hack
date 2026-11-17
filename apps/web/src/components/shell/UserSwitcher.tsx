import { USER_ROLE_LABELS } from '@app/domain';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, UserAvatar } from '@app/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useUsers } from '../../hooks.ts';
import { useUiStore } from '../../store/ui-store.ts';

/** Who the demo acts as. Switching drops every cached query: it belonged to the previous user. */
export function UserSwitcher() {
  const queryClient = useQueryClient();
  const { data: users = [] } = useUsers();
  const currentUserId = useUiStore((s) => s.currentUserId);
  const setCurrentUserId = useUiStore((s) => s.setCurrentUserId);
  const current = users.find((u) => u.id === currentUserId);
  const items = users.map((u) => ({ value: u.id, label: u.name }));

  return (
    <Select
      items={items}
      value={current ? currentUserId : null}
      onValueChange={(id) => {
        if (!id || id === currentUserId) return;
        setCurrentUserId(id);
        void queryClient.resetQueries();
      }}
    >
      <SelectTrigger
        data-testid="current-user"
        aria-label="Current user"
        className="h-auto w-full gap-2 border-none bg-transparent px-2 py-1.5 shadow-none hover:bg-sidebar-accent dark:bg-transparent dark:hover:bg-sidebar-accent group-data-[collapsible=icon]:p-0"
      >
        <UserAvatar name={current?.name ?? '?'} size="default" />
        <span className="flex min-w-0 flex-1 flex-col text-left group-data-[collapsible=icon]:hidden">
          <SelectValue className="truncate font-medium" />
          {current && (
            <span className="truncate text-xs text-sidebar-foreground/60">
              {USER_ROLE_LABELS[current.role]}
            </span>
          )}
        </span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} side="top" align="start" className="min-w-56">
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            <UserAvatar name={u.name} />
            {u.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
