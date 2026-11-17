import { createApiClient } from '@app/api-client';
import type { User } from '@app/domain';
import { queryClient } from './queryClient.ts';
import { useUiStore } from './store/ui-store.ts';

/** Keys are prefix-nested so `['alerts']` invalidates every alert query. */
export const queryKeys = {
  alerts: (search: object = {}) => ['alerts', 'list', search] as const,
  alert: (id: string) => ['alerts', 'detail', id] as const,
  timeline: (id: string) => ['alerts', 'timeline', id] as const,
  related: (id: string) => ['alerts', 'related', id] as const,
  users: ['users'] as const,
  meta: ['meta'] as const,
  actionRequests: (search: object = {}) => ['action-requests', 'list', search] as const,
  actionRequest: (id: string) => ['action-requests', 'detail', id] as const,
  settings: (userId: string) => ['settings', userId] as const,
};

/**
 * The current user's id, but only once the user list has loaded and contains it. A stale persisted
 * id (after a reset or a seed change) is never sent to the API.
 */
export function verifiedUserId(): string | undefined {
  const id = useUiStore.getState().currentUserId;
  const users = queryClient.getQueryData<User[]>(queryKeys.users);
  return users?.some((u) => u.id === id) ? id : undefined;
}

/** Same-origin client: Vite proxies `/api` to the backend. Sends the demo user's `X-User-Id`. */
export const api = createApiClient({ baseUrl: '', getUserId: verifiedUserId });
