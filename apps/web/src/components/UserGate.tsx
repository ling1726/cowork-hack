import { MessageBar, MessageBarBody, Spinner } from '@fluentui/react-components';
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
      <MessageBar intent="error">
        <MessageBarBody>Cannot reach the API: {error.message}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!users || !known) return <Spinner label="Loading…" />;
  return <>{children}</>;
}
