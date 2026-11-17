import { unwrap } from '@app/api-client';
import type { ActionRequestStatus } from '@app/domain';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryKeys } from '../api.ts';
import { POLL_MS, useUsers } from '../hooks.ts';
import { useUiStore } from '../store/ui-store.ts';

async function fetchDetail(id: string) {
  return unwrap(await api.GET('/api/action-requests/{id}', { params: { path: { id } } }));
}
export type ActionRequestDetail = Awaited<ReturnType<typeof fetchDetail>>;

/** Pending requests Claude made for the current user. Polled: this drives the header badge. */
export function usePendingCount() {
  const currentUserId = useUiStore((s) => s.currentUserId);
  const { data: users } = useUsers();
  // The header renders before the user check finishes; don't ask on behalf of an unknown user.
  const onBehalfOf = users?.some((u) => u.id === currentUserId) ? currentUserId : undefined;
  return useQuery({
    queryKey: queryKeys.actionRequests({ status: ['pending'], onBehalfOf }),
    enabled: onBehalfOf !== undefined,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/action-requests', {
          params: { query: { status: ['pending'], onBehalfOf: onBehalfOf as string } },
        }),
      ),
    refetchInterval: POLL_MS,
    select: (requests) => requests.length,
  });
}

/** The current user's requests with one status, each with its alert summary. */
export function useRequestList(status: ActionRequestStatus) {
  const onBehalfOf = useUiStore((s) => s.currentUserId);
  const list = useQuery({
    queryKey: queryKeys.actionRequests({ status: [status], onBehalfOf }),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/action-requests', {
          params: { query: { status: [status], onBehalfOf } },
        }),
      ),
    refetchInterval: POLL_MS,
  });
  const details = useQueries({
    queries: (list.data ?? []).map((r) => ({
      queryKey: queryKeys.actionRequest(r.id),
      queryFn: () => fetchDetail(r.id),
    })),
    combine: (results) => results.flatMap((r) => (r.data ? [r.data] : [])),
  });
  return { list, details };
}

export function useActionRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.actionRequest(id),
    queryFn: () => fetchDetail(id),
    refetchInterval: POLL_MS,
  });
}

/** Approve or reject one request, then refresh the queue, the badge and every alert view. */
export function useDecide(id: string) {
  const queryClient = useQueryClient();
  const path = { params: { path: { id } } };
  const onSuccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['action-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    ]);
  };
  return {
    approve: useMutation({
      mutationFn: async () => unwrap(await api.POST('/api/action-requests/{id}/approve', path)),
      onSuccess,
    }),
    reject: useMutation({
      mutationFn: async (reason?: string) =>
        unwrap(
          await api.POST('/api/action-requests/{id}/reject', {
            ...path,
            body: reason ? { reason } : {},
          }),
        ),
      onSuccess,
    }),
  };
}

export function useApprovalSetting(userId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.settings(userId),
    queryFn: async () =>
      unwrap(await api.GET('/api/users/{id}/settings', { params: { path: { id: userId } } })),
  });
  const update = useMutation({
    mutationFn: async (requireApprovalForAgentActions: boolean) =>
      unwrap(
        await api.PUT('/api/users/{id}/settings', {
          params: { path: { id: userId } },
          body: { requireApprovalForAgentActions },
        }),
      ),
    onSuccess: (settings) => queryClient.setQueryData(queryKeys.settings(userId), settings),
  });
  return { query, update };
}
