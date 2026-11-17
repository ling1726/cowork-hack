import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { loadEnv } from '../src/env.ts';
import { buildSeed } from '../src/seed/index.ts';
import { Store } from '../src/store/store.ts';
import { AGENT_TOKEN, asAgent, asCowork, call, makeApp, T0 } from './helpers.ts';

const json = async (r: Response) => (await r.json()) as any;

function setup(app = makeApp().app) {
  const req = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
    call(app, method, path, { headers, ...(body !== undefined ? { body } : {}) });
  const queueAck = () =>
    req('POST', '/api/alerts/ALT-1042/acknowledge', asAgent('U-01'), { rationale: 'Start.' });
  const queueComment = () =>
    req('POST', '/api/alerts/ALT-1042/comments', asAgent('U-01'), {
      body: 'Recommend escalation.',
      rationale: 'Pattern.',
    });
  return { app, req, queueAck, queueComment };
}

describe('the Cowork token', () => {
  it("approves the acting user's pending request, recorded as decided in Cowork", async () => {
    const { req, queueAck } = setup();
    await queueAck();
    const r = await req('POST', '/api/action-requests/AR-0001/approve', asCowork('U-01'));
    expect(r.status).toBe(200);
    const body = await json(r);
    expect(body).toMatchObject({ status: 'approved', decidedIn: 'cowork', decidedBy: 'U-01' });
    expect(body.resultEvent).toMatchObject({
      via: 'claude',
      approvedBy: 'U-01',
      decidedIn: 'cowork',
    });
  });

  it('rejects with a reason, recorded as decided in Cowork', async () => {
    const { app, req, queueComment } = setup();
    await queueComment();
    const r = await req('POST', '/api/action-requests/AR-0001/reject', asCowork('U-01'), {
      reason: 'Not yet.',
    });
    expect(r.status).toBe(200);
    expect(await json(r)).toMatchObject({
      status: 'rejected',
      decidedIn: 'cowork',
      rejectReason: 'Not yet.',
    });
    const timeline = await json(await call(app, 'GET', '/api/alerts/ALT-1042/timeline'));
    expect(timeline.at(-1)).toMatchObject({ type: 'action_rejected', decidedIn: 'cowork' });
  });

  it('is refused everywhere else, reads included', async () => {
    const { req, queueAck } = setup();
    await queueAck();
    const C = asCowork('U-01');
    const attempts: Array<[string, string, unknown?]> = [
      ['GET', '/api/alerts'],
      ['GET', '/api/action-requests'],
      ['GET', '/api/action-requests/AR-0001'],
      ['POST', '/api/alerts/ALT-1042/comments', { body: 'x' }],
      ['POST', '/api/alerts/ALT-1042/acknowledge', {}],
      ['PUT', '/api/users/U-01/settings', { requireApprovalForAgentActions: false }],
      ['POST', '/api/admin/reset'],
      ['GET', '/api/action-requests/AR-0001/approve'],
    ];
    for (const [method, path, body] of attempts) {
      const r = await req(method, path, C, body);
      expect(r.status, `${method} ${path}`).toBe(403);
      expect((await json(r)).error.code, `${method} ${path}`).toBe('cowork_forbidden');
    }
  });

  it("cannot decide someone else's request", async () => {
    const { req, queueAck } = setup();
    await queueAck();
    const r = await req('POST', '/api/action-requests/AR-0001/approve', asCowork('U-02'));
    expect(r.status).toBe(403);
    expect((await json(r)).error.code).toBe('not_owner');
  });

  it('cannot decide a request twice', async () => {
    const { req, queueAck } = setup();
    await queueAck();
    await req('POST', '/api/action-requests/AR-0001/approve', asCowork('U-01'));
    const r = await req('POST', '/api/action-requests/AR-0001/approve', asCowork('U-01'));
    expect(r.status).toBe(409);
    expect((await json(r)).error.code).toBe('already_decided');
  });

  it('is an ordinary bearer when COWORK_TOKEN is not configured', async () => {
    const store = new Store(buildSeed({ now: T0, seed: 1042 }), () => T0);
    const { req, queueAck } = setup(
      createApp({ store, agentToken: AGENT_TOKEN, now: () => T0, seed: 1042 }),
    );
    await queueAck();
    expect((await req('GET', '/api/alerts', asCowork('U-01'))).status).toBe(200);
    const r = await req('POST', '/api/action-requests/AR-0001/approve', asCowork('U-01'));
    expect((await json(r)).decidedIn).toBe('app');
  });
});

describe('server env', () => {
  it('reads COWORK_TOKEN when set and leaves it undefined when empty', () => {
    expect(loadEnv({ AGENT_TOKEN: 'a', COWORK_TOKEN: 'c' }).coworkToken).toBe('c');
    expect(loadEnv({ AGENT_TOKEN: 'a', COWORK_TOKEN: '' }).coworkToken).toBeUndefined();
  });
  it('refuses the same value for both tokens', () => {
    expect(() => loadEnv({ AGENT_TOKEN: 'same', COWORK_TOKEN: 'same' })).toThrow(
      'AGENT_TOKEN and COWORK_TOKEN must differ',
    );
  });
});
