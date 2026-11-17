import { AlertSummarySchema } from '@app/domain';
import { describe, expect, it } from 'vitest';
import { asUser, call, makeApp, T0 } from './helpers.ts';

const { app } = makeApp();
const get = (path: string) => call(app, 'GET', path, { headers: asUser('U-01') });

interface ListBody {
  items: Array<{ id: string; severity: string; createdAt: string; status: string }>;
  total: number;
  page: number;
  pageSize: number;
}
const list = async (qs = ''): Promise<ListBody> => {
  const r = await get(`/api/alerts${qs ? `?${qs}` : ''}`);
  expect(r.status, qs).toBe(200);
  return (await r.json()) as ListBody;
};
const ids = (b: ListBody) => b.items.map((i) => i.id);

describe('GET /api/alerts', () => {
  it('W1 filters: status=open&severity=high&desk=eu-equities → 3; plus q=layering → ALT-1042, ALT-1047', async () => {
    const base = await list('status=open&severity=high&desk=eu-equities');
    expect(base.total).toBe(3);
    expect(ids(base).sort()).toEqual(['ALT-1042', 'ALT-1047', 'ALT-1049']);
    const withQ = await list('status=open&severity=high&desk=eu-equities&q=layering');
    expect(withQ.total).toBe(2);
    expect(ids(withQ).sort()).toEqual(['ALT-1042', 'ALT-1047']);
  });

  it('returns summaries that parse with the domain schema', async () => {
    const body = await list('pageSize=5');
    expect(body.items).toHaveLength(5);
    for (const item of body.items) AlertSummarySchema.parse(item);
    expect(body).toMatchObject({ page: 1, pageSize: 5, total: 55 });
  });

  it('default sort is newest first', async () => {
    const body = await list('pageSize=3');
    expect(ids(body)).toEqual(['ALT-1051', 'ALT-1042', 'ALT-1049']);
  });

  it('comma arrays: status=open,in_progress excludes closed; repeated params also work', async () => {
    const a = await list('status=open,in_progress&pageSize=100');
    expect(a.items.length).toBeGreaterThan(0);
    expect(a.items.every((i) => i.status !== 'closed')).toBe(true);
    const b = await list('status=open&status=in_progress&pageSize=100');
    expect(b.total).toBe(a.total);
  });

  it('traderId=T-0412 → 4 alerts', async () => {
    const body = await list('traderId=T-0412');
    expect(ids(body)).toEqual(['ALT-1042', 'ALT-1013', 'ALT-0958', 'ALT-0911']);
  });

  it('instrument filters by symbol, case-insensitively', async () => {
    expect(ids(await list('instrument=nvlx')).sort()).toEqual(['ALT-0987', 'ALT-1051']);
  });

  it('from/to filter on createdAt by day (inclusive)', async () => {
    const body = await list('from=2026-11-17&to=2026-11-17');
    expect(ids(body).sort()).toEqual(['ALT-1042', 'ALT-1047', 'ALT-1049', 'ALT-1051']);
  });

  it('assigneeId matches primary, backup or escalated users', async () => {
    const body = await list('assigneeId=U-04&pageSize=100');
    expect(ids(body)).toEqual(expect.arrayContaining(['ALT-0987', 'ALT-1051']));
    expect(ids(body)).not.toContain('ALT-1042');
  });

  it('involvedUserId=U-01&updatedFrom=<T0−24h> includes ALT-1013, ALT-1033, ALT-1029', async () => {
    const from = new Date(T0.getTime() - 24 * 3_600_000).toISOString();
    const body = await list(`involvedUserId=U-01&updatedFrom=${encodeURIComponent(from)}`);
    expect(ids(body)).toEqual(expect.arrayContaining(['ALT-1013', 'ALT-1033', 'ALT-1029']));
    // Not involved: U-04 / U-05 only
    expect(ids(body)).not.toContain('ALT-0987');
  });

  it('involvedUserId matches users who acted on the timeline', async () => {
    const body = await list('involvedUserId=U-06&traderId=T-0412');
    expect(ids(body)).toContain('ALT-0958'); // U-06 closed it
  });

  it('updatedTo bounds updatedAt', async () => {
    const to = new Date(T0.getTime() - 24 * 3_600_000).toISOString();
    const body = await list(`updatedTo=${encodeURIComponent(to)}&pageSize=100`);
    expect(body.items.every((i) => new Date(i.createdAt) <= new Date(to))).toBe(true);
    expect(ids(body)).not.toContain('ALT-1042');
  });

  it('sort=-severity puts critical/high first, sort=severity puts low first', async () => {
    const desc = await list('sort=-severity&pageSize=100');
    const rank = { low: 0, medium: 1, high: 2, critical: 3 } as const;
    const ranks = desc.items.map((i) => rank[i.severity as keyof typeof rank]);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    const asc = await list('sort=severity&pageSize=1');
    expect(asc.items[0]?.severity).toBe('low');
  });

  it('q matches comment bodies (search "benign" finds ALT-0987)', async () => {
    expect(ids(await list('q=benign'))).toEqual(['ALT-0987']);
  });

  it('q with prefix and fuzzy terms still finds the alert', async () => {
    expect(ids(await list('q=layerng&traderId=T-0412'))).toContain('ALT-1042');
  });

  it('q orders by relevance when sort is absent, and sort overrides it', async () => {
    const rel = await list('q=wash&pageSize=100');
    expect(rel.total).toBeGreaterThan(1);
    const sorted = await list('q=wash&sort=createdAt&pageSize=100');
    const times = sorted.items.map((i) => i.createdAt);
    expect(times).toEqual([...times].sort());
    expect(ids(rel).sort()).toEqual(ids(sorted).sort());
  });

  it.each(['   ', '"', '(', '*', '🙂', 'x'.repeat(500)])('q=%j never errors (200)', async (q) => {
    const r = await get(`/api/alerts?q=${encodeURIComponent(q)}`);
    expect(r.status).toBe(200);
  });

  it('whitespace-only q is treated as absent', async () => {
    const all = await list();
    const blank = await list('q=%20%20%20');
    expect(blank.total).toBe(all.total);
  });

  it('invalid status value → 400 validation_error', async () => {
    const r = await get('/api/alerts?status=bogus');
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('pageSize>100 → 400; page=0 → 400', async () => {
    expect((await get('/api/alerts?pageSize=101')).status).toBe(400);
    expect((await get('/api/alerts?page=0')).status).toBe(400);
  });

  it('paging returns stable, disjoint slices that add up to the full list', async () => {
    const all = await list('pageSize=100');
    const p1 = await list('pageSize=20&page=1');
    const p2 = await list('pageSize=20&page=2');
    const p3 = await list('pageSize=20&page=3');
    expect(p1.total).toBe(all.total);
    expect([...ids(p1), ...ids(p2), ...ids(p3)]).toEqual(ids(all));
    expect(ids(p3)).toHaveLength(all.total - 40);
    expect(ids(await list('pageSize=20&page=9'))).toEqual([]);
  });
});

describe('GET /api/alerts/:id', () => {
  it('includes allowedActions and pendingActionRequestIds', async () => {
    const r = await get('/api/alerts/ALT-1042');
    expect(r.status).toBe(200);
    const body = (await r.json()) as any;
    expect(body.id).toBe('ALT-1042');
    expect(body.allowedActions).toEqual([
      'acknowledge',
      'escalate',
      'comment',
      'edit_assignees',
      'add_link',
      'add_attachment',
    ]);
    expect(body.pendingActionRequestIds).toEqual([]);
    expect(body.rule.indicators).toHaveLength(3);
  });

  it('closed alert offers reopen', async () => {
    const body = (await (await get('/api/alerts/ALT-0987')).json()) as any;
    expect(body.allowedActions[0]).toBe('reopen');
  });

  it('unknown id → 404 not_found', async () => {
    const r = await get('/api/alerts/ALT-9999');
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ error: { code: 'not_found' } });
  });
});

