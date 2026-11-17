import { describe, expect, it } from 'vitest';
import {
  AlertDetailSearchSchema,
  AlertListQuerySchema,
  AlertListSearchSchema,
  QueueSearchSchema,
  actionRequestUrl,
  alertListUrl,
  alertUrl,
  fromSearchParams,
  queueUrl,
  toSearchParams,
  type AlertListSearch,
} from '../src/index.ts';

const B = 'http://localhost:5173';

describe('deep links', () => {
  it('builds the W1 link exactly', () => {
    expect(
      alertListUrl(B, {
        status: ['open'],
        severity: ['high'],
        desk: ['eu-equities'],
        q: 'layering',
      }),
    ).toBe(`${B}/alerts?status=open&severity=high&desk=eu-equities&q=layering`);
  });
  it('round-trips: parse(build(x)) deep-equals x', () => {
    const x: AlertListSearch = {
      status: ['open', 'in_progress'],
      category: ['wash_trade'],
      traderId: 'T-0412',
      sort: '-severity',
      page: 2,
    };
    const url = new URL(alertListUrl(B, x));
    expect(url.search).toContain('status=open,in_progress');
    expect(fromSearchParams(url.searchParams, AlertListSearchSchema)).toEqual(x);
  });
  it('drops invalid list params instead of throwing', () => {
    expect(
      fromSearchParams(
        new URLSearchParams('status=bogus,open&page=0&q=%20%20'),
        AlertListSearchSchema,
      ),
    ).toEqual({ status: ['open'] });
  });
  it('emits keys in schema order regardless of input order', () => {
    expect(alertListUrl(B, { q: 'x', page: 3, status: ['open'] })).toBe(
      `${B}/alerts?status=open&q=x&page=3`,
    );
  });
  it('alertUrl omits the default tab', () => {
    expect(alertUrl(B, 'ALT-1042')).toBe(`${B}/alerts/ALT-1042`);
    expect(alertUrl(B, 'ALT-1042', { tab: 'overview' })).toBe(`${B}/alerts/ALT-1042`);
    expect(alertUrl(B, 'ALT-1042', { tab: 'data', dataTab: 'orders' })).toBe(
      `${B}/alerts/ALT-1042?tab=data&dataTab=orders`,
    );
  });
  it('bad tab falls back to overview', () => {
    expect(fromSearchParams(new URLSearchParams('tab=nope'), AlertDetailSearchSchema)).toEqual({
      tab: 'overview',
    });
  });
  it('queue status defaults to pending and is omitted from the url', () => {
    expect(fromSearchParams(new URLSearchParams(''), QueueSearchSchema)).toEqual({
      status: 'pending',
    });
    expect(queueUrl(B)).toBe(`${B}/queue`);
    expect(queueUrl(B, { status: 'approved' })).toBe(`${B}/queue?status=approved`);
  });
  it('actionRequestUrl', () => {
    expect(actionRequestUrl(B, 'AR-0001')).toBe(`${B}/queue/AR-0001`);
  });
  it('toSearchParams omits undefined and empty arrays', () => {
    const p = toSearchParams({ status: [], q: undefined, page: 2 }, AlertListSearchSchema);
    expect(p.toString()).toBe('page=2');
  });
  it('trims q and treats whitespace-only as absent', () => {
    expect(
      fromSearchParams(new URLSearchParams('q=%20layering%20'), AlertListSearchSchema),
    ).toEqual({
      q: 'layering',
    });
  });
});

describe('AlertListQuerySchema (API)', () => {
  it('accepts comma arrays and applies the default pageSize', () => {
    const r = AlertListQuerySchema.parse({ status: 'open,in_progress', involvedUserId: 'U-01' });
    expect(r).toMatchObject({
      status: ['open', 'in_progress'],
      involvedUserId: 'U-01',
      pageSize: 25,
    });
  });
  it('rejects invalid values instead of dropping them', () => {
    expect(AlertListQuerySchema.safeParse({ status: 'bogus' }).success).toBe(false);
    expect(AlertListQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(AlertListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
  it('treats whitespace-only q as absent', () => {
    expect(AlertListQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });
});
