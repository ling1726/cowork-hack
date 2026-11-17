import { createApiClient } from '@app/api-client';
import { actionRequestUrl } from '@app/domain';
import { serve } from '@hono/node-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdtempSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AGENT_TOKEN, COWORK_TOKEN, makeApp } from '../../server/test/helpers.ts';
import { startHttp } from '../src/server.ts';
import { UI_CAPABILITIES } from './helpers.ts';

const APP = 'http://localhost:5173';
const FIXTURES = fileURLToPath(new URL('./fixtures/ui', import.meta.url));
const MIME = 'text/html;profile=mcp-app';

type Result = {
  isError?: boolean;
  structuredContent?: any;
  _meta?: Record<string, any>;
  content: Array<{ type: string; text: string }>;
};
const text = (r: Result) =>
  r.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

let backendUrl: string;
const stops: Array<() => Promise<void> | void> = [];

async function stack(opts: { uiDir?: string; decide: boolean }) {
  const api = createApiClient({
    baseUrl: backendUrl,
    getUserId: () => 'U-01',
    agentToken: AGENT_TOKEN,
  });
  const decisionApi = createApiClient({
    baseUrl: backendUrl,
    getUserId: () => 'U-01',
    agentToken: COWORK_TOKEN,
  });
  const mcp = await startHttp({
    port: 0,
    deps: {
      api,
      appBaseUrl: APP,
      actingUserId: 'U-01',
      ...(opts.uiDir ? { uiDir: opts.uiDir } : {}),
      ...(opts.decide ? { decisionApi } : {}),
    },
  });
  stops.push(mcp.close);
  const connect = async (capabilities: Record<string, unknown> = {}) => {
    const client = new Client({ name: 'test', version: '0' }, { capabilities });
    await client.connect(new StreamableHTTPClientTransport(new URL(mcp.url)));
    stops.push(() => client.close());
    const call = async (name: string, args: Record<string, unknown> = {}) =>
      (await client.callTool({ name, arguments: args })) as Result;
    return { client, call };
  };
  return { connect };
}

let ui: Awaited<ReturnType<Awaited<ReturnType<typeof stack>>['connect']>>;
let plain: typeof ui;

beforeAll(async () => {
  const { app } = makeApp();
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  backendUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  stops.push(() => void server.close());
  const s = await stack({ uiDir: FIXTURES, decide: true });
  ui = await s.connect(UI_CAPABILITIES);
  plain = await s.connect();
});

afterAll(async () => {
  for (const stop of stops.reverse()) await stop();
});

beforeEach(async () => {
  expect((await fetch(`${backendUrl}/api/admin/reset`, { method: 'POST' })).ok).toBe(true);
});

const VIEW_TOOLS: Record<string, string> = {
  search_alerts: 'ui://alerts/alert-list',
  get_alert: 'ui://alerts/alert-card',
  add_comment: 'ui://alerts/action-request',
  acknowledge_alert: 'ui://alerts/action-request',
  get_action_request: 'ui://alerts/action-request',
};

