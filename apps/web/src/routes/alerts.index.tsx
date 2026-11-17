import { unwrap } from '@app/api-client';
import { AlertListSearchSchema, type AlertListSearch } from '@app/domain';
import { AlertTable, Button, Skeleton } from '@app/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CircleAlert, SearchX } from 'lucide-react';
import { useCallback } from 'react';
import { api, queryKeys } from '../api.ts';
import { AlertLink } from '../components/AlertLink.tsx';
import { ListToolbar } from '../components/list/ListToolbar.tsx';
import { StatCards } from '../components/list/StatCards.tsx';
import { Pagination } from '../components/Pagination.tsx';
import { useUsers } from '../hooks.ts';
import { validateWith } from '../search.ts';

export const Route = createFileRoute('/alerts/')({
  validateSearch: validateWith(AlertListSearchSchema),
  component: AlertsPage,
});

function AlertsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: users = [] } = useUsers();

  const update = useCallback(
    (patch: Partial<AlertListSearch>, opts?: { replace?: boolean }) =>
      navigate({
        search: (prev) => ({ ...prev, ...patch, ...('page' in patch ? {} : { page: undefined }) }),
        replace: opts?.replace ?? false,
      }),
    [navigate],
  );
  const clear = () => navigate({ search: {}, replace: false });

  const { data, isError, error, isPending } = useQuery({
    queryKey: queryKeys.alerts(search),
    queryFn: async () => unwrap(await api.GET('/api/alerts', { params: { query: search } })),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Surveillance alerts across desks. Filters live in the URL, so any view can be shared.
          </p>
        </div>
        {data && (
          <span
            data-testid="result-count"
            className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums"
          >
            {data.total} {data.total === 1 ? 'alert' : 'alerts'}
          </span>
        )}
      </div>

      <StatCards />

      <ListToolbar search={search} onChange={update} onClear={clear} />

      {isError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <CircleAlert className="size-4" />
          Could not load alerts: {error.message}
        </div>
      ) : isPending || !data ? (
        <div className="flex flex-col gap-2" aria-label="Loading alerts…" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            {data.items.length > 0 ? (
              <AlertTable
                items={data.items}
                users={users}
                {...((search.sort ?? (search.q ? undefined : '-createdAt'))
                  ? { sort: search.sort ?? '-createdAt' }
                  : {})}
                onSortChange={(sort) => update({ sort })}
                onRowClick={(id) =>
                  navigate({
                    to: '/alerts/$alertId',
                    params: { alertId: id },
                    search: { tab: 'overview' },
                  })
                }
                renderAlertLink={(id, label) => (
                  <AlertLink id={id}>
                    <span className="hover:underline">{label}</span>
                  </AlertLink>
                )}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <SearchX className="size-8 text-muted-foreground" aria-hidden />
                <p className="font-medium">
                  {data.total > 0 ? 'No alerts on this page' : 'No alerts match these filters'}
                </p>
                {data.total === 0 && (
                  <Button variant="outline" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
          {data.total > 0 && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(page) => update({ page: page > 1 ? page : undefined })}
            />
          )}
        </div>
      )}
    </div>
  );
}
