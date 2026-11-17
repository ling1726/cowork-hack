import { unwrap } from '@app/api-client';
import { AlertListSearchSchema, type AlertListSearch } from '@app/domain';
import { AlertTable } from '@app/ui';
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { api, queryKeys } from '../api.ts';
import { AlertLink } from '../components/AlertLink.tsx';
import { FilterBar } from '../components/FilterBar.tsx';
import { Pagination } from '../components/Pagination.tsx';
import { validateWith } from '../search.ts';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  summary: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    alignItems: 'flex-start',
    padding: tokens.spacingVerticalXL,
  },
});

export const Route = createFileRoute('/alerts/')({
  validateSearch: validateWith(AlertListSearchSchema),
  component: AlertsPage,
});

function AlertsPage() {
  const styles = useStyles();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const update = useCallback(
    (patch: Partial<AlertListSearch>, opts?: { replace?: boolean }) =>
      navigate({
        search: (prev) => ({ ...prev, ...patch, ...('page' in patch ? {} : { page: undefined }) }),
        replace: opts?.replace ?? false,
      }),
    [navigate],
  );

  const { data, isError, error, isPending } = useQuery({
    queryKey: queryKeys.alerts(search),
    queryFn: async () => unwrap(await api.GET('/api/alerts', { params: { query: search } })),
    placeholderData: keepPreviousData,
  });

  if (isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>Could not load alerts: {error.message}</MessageBarBody>
      </MessageBar>
    );
  }

  return (
    <div className={styles.page}>
      <Text as="h1" size={700} weight="semibold">
        Alerts
      </Text>
      <FilterBar
        search={search}
        onChange={update}
        onClear={() => navigate({ search: {}, replace: false })}
      />
      {isPending || !data ? (
        <Spinner label="Loading alerts…" />
      ) : (
        <>
          <div className={styles.summary}>
            <Text data-testid="result-count" weight="semibold">
              {data.total} {data.total === 1 ? 'alert' : 'alerts'}
            </Text>
          </div>
          {data.items.length > 0 ? (
            <AlertTable
              items={data.items}
              {...((search.sort ?? (search.q ? undefined : '-createdAt'))
                ? { sort: search.sort ?? '-createdAt' }
                : {})}
              onSortChange={(sort) => update({ sort })}
              renderAlertLink={(id, label) => <AlertLink id={id}>{label}</AlertLink>}
            />
          ) : data.total > 0 ? (
            <div className={styles.empty}>
              <Text>No alerts on this page</Text>
            </div>
          ) : (
            <div className={styles.empty}>
              <Text>No alerts match these filters</Text>
            </div>
          )}
          {data.total > 0 && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(page) => update({ page: page > 1 ? page : undefined })}
            />
          )}
        </>
      )}
    </div>
  );
}