describe('MCP Apps views', () => {
  it('a UI client sees the three resources with the MCP App MIME type', async () => {
    const { resources } = await ui.client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual([
      'ui://alerts/action-request',
      'ui://alerts/alert-card',
      'ui://alerts/alert-list',
    ]);
    const read = await ui.client.readResource({ uri: 'ui://alerts/alert-card' });
    const content = read.contents[0] as { mimeType?: string; text?: string };
    expect(content.mimeType).toBe(MIME);
    expect(content.text).toBe(readFileSync(join(FIXTURES, 'alert-card.html'), 'utf8'));
  });

  it('a UI client sees resourceUri on the five view tools and the decision tools as app-only', async () => {
    const { tools } = await ui.client.listTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const [name, uri] of Object.entries(VIEW_TOOLS)) {
      expect((byName.get(name)?._meta as any)?.ui?.resourceUri, name).toBe(uri);
    }
    for (const name of ['approve_action_request', 'reject_action_request']) {
      const meta = byName.get(name)?._meta as any;
      expect(meta?.ui?.visibility, name).toEqual(['app']);
      expect(byName.get(name)?.annotations?.readOnlyHint, name).toBe(false);
    }
    expect(tools).toHaveLength(10);
  });

  it('a plain client sees the phase 1 surface exactly', async () => {
    const { tools } = await plain.client.listTools();
    expect(tools).toHaveLength(8);
    for (const t of tools) expect((t._meta as any)?.ui, t.name).toBeUndefined();
    const resources = await plain.client.listResources().then(
      (r) => r.resources,
      () => [],
    );
    expect(resources).toEqual([]);
    const args = { severity: ['high'] };
    const a = await plain.call('search_alerts', args);
    const b = await ui.call('search_alerts', args);
    expect(text(b)).toBe(text(a));
    expect(a._meta?.['alerts/view']).toBeUndefined();
  });

  it('view payload stays out of the text', async () => {
    const viaUi = await ui.call('get_alert', { alertId: 'ALT-1042' });
    const viaPlain = await plain.call('get_alert', { alertId: 'ALT-1042' });
    const view = viaUi._meta?.['alerts/view'];
    expect(view.recentEvents.length).toBeGreaterThan(0);
    expect(view.recentEvents.length).toBeLessThanOrEqual(3);
    expect(view.users).toHaveLength(6);
    expect(text(viaUi)).toBe(text(viaPlain));
    expect(viaUi.structuredContent).toEqual(viaPlain.structuredContent);
  });

  it('a queued write renders the request view', async () => {
    const r = await ui.call('acknowledge_alert', { alertId: 'ALT-1042', rationale: 'Start.' });
    const view = r._meta?.['alerts/view'];
    expect(view).toMatchObject({
      kind: 'request',
      canDecide: true,
      requestUrl: actionRequestUrl(APP, 'AR-0001'),
      detail: { id: 'AR-0001', status: 'pending', alert: { id: 'ALT-1042' } },
    });
    expect(view.users).toHaveLength(6);
  });

  it('approve_action_request approves as the human in Cowork', async () => {
    await ui.call('acknowledge_alert', { alertId: 'ALT-1042', rationale: 'Start.' });
    const r = await ui.call('approve_action_request', { requestId: 'AR-0001' });
    expect(r.isError).toBeFalsy();
    expect(text(r)).toBe('Approved AR-0001 in Cowork.');
    expect(r.structuredContent.request).toMatchObject({ status: 'approved', decidedIn: 'cowork' });
    expect(r._meta?.['alerts/view'].detail.status).toBe('approved');
    const res = await fetch(`${backendUrl}/api/alerts/ALT-1042`, {
      headers: { 'X-User-Id': 'U-01' },
    });
    const alert = (await res.json()) as { status: string };
    expect(alert.status).toBe('in_progress');
  });

  it('reject_action_request records the reason', async () => {
    await ui.call('add_comment', { alertId: 'ALT-1042', body: 'x', rationale: 'y' });
    const r = await ui.call('reject_action_request', { requestId: 'AR-0001', reason: 'Not yet' });
    expect(text(r)).toBe('Rejected AR-0001 in Cowork.');
    expect(r.structuredContent.request).toMatchObject({
      status: 'rejected',
      decidedIn: 'cowork',
      rejectReason: 'Not yet',
    });
  });

  it('a reason over 1000 chars is a validation error', async () => {
    await ui.call('add_comment', { alertId: 'ALT-1042', body: 'x', rationale: 'y' });
    const r = await ui
      .call('reject_action_request', { requestId: 'AR-0001', reason: 'x'.repeat(1001) })
      .catch((e: Error) => ({ isError: true, content: [{ type: 'text', text: e.message }] }));
    expect(r.isError).toBe(true);
  });

  it('approving twice is a tool error naming the conflict', async () => {
    await ui.call('acknowledge_alert', { alertId: 'ALT-1042', rationale: 'Start.' });
    await ui.call('approve_action_request', { requestId: 'AR-0001' });
    const r = await ui.call('approve_action_request', { requestId: 'AR-0001' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('already_decided');
  });

  it('with approval off, a write renders the applied view', async () => {
    const put = await fetch(`${backendUrl}/api/users/U-01/settings`, {
      method: 'PUT',
      headers: { 'X-User-Id': 'U-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireApprovalForAgentActions: false }),
    });
    expect(put.ok).toBe(true);
    const r = await ui.call('add_comment', { alertId: 'ALT-1042', body: 'x', rationale: 'y' });
    expect(r._meta?.['alerts/view']).toMatchObject({
      kind: 'applied',
      url: `${APP}/alerts/ALT-1042?tab=timeline`,
    });
  });

  it('without built views, a UI client gets no resources and no decision tools', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'mcp-ui-empty-'));
    const s = await stack({ uiDir: empty, decide: true });
    const c = await s.connect(UI_CAPABILITIES);
    const { tools } = await c.client.listTools();
    expect(tools).toHaveLength(8);
    for (const t of tools) expect((t._meta as any)?.ui, t.name).toBeUndefined();
    const r = await c.call('get_alert', { alertId: 'ALT-1042' });
    expect(r._meta?.['alerts/view']).toBeUndefined();
  });

  it('without COWORK_TOKEN, the request view has canDecide false and no decision tools', async () => {
    const s = await stack({ uiDir: FIXTURES, decide: false });
    const c = await s.connect(UI_CAPABILITIES);
    const { tools } = await c.client.listTools();
    expect(tools.map((t) => t.name)).not.toContain('approve_action_request');
    const r = await c.call('acknowledge_alert', { alertId: 'ALT-1042', rationale: 'Start.' });
    expect(r._meta?.['alerts/view'].canDecide).toBe(false);
  });
});
