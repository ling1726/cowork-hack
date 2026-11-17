import { createApiClient } from '@app/api-client';
import { actionRequestUrl, alertListUrl, alertUrl } from '@app/domain';
import { serve } from '@hono/node-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AGENT_TOKEN, asUser, makeApp } from '../../server/test/helpers.ts';
import { startHttp } from '../src/server.ts';

const APP = 'http://localhost:5173';

let backendUrl: string;
let stopBackend: () => void;
let stopMcp: () => Promise<void>;
let client: Client;

const text = (r: unknown) =>
  ((r as { content: Array<{ type: string; text: string }> }).content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    structuredContent?: any;
    content: Array<{ type: string; text: string }>;
  };
const backend = (path: string, init: RequestInit = {}) => fetch(`${backendUrl}${path}`, init);

beforeAll(async () => {
  const { app } = makeApp();
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  backendUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  stopBackend = () => server.close();

  const api = createApiClient({
    baseUrl: backendUrl,
    getUserId: () => 'U-01',
    agentToken: AGENT_TOKEN,
  });
  const mcp = await startHttp({ port: 0, deps: { api, appBaseUrl: APP, actingUserId: 'U-01' } });
  stopMcp = mcp.close;

  client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${mcp.url}`)));
});

afterAll(async () => {
  await client.close();
  await stopMcp();
  stopBackend();
});

beforeEach(async () => {
  expect((await backend('/api/admin/reset', { method: 'POST' })).ok).toBe(true);
});

describe('tool catalogue', () => {
  it('lists exactly the 8 tools with readOnlyHint true on the 6 reads and false on the 2 writes', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'acknowledge_alert',
      'add_comment',
      'find_related_alerts',
      'get_action_request',
      'get_alert',
      'get_alert_timeline',
      'list_users',
      'search_alerts',
    ]);
    const reads = tools.filter((t) => t.annotations?.readOnlyHint === true);
    const writes = tools.filter((t) => t.annotations?.readOnlyHint === false);
    expect(reads).toHaveLength(6);
    expect(writes.map((t) => t.name).sort()).toEqual(['acknowledge_alert', 'add_comment']);
    for (const w of writes) expect(w.annotations?.destructiveHint).toBe(false);
    for (const t of tools) {
      expect(t.annotations?.title, t.name).toBeTruthy();
      expect(t.description, t.name).toBeTruthy();
    }
  });

  it('describes array filters as arrays of enum values', async () => {
    const { tools } = await client.listTools();
    const search = tools.find((t) => t.name === 'search_alerts');
    if (!search) throw new Error('search_alerts missing');
    const props = (search.inputSchema as any).properties;
    expect(props.status.type).toBe('array');
    expect(props.status.items.enum).toEqual(['open', 'in_progress', 'closed']);
    expect(props.desk.items.enum).toContain('eu-equities');
    expect(props.limit.maximum).toBe(25);
    expect(props.page).toBeUndefined();
  });
});

describe('read tools', () => {
  it('search_alerts W1 → 2 items and listUrl === alertListUrl(APP, {…})', async () => {
    const r = await call('search_alerts', {
      status: ['open'],
      severity: ['high'],
      desk: ['eu-equities'],
      q: 'layering',
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.total).toBe(2);
    expect(r.structuredContent.items.map((i: any) => i.id).sort()).toEqual([
      'ALT-1042',
      'ALT-1047',
    ]);
    expect(r.structuredContent.listUrl).toBe(
      alertListUrl(APP, {
        status: ['open'],
        severity: ['high'],
        desk: ['eu-equities'],
        q: 'layering',
      }),
    );
    expect(r.structuredContent.items[0].url).toMatch(/^http:\/\/localhost:5173\/alerts\/ALT-10/);
    expect(text(r)).toContain('ALT-1042');
    expect(text(r)).toContain(r.structuredContent.listUrl);
  });

  it('search_alerts returns the top 10 by default, honours limit, and reports the full total', async () => {
    const all = await call('search_alerts', {});
    expect(all.structuredContent.items).toHaveLength(10);
    expect(all.structuredContent.total).toBe(55);
    const three = await call('search_alerts', { limit: 3 });
    expect(three.structuredContent.items).toHaveLength(3);
    expect((await call('search_alerts', { limit: 26 })).isError).toBe(true);
  });

  it('search_alerts omits listUrl when the filters cannot be shown in the app', async () => {
    const r = await call('search_alerts', {
      involvedUserId: 'U-01',
      updatedFrom: '2026-11-16T09:00:00.000Z',
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.items.map((i: any) => i.id)).toEqual(
      expect.arrayContaining(['ALT-1013', 'ALT-1033', 'ALT-1029']),
    );
    expect(r.structuredContent.listUrl).toBeUndefined();
  });

  it('get_alert ALT-1042 includes rule.indicators, data tabs and tabUrls', async () => {
    const r = await call('get_alert', { alertId: 'ALT-1042' });
    const { alert, url, tabUrls } = r.structuredContent;
    expect(alert.rule.indicators.map((i: any) => i.id)).toEqual([
      'otr',
      'fast_cancel',
      'book_imbalance',
    ]);
    expect(alert.dataTabs.map((t: any) => t.id)).toEqual(['orders', 'executions']);
    expect(alert.allowedActions).toContain('acknowledge');
    expect(url).toBe(alertUrl(APP, 'ALT-1042'));
    expect(tabUrls.data).toBe(alertUrl(APP, 'ALT-1042', { tab: 'data' }));
    expect(tabUrls.timeline).toBe(alertUrl(APP, 'ALT-1042', { tab: 'timeline' }));
    expect(tabUrls.overview).toBe(url);
    // The text carries what the model needs to test the indicators.
    expect(text(r)).toContain('34:1');
    expect(text(r)).toContain('> 20:1');
    expect(text(r)).toContain('cancelLatencyMs');
  });

  it('get_alert on an unknown alert is an error result, not a crash', async () => {
    const r = await call('get_alert', { alertId: 'ALT-9999' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('not_found');
  });

  it('get_alert_timeline resolves actor names', async () => {
    const r = await call('get_alert_timeline', { alertId: 'ALT-1013' });
    const events = r.structuredContent.events;
    expect(events[0]).toMatchObject({ type: 'created', actorName: 'System' });
    expect(events.at(-1)).toMatchObject({
      type: 'comment',
      actorId: 'U-01',
      actorName: 'Priya Shah',
    });
    expect(r.structuredContent.url).toBe(alertUrl(APP, 'ALT-1013', { tab: 'timeline' }));
    expect(text(r)).toContain('Priya Shah');
  });

  it('find_related_alerts ALT-1042 returns the 3 T-0412 alerts, each with a link', async () => {
    const r = await call('find_related_alerts', { alertId: 'ALT-1042' });
    const byTrader = r.structuredContent.related.filter((x: any) => x.matchedOn.includes('trader'));
    expect(byTrader.map((x: any) => x.alert.id)).toEqual(['ALT-1013', 'ALT-0958', 'ALT-0911']);
    expect(byTrader.find((x: any) => x.alert.id === 'ALT-0958').resolution.outcome).toBe(
      'false_positive',
    );
    for (const x of r.structuredContent.related) expect(x.url).toBe(alertUrl(APP, x.alert.id));
    expect(text(r)).toContain('ALT-0958');
  });

  it('find_related_alerts honours days', async () => {
    const r = await call('find_related_alerts', { alertId: 'ALT-1042', days: 20 });
    expect(r.structuredContent.related.map((x: any) => x.alert.id)).toEqual([
      'ALT-1047',
      'ALT-1013',
    ]);
  });

  it('list_users returns the six users', async () => {
    const r = await call('list_users');
    expect(r.structuredContent.users).toHaveLength(6);
    expect(r.structuredContent.actingUserId).toBe('U-01');
    expect(text(r)).toContain('Daniel Okafor');
  });
});

describe('write tools', () => {
  it('add_comment → pending_approval with approveUrl ending /queue/AR-…; backend shows AR pending, onBehalfOf U-01, via claude', async () => {
    const r = await call('add_comment', {
      alertId: 'ALT-1042',
      body: 'Recommend escalating to the Compliance Lead.',
      rationale: 'Two of three indicators are met.',
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({
      status: 'pending_approval',
      requestId: 'AR-0001',
      approveUrl: actionRequestUrl(APP, 'AR-0001'),
    });
    expect(r.structuredContent.approveUrl).toMatch(/\/queue\/AR-\d{4}$/);
    const ar = await (
      await backend('/api/action-requests/AR-0001', { headers: asUser('U-01') })
    ).json();
    expect(ar).toMatchObject({
      status: 'pending',
      onBehalfOf: 'U-01',
      via: 'claude',
      kind: 'add_comment',
      payload: { body: 'Recommend escalating to the Compliance Lead.' },
      rationale: 'Two of three indicators are met.',
    });
  });

  it('text of a pending write starts with "Nothing has changed yet."', async () => {
    const r = await call('add_comment', { alertId: 'ALT-1042', body: 'x', rationale: 'y' });
    expect(text(r)).toBe(
      `Nothing has changed yet. Priya Shah must approve this in the app: ${actionRequestUrl(APP, 'AR-0001')}`,
    );
  });

  it('acknowledge_alert is queued the same way', async () => {
    const r = await call('acknowledge_alert', { alertId: 'ALT-1042', rationale: 'Starting work.' });
    expect(r.structuredContent).toMatchObject({ status: 'pending_approval', requestId: 'AR-0001' });
    expect(
      ((await (await backend('/api/alerts/ALT-1042')).json()) as { status: string }).status,
    ).toBe('open');
  });

  it('after a human approves via the API, get_action_request → approved with the resulting event', async () => {
    await call('add_comment', {
      alertId: 'ALT-1042',
      body: 'Please escalate.',
      rationale: 'Pattern.',
    });
    const pending = await call('get_action_request', { requestId: 'AR-0001' });
    expect(pending.structuredContent.request.status).toBe('pending');
    expect(text(pending)).toContain('pending');
    expect(text(pending)).toContain('Nothing has changed yet');

    const approve = await backend('/api/action-requests/AR-0001/approve', {
      method: 'POST',
      headers: asUser('U-01'),
    });
    expect(approve.ok).toBe(true);

    const done = await call('get_action_request', { requestId: 'AR-0001' });
    expect(done.structuredContent.request).toMatchObject({ status: 'approved' });
    expect(done.structuredContent.request.resultEvent).toMatchObject({
      type: 'comment',
      body: 'Please escalate.',
      via: 'claude',
      approvedBy: 'U-01',
    });
    expect(done.structuredContent.url).toBe(alertUrl(APP, 'ALT-1042', { tab: 'timeline' }));
    expect(text(done)).toContain('approved');
    expect(text(done)).not.toContain('Nothing has changed yet');
  });

  it('get_action_request reports rejections with the reason and failures with the cause', async () => {
    await call('add_comment', { alertId: 'ALT-1042', body: 'x', rationale: 'y' });
    await call('acknowledge_alert', { alertId: 'ALT-1047', rationale: 'z' });
    await backend('/api/action-requests/AR-0001/reject', {
      method: 'POST',
      headers: { ...asUser('U-01'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Too early.' }),
    });
    const rejected = await call('get_action_request', { requestId: 'AR-0001' });
    expect(rejected.structuredContent.request).toMatchObject({
      status: 'rejected',
      rejectReason: 'Too early.',
    });
    expect(text(rejected)).toContain('Too early.');

    await backend('/api/alerts/ALT-1047/acknowledge', { method: 'POST', headers: asUser('U-01') });
    await backend('/api/action-requests/AR-0002/approve', {
      method: 'POST',
      headers: asUser('U-01'),
    });
    const failed = await call('get_action_request', { requestId: 'AR-0002' });
    expect(failed.structuredContent.request.status).toBe('failed');
    expect(text(failed)).toContain('Cannot acknowledge');
  });

  it('acknowledge_alert on an in_progress alert → isError with the illegal_transition message', async () => {
    const r = await call('acknowledge_alert', { alertId: 'ALT-1013', rationale: 'Starting work.' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('illegal_transition');
    expect(text(r)).toContain('Cannot acknowledge an alert that is in_progress');
  });

  it('requires a rationale', async () => {
    const r = await call('add_comment', { alertId: 'ALT-1042', body: 'x' });
    expect(r.isError).toBe(true);
  });

  it('with approval switched off, a write is applied and reported as such', async () => {
    await backend('/api/users/U-01/settings', {
      method: 'PUT',
      headers: { ...asUser('U-01'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireApprovalForAgentActions: false }),
    });
    const r = await call('add_comment', {
      alertId: 'ALT-1042',
      body: 'Direct.',
      rationale: 'Approval off.',
    });
    expect(r.structuredContent.status).toBe('applied');
    expect(r.structuredContent.event).toMatchObject({
      type: 'comment',
      via: 'claude',
      body: 'Direct.',
    });
    expect(r.structuredContent.url).toBe(alertUrl(APP, 'ALT-1042', { tab: 'timeline' }));
    expect(text(r)).toContain('added');
    expect(text(r)).not.toContain('Nothing has changed yet');
  });
});
