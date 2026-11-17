import { unwrap } from '@app/api-client';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from './api.ts';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => unwrap(await api.GET('/api/users')),
    staleTime: 60_000,
  });
}

export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: async () => unwrap(await api.GET('/api/meta')),
    staleTime: 60_000,
  });
}
