import { Skeleton } from '@app/ui';
import { CircleAlert } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useUsers } from '../hooks.ts';
import { DEFAULT_USER_ID, useUiStore } from '../store/ui-store.ts';

/**
 * Holds the page back until the user list is known. A persisted user that no longer exists
 * (after a reset or a seed change) falls back to U-01 before anything else calls the API,
 * so a stale `X-User-Id` is never sent.
 */
export function UserGate({ children }: { children: ReactNode }) {
  const { data: users, isError, error } = useUsers();
  const currentUserId = useUiStore((s) => s.currentUserId);
  const setCurrentUserId = useUiStore((s) => s.setCurrentUserId);
  const known = users?.some((u) => u.id === currentUserId) ?? false;

  useEffect(() => {
    if (users && !known) setCurrentUserId(DEFAULT_USER_ID);
  }, [users, known, setCurrentUserId]);

  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <CircleAlert className="size-4" />
        Cannot reach the API: {error.message}
      </div>
    );
  }
  if (!users || !known) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading…">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
