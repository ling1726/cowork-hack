import {
  AlertDetailSearchSchema,
  AlertListSearchSchema,
  QueueSearchSchema,
  toQueryString,
  type AlertDetailSearch,
  type AlertListSearch,
  type QueueSearch,
} from './search-params.ts';

const trimBase = (base: string) => base.replace(/\/+$/, '');
const withQuery = (path: string, qs: string) => (qs ? `${path}?${qs}` : path);

export function alertListUrl(base: string, search: AlertListSearch = {}): string {
  return withQuery(`${trimBase(base)}/alerts`, toQueryString(search, AlertListSearchSchema));
}

export function alertUrl(
  base: string,
  id: string,
  search: Partial<AlertDetailSearch> = {},
): string {
  return withQuery(
    `${trimBase(base)}/alerts/${encodeURIComponent(id)}`,
    toQueryString(search, AlertDetailSearchSchema),
  );
}

export function queueUrl(base: string, search: Partial<QueueSearch> = {}): string {
  return withQuery(`${trimBase(base)}/queue`, toQueryString(search, QueueSearchSchema));
}

export function actionRequestUrl(base: string, id: string): string {
  return `${trimBase(base)}/queue/${encodeURIComponent(id)}`;
}
