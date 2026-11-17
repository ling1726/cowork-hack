import { AlertDetailSearchSchema, AlertListSearchSchema, fromSearchParams } from '@app/domain';

type Schema = Parameters<typeof fromSearchParams>[1];

/** The one canonical key order: list filters first, then detail keys. */
const KEY_ORDER = [
  ...Object.keys(AlertListSearchSchema.shape),
  ...Object.keys(AlertDetailSearchSchema.shape),
];

/** Values that equal their default are left out so URLs match the deep-link builder. */
const isDefault = (key: string, value: unknown) =>
  (key === 'tab' && value === 'overview') || (key === 'status' && value === 'pending');

/** TanStack `parseSearch`: keep every value as the raw string from the URL. */
export function parseSearch(searchString: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchString));
}

/** TanStack `stringifySearch`: canonical, comma-joined arrays, literal commas. */
export function stringifySearch(search: Record<string, unknown>): string {
  const rank = (k: string) => {
    const i = KEY_ORDER.indexOf(k);
    return i === -1 ? KEY_ORDER.length : i;
  };
  const parts: string[] = [];
  for (const key of Object.keys(search).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
    const value = search[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (isDefault(key, value)) continue;
    const text = Array.isArray(value)
      ? value.map((v) => encodeURIComponent(String(v))).join(',')
      : encodeURIComponent(String(value));
    parts.push(`${encodeURIComponent(key)}=${text}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Builds a route `validateSearch` from a domain schema (invalid values degrade to defaults). */
export function validateWith<S extends Schema>(schema: S) {
  return (raw: Record<string, unknown>): ReturnType<S['parse']> => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined || value === null) continue;
      params.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    return fromSearchParams(params, schema) as ReturnType<S['parse']>;
  };
}
