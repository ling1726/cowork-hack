import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../../../apps/server/src/openapi.ts';
import { AGENT_TOKEN, makeApp } from '../../../apps/server/test/helpers.ts';
import { ApiRequestError, createApiClient, unwrap } from '../src/index.ts';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

function clients() {
  const { app } = makeApp();
  const fetch = (req: Request) => Promise.resolve(app.fetch(req));
  const human = createApiClient({ baseUrl: 'http://localhost', getUserId: () => 'U-01', fetch });
  const agent = createApiClient({
    baseUrl: 'http://localhost',
    getUserId: () => 'U-01',
    agentToken: AGENT_TOKEN,
    fetch,
  });
  return { human, agent };
}

describe('api client', () => {
  it('lists alerts with comma arrays', async () => {
    const { human } = clients();
    const r = unwrap(
      await human.GET('/api/alerts', {
        params: { query: { status: ['open', 'in_progress'], pageSize: 100 } },
      }),
    );
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((a) => a.status !== 'closed')).toBe(true);
  });

  it('serializes arrays as comma-separated values on the wire', async () => {
    const seen: string[] = [];
    const api = createApiClient({
      baseUrl: 'http://localhost',
      fetch: (req) => {
        seen.push(new URL(req.url).search);
        return Promise.resolve(Response.json({ items: [], total: 0, page: 1, pageSize: 25 }));
      },
    });
    await api.GET('/api/alerts', {
      params: { query: { status: ['open', 'in_progress'], desk: ['eu-equities'], q: 'layering' } },
    });
    expect(decodeURIComponent(seen[0] ?? '')).toBe(
      '?status=open,in_progress&desk=eu-equities&q=layering',
    );
  });

  it('sends X-User-Id for humans and the bearer token for the agent', async () => {
    const headers: Array<[string | null, string | null]> = [];
    const spy = (opts: { agentToken?: string }) =>
      createApiClient({
        baseUrl: 'http://localhost',
        getUserId: () => 'U-02',
        ...opts,
        fetch: (req) => {
          headers.push([req.headers.get('X-User-Id'), req.headers.get('Authorization')]);
          return Promise.resolve(Response.json([]));
        },
      });
    await spy({}).GET('/api/users');
    await spy({ agentToken: 't' }).GET('/api/users');
    expect(headers).toEqual([
      ['U-02', null],
      ['U-02', 'Bearer t'],
    ]);
  });

  it('omits X-User-Id when there is no current user', async () => {
    let id: string | null = 'unset';
    const api = createApiClient({
      baseUrl: 'http://localhost',
      getUserId: () => undefined,
      fetch: (req) => {
        id = req.headers.get('X-User-Id');
        return Promise.resolve(Response.json([]));
      },
    });
    await api.GET('/api/users');
    expect(id).toBeNull();
  });

  it('agent client gets 202 pending on comment', async () => {
    const { agent } = clients();
    const r = await agent.POST('/api/alerts/{id}/comments', {
      params: { path: { id: 'ALT-1042' } },
      body: { body: 'Recommend escalation.', rationale: 'Matches two of three indicators.' },
    });
    expect(r.response.status).toBe(202);
    const data = unwrap(r);
    expect('actionRequest' in data && data.actionRequest.status).toBe('pending');
  });

  it('unwrap throws ApiRequestError with code on 409', async () => {
    const { human } = clients();
    const ack = () =>
      human.POST('/api/alerts/{id}/acknowledge', { params: { path: { id: 'ALT-1042' } } });
    unwrap(await ack());
    const err = await (async () => unwrap(await ack()))().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 409, code: 'illegal_transition' });
  });

  it('unwrap surfaces validation errors with details', async () => {
    const { human } = clients();
    const err = await (async () =>
      unwrap(
        await human.POST('/api/alerts/{id}/comments', {
          params: { path: { id: 'ALT-1042' } },
          body: { body: '' },
        }),
      ))().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 400, code: 'validation_error' });
    expect((err as ApiRequestError).details).toBeDefined();
  });

  it('openapi.json is up to date', async () => {
    const committed = JSON.parse(readFileSync(here('../src/openapi.json'), 'utf8'));
    expect(await openApiDocument()).toEqual(committed);
  });

  it('schema.d.ts is up to date', async () => {
    const generated = astToString(
      await openapiTS(JSON.parse(readFileSync(here('../src/openapi.json'), 'utf8'))),
    );
    // The CLI prepends a banner comment; the in-process AST does not.
    const committed = readFileSync(here('../src/schema.d.ts'), 'utf8').replace(
      /^\/\*\*[\s\S]*?\*\/\s*/,
      '',
    );
    expect(committed.trim()).toBe(generated.trim());
  });
});