describe('GET /api/alerts/:id/timeline', () => {
  it('returns events oldest first', async () => {
    const events = (await (await get('/api/alerts/ALT-1013/timeline')).json()) as Array<{
      at: string;
      type: string;
    }>;
    expect(events.map((e) => e.type)).toEqual(['created', 'status_changed', 'comment', 'comment']);
    const times = events.map((e) => e.at);
    expect(times).toEqual(times.toSorted());
  });
  it('unknown id → 404', async () => {
    expect((await get('/api/alerts/ALT-9999/timeline')).status).toBe(404);
  });
});

describe('GET /api/alerts/:id/related', () => {
  const related = async (id: string, qs = '') =>
    (await (await get(`/api/alerts/${id}/related${qs}`)).json()) as Array<{
      alert: { id: string };
      matchedOn: string[];
      resolution?: { outcome: string; note: string };
    }>;

  it('related for ALT-1042 lists ALT-0911, ALT-0958, ALT-1013 with matchedOn including trader', async () => {
    const r = await related('ALT-1042');
    const byTrader = r.filter((x) => x.matchedOn.includes('trader'));
    expect(byTrader.map((x) => x.alert.id)).toEqual(['ALT-1013', 'ALT-0958', 'ALT-0911']);
    expect(byTrader.find((x) => x.alert.id === 'ALT-0911')?.matchedOn).toEqual(['trader', 'rule']);
    expect(byTrader.find((x) => x.alert.id === 'ALT-0958')?.resolution?.outcome).toBe(
      'false_positive',
    );
    expect(byTrader.find((x) => x.alert.id === 'ALT-1013')?.resolution).toBeUndefined();
    // ALT-1047 shares the layering rule but not the trader, so it is a rule-only match.
    expect(
      r.filter((x) => !x.matchedOn.includes('trader')).map((x) => [x.alert.id, x.matchedOn]),
    ).toEqual([['ALT-1047', ['rule']]]);
  });

  it('related for ALT-1051 lists ALT-0987 matchedOn instrument with resolution', async () => {
    const r = await related('ALT-1051');
    expect(r.map((x) => x.alert.id)).toEqual(['ALT-0987']);
    expect(r[0]?.matchedOn).toEqual(['instrument', 'rule']);
    expect(r[0]?.resolution?.note).toBe('Name added to restricted list after trade; timing benign');
  });

  it('never includes the alert itself and respects the days window', async () => {
    expect((await related('ALT-1042')).map((x) => x.alert.id)).not.toContain('ALT-1042');
    expect((await related('ALT-1042', '?days=30')).map((x) => x.alert.id)).toEqual([
      'ALT-1047',
      'ALT-1013',
      'ALT-0958',
    ]);
  });

  it('unknown id → 404; days out of range → 400', async () => {
    expect((await get('/api/alerts/ALT-9999/related')).status).toBe(404);
    expect((await get('/api/alerts/ALT-1042/related?days=0')).status).toBe(400);
  });
});

describe('OpenAPI document', () => {
  it('lists the read routes with typed query parameters', async () => {
    const doc = (await (await call(app, 'GET', '/api/openapi.json')).json()) as any;
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/api/alerts',
        '/api/alerts/{id}',
        '/api/alerts/{id}/timeline',
        '/api/alerts/{id}/related',
      ]),
    );
    const params = doc.paths['/api/alerts'].get.parameters.map((p: any) => p.name);
    expect(params).toEqual(expect.arrayContaining(['status', 'q', 'pageSize', 'involvedUserId']));
  });
});
