import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors.ts';
import { forbidAgent, requireUser } from '../src/context.ts';
import { loadEnv } from '../src/env.ts';
import { asAgent, asUser, call, makeApp } from './helpers.ts';

function appWithProbes() {
  const made = makeApp();
  made.app.get('/api/_whoami', (c) => c.json(c.get('ctx')));
  made.app.get('/api/_require-user', (c) => c.json({ userId: requireUser(c) }));
  made.app.get('/api/_forbid-agent', (c) => {
    forbidAgent(c);
    return c.json({ ok: true });
  });
  return made;
}

describe('agent detection', () => {
  it('no token → via app; valid token → via claude; wrong token → via app', async () => {
    const { app } = appWithProbes();
    const none = await (await call(app, 'GET', '/api/_whoami', { headers: asUser('U-01') })).json();
    expect(none).toEqual({ userId: 'U-01', via: 'app', isAgent: false });
    const agent = await (
      await call(app, 'GET', '/api/_whoami', { headers: asAgent('U-01') })
    ).json();
    expect(agent).toEqual({ userId: 'U-01', via: 'claude', isAgent: true });
    const wrong = await (
      await call(app, 'GET', '/api/_whoami', {
        headers: { 'X-User-Id': 'U-01', Authorization: 'Bearer nope' },
      })
    ).json();
    expect(wrong).toMatchObject({ via: 'app', isAgent: false });
  });

  it('a token of a different length or scheme is not an agent', async () => {
    const { app } = appWithProbes();
    for (const Authorization of [
      'Bearer ',
      'Bearer test-agent-token-and-more',
      'Basic test-agent-token',
      'test-agent-token',
    ]) {
      const r = await (
        await call(app, 'GET', '/api/_whoami', { headers: { Authorization } })
      ).json();
      expect(r, Authorization).toMatchObject({ via: 'app', isAgent: false });
    }
  });

  it('X-Via header is ignored', async () => {
    const { app } = appWithProbes();
    const r = await (
      await call(app, 'GET', '/api/_whoami', {
        headers: { 'X-User-Id': 'U-01', 'X-Via': 'claude' },
      })
    ).json();
    expect(r).toMatchObject({ via: 'app', isAgent: false });
    const hidden = await (
      await call(app, 'GET', '/api/_whoami', { headers: { ...asAgent('U-01'), 'X-Via': 'app' } })
    ).json();
    expect(hidden).toMatchObject({ via: 'claude', isAgent: true });
  });
});

describe('request guards', () => {
  it('requireUser: missing → 400 missing_user, unknown → 400 unknown_user, known → id', async () => {
    const { app } = appWithProbes();
    const missing = await call(app, 'GET', '/api/_require-user');
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: { code: 'missing_user' } });
    const unknown = await call(app, 'GET', '/api/_require-user', { headers: asUser('U-99') });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ error: { code: 'unknown_user' } });
    const ok = await call(app, 'GET', '/api/_require-user', { headers: asUser('U-02') });
    expect(await ok.json()).toEqual({ userId: 'U-02' });
  });

  it('forbidAgent: agent → 403 agent_forbidden, human passes', async () => {
    const { app } = appWithProbes();
    const agent = await call(app, 'GET', '/api/_forbid-agent', { headers: asAgent('U-01') });
    expect(agent.status).toBe(403);
    expect(await agent.json()).toMatchObject({ error: { code: 'agent_forbidden' } });
    expect((await call(app, 'GET', '/api/_forbid-agent', { headers: asUser('U-01') })).status).toBe(
      200,
    );
  });

  it('ApiError maps to the error body, with details', async () => {
    const { app } = makeApp();
    app.get('/api/_boom', () => {
      throw new ApiError(409, 'illegal_transition', 'nope', { from: 'open' });
    });
    const r = await call(app, 'GET', '/api/_boom');
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({
      error: { code: 'illegal_transition', message: 'nope', details: { from: 'open' } },
    });
  });

  it('unexpected exceptions → 500 internal_error without leaking the message', async () => {
    const { app } = makeApp();
    app.get('/api/_crash', () => {
      throw new Error('secret detail');
    });
    const r = await call(app, 'GET', '/api/_crash');
    expect(r.status).toBe(500);
    const body = (await r.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('secret detail');
  });
});

describe('shell routes', () => {
  it('GET /api/users returns 6 users', async () => {
    const { app } = makeApp();
    const r = await call(app, 'GET', '/api/users');
    expect(r.status).toBe(200);
    const users = (await r.json()) as Array<{ id: string }>;
    expect(users).toHaveLength(6);
    expect(users[0]?.id).toBe('U-01');
  });

  it('GET /api/meta returns labelled enums, desks, rules and traders', async () => {
    const { app } = makeApp();
    const meta = (await (await call(app, 'GET', '/api/meta')).json()) as any;
    expect(meta.desks).toContainEqual({ value: 'eu-equities', label: 'EU Equities' });
    expect(meta.statuses.map((s: any) => s.value)).toEqual(['open', 'in_progress', 'closed']);
    expect(meta.severities.map((s: any) => s.value)).toEqual(['low', 'medium', 'high', 'critical']);
    expect(meta.categories).toHaveLength(8);
    expect(meta.rules).toContainEqual({ id: 'MAR-12-1a', name: 'Layering / spoofing' });
    expect(meta.traders).toContainEqual({ id: 'T-0412', name: 'James Whitfield' });
    expect(new Set(meta.traders.map((t: any) => t.id)).size).toBe(meta.traders.length);
  });

  it('GET /api/openapi.json is OpenAPI 3.1', async () => {
    const { app } = makeApp();
    const doc = (await (await call(app, 'GET', '/api/openapi.json')).json()) as any;
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/api/users', '/api/meta', '/api/admin/reset']),
    );
  });

  it('POST /api/admin/reset restores seeded state', async () => {
    const { app, store } = makeApp();
    const alert = store.getAlert('ALT-1042');
    if (!alert) throw new Error('missing');
    store.saveAlert({ ...alert, status: 'closed' });
    store.appendEvent({
      type: 'comment',
      alertId: 'ALT-1042',
      actorId: 'U-01',
      via: 'app',
      body: 'x',
    });
    store.settings.set('U-01', { requireApprovalForAgentActions: false });
    const r = await call(app, 'POST', '/api/admin/reset');
    expect(r.status).toBe(200);
    expect(store.getAlert('ALT-1042')?.status).toBe('open');
    expect(store.eventsFor('ALT-1042')).toHaveLength(3);
    expect(store.settingsFor('U-01').requireApprovalForAgentActions).toBe(true);
  });

  it('unknown route → 404 error body shape', async () => {
    const { app } = makeApp();
    const r = await call(app, 'GET', '/api/nope');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
  });
});

describe('loadEnv', () => {
  it('applies defaults and requires AGENT_TOKEN', () => {
    expect(loadEnv({ AGENT_TOKEN: 'x' })).toEqual({ port: 3001, seed: 1042, agentToken: 'x' });
    expect(loadEnv({ AGENT_TOKEN: 'x', PORT: '4000', SEED: '7' })).toEqual({
      port: 4000,
      seed: 7,
      agentToken: 'x',
    });
    expect(() => loadEnv({})).toThrow(/AGENT_TOKEN/);
    expect(() => loadEnv({ AGENT_TOKEN: 'x', PORT: 'abc' })).toThrow(/PORT/);
  });
});
