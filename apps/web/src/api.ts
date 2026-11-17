import { createApiClient } from '@app/api-client';
import { useUiStore } from './store/ui-store.ts';

/** Same-origin client: Vite proxies `/api` to the backend. Sends the demo user's `X-User-Id`. */
export const api = createApiClient({
  baseUrl: '',
  getUserId: () => useUiStore.getState().currentUserId,
});

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
