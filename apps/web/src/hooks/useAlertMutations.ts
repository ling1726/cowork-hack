import { unwrap } from '@app/api-client';
import type { CloseBody, EscalateBody, LinkBody } from '@app/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';

/** Human write actions for one alert. Every success refreshes the alert, its timeline and all lists. */
export function useAlertMutations(alertId: string) {
  const queryClient = useQueryClient();
  const path = { params: { path: { id: alertId } } };
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['alerts'] });

  return {
    acknowledge: useMutation({
      mutationFn: async () => unwrap(await api.POST('/api/alerts/{id}/acknowledge', path)),
      onSuccess,
    }),
    close: useMutation({
      mutationFn: async (body: CloseBody) =>
        unwrap(await api.POST('/api/alerts/{id}/close', { ...path, body })),
      onSuccess,
    }),
    reopen: useMutation({
      mutationFn: async (reason: string) =>
        unwrap(await api.POST('/api/alerts/{id}/reopen', { ...path, body: { reason } })),
      onSuccess,
    }),
    escalate: useMutation({
      mutationFn: async (body: EscalateBody) =>
        unwrap(await api.POST('/api/alerts/{id}/escalations', { ...path, body })),
      onSuccess,
    }),
    setAssignees: useMutation({
      mutationFn: async (body: { primaryId: string; backupId: string }) =>
        unwrap(await api.PUT('/api/alerts/{id}/assignees', { ...path, body })),
      onSuccess,
    }),
    addLink: useMutation({
      mutationFn: async (body: LinkBody) =>
        unwrap(await api.POST('/api/alerts/{id}/links', { ...path, body })),
      onSuccess,
    }),
    uploadAttachment: useMutation({
      mutationFn: async (file: File) =>
        unwrap(
          await api.POST('/api/alerts/{id}/attachments', {
            ...path,
            // The schema types the binary field as a string; the real body is multipart form data.
            body: { file: '' },
            bodySerializer: () => {
              const form = new FormData();
              form.append('file', file);
              return form;
            },
          }),
        ),
      onSuccess,
    }),
  };
}
