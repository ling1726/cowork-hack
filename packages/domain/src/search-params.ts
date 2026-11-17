import { z } from 'zod';
import {
  ActionRequestStatus,
  AlertSort,
  AlertStatus,
  AlertTab,
  Category,
  Desk,
  Severity,
} from './enums.ts';

// ---- field helpers -------------------------------------------------------

function splitCsv(v: unknown): unknown {
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return v;
}

/** Comma-separated enum array that drops invalid members (deep links degrade, never throw). */
function lenientArray<T extends z.ZodEnum<any>>(e: T) {
  return z
    .preprocess(
      splitCsv,
      z.array(z.string()).transform((arr): z.output<T>[] | undefined => {
        const valid = arr.filter((x) => e.safeParse(x).success) as z.output<T>[];
        return valid.length > 0 ? valid : undefined;
      }),
    )
    .catch(undefined)
    .optional();
}

/** Comma-separated enum array that rejects invalid members (API validation → 400). */
export function csvEnumArray<T extends z.ZodEnum<any>>(e: T) {
  return z
    .preprocess((v) => {
      const a = splitCsv(v);
      return Array.isArray(a) && a.length === 0 ? undefined : a;
    }, z.array(e).optional())
    .optional();
}

function lenient<T extends z.ZodType>(s: T) {
  return s.catch(undefined as z.output<T>).optional();
}

const trimmedText = z
  .string()
  .transform((s) => s.trim())
  .transform((s) => (s === '' ? undefined : s));
const nonEmpty = z.string().min(1);
const isoDate = z.iso.date();
const pageNumber = z.coerce.number().int().min(1);

// ---- schemas -------------------------------------------------------------

/** Web URL search params for /alerts. Invalid values are dropped. */
export const AlertListSearchSchema = z.object({
  status: lenientArray(AlertStatus),
  severity: lenientArray(Severity),
  category: lenientArray(Category),
  desk: lenientArray(Desk),
  assigneeId: lenient(nonEmpty),
  traderId: lenient(nonEmpty),
  instrument: lenient(nonEmpty),
  from: lenient(isoDate),
  to: lenient(isoDate),
  q: lenient(trimmedText),
  sort: lenient(AlertSort),
  page: lenient(pageNumber),
});
export type AlertListSearch = z.output<typeof AlertListSearchSchema>;

/** API query for GET /alerts. Invalid values are rejected. */
export const AlertListQuerySchema = z.object({
  status: csvEnumArray(AlertStatus),
  severity: csvEnumArray(Severity),
  category: csvEnumArray(Category),
  desk: csvEnumArray(Desk),
  assigneeId: nonEmpty.optional(),
  traderId: nonEmpty.optional(),
  instrument: nonEmpty.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  updatedFrom: z.iso.datetime().optional(),
  updatedTo: z.iso.datetime().optional(),
  involvedUserId: nonEmpty.optional(),
  q: trimmedText.optional(),
  sort: AlertSort.optional(),
  page: pageNumber.optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AlertListQuery = z.output<typeof AlertListQuerySchema>;

export const AlertDetailSearchSchema = z.object({
  tab: AlertTab.catch('overview'),
  dataTab: lenient(nonEmpty),
});
export type AlertDetailSearch = z.output<typeof AlertDetailSearchSchema>;

export const QueueSearchSchema = z.object({
  status: ActionRequestStatus.catch('pending'),
});
export type QueueSearch = z.output<typeof QueueSearchSchema>;

// ---- codec ---------------------------------------------------------------

/** Parse URLSearchParams with a schema. Array fields are comma-separated in the URL. */
export function fromSearchParams<S extends z.ZodObject<any>>(
  params: URLSearchParams,
  schema: S,
): z.output<S> {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) {
    if (!(key in raw)) raw[key] = value;
  }
  return schema.parse(raw);
}

type Entry = [key: string, parts: string[]];

function canonicalEntries(search: object, schema: z.ZodObject<any>): Entry[] {
  const defaults = (schema.safeParse({}).data ?? {}) as Record<string, unknown>;
  const source = search as Record<string, unknown>;
  const entries: Entry[] = [];
  for (const key of Object.keys(schema.shape)) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (JSON.stringify(value) === JSON.stringify(defaults[key])) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      entries.push([key, value.map(String)]);
    } else {
      entries.push([key, [String(value)]]);
    }
  }
  return entries;
}

/** Canonical URLSearchParams: schema key order, no undefined, empty arrays or defaults. */
export function toSearchParams(search: object, schema: z.ZodObject<any>): URLSearchParams {
  return new URLSearchParams(
    canonicalEntries(search, schema).map(([k, parts]): [string, string] => [k, parts.join(',')]),
  );
}

/**
 * Canonical query string (without the leading "?"). Commas in array values stay literal so URLs
 * read as `status=open,in_progress`.
 */
export function toQueryString(search: object, schema: z.ZodObject<any>): string {
  return canonicalEntries(search, schema)
    .map(([k, parts]) => `${encodeURIComponent(k)}=${parts.map(encodeURIComponent).join(',')}`)
    .join('&');
}
