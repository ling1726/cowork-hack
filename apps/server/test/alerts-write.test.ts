import { describe, expect, it } from 'vitest';
import { asAgent, asUser, call, makeApp, T0 } from './helpers.ts';

const U1 = asUser('U-01');

function setup() {
  const made = makeApp();
  const post = (path: string, body?: unknown, headers = U1) =>
    call(made.app, 'POST', path, { headers, ...(body !== undefined ? { body } : {}) });
  const put = (path: string, body: unknown, headers = U1) =>
    call(made.app, 'PUT', path, { headers, body });
  const get = (path: string) => call(made.app, 'GET', path, { headers: U1 });
  return { ...made, post, put, get };
}

const upload = (
  app: ReturnType<typeof makeApp>['app'],
  path: string,
  bytes: Uint8Array,
  name: string,
  type: string,
  headers = U1,
) => {
  const form = new FormData();
  form.set('file', new File([bytes], name, { type }));
  return app.request(path, { method: 'POST', headers, body: form });
};

describe('comments', () => {
  it('comment appends event with actorId U-01 via app and bumps updatedAt', async () => {
    const { post, clock, store } = setup();
    clock.now = new Date(T0.getTime() + 60_000);
    const r = await post('/api/alerts/ALT-1042/comments', { body: 'Looks like layering.' });
    expect(r.status).toBe(200);
    const { alert, event } = (await r.json()) as any;
    expect(event).toMatchObject({
      type: 'comment',
      alertId: 'ALT-1042',
      actorId: 'U-01',
      via: 'app',
      body: 'Looks like layering.',
      at: clock.now.toISOString(),
    });
    expect(event.id).toMatch(/^EV-\d{5}$/);
    expect(event.actionRequestId).toBeUndefined();
    expect(alert.updatedAt).toBe(clock.now.toISOString());
    expect(store.eventsFor('ALT-1042').at(-1)?.id).toBe(event.id);
  });

  it('rejects empty and oversized bodies; unknown alert → 404', async () => {
    const { post } = setup();
    expect((await post('/api/alerts/ALT-1042/comments', { body: '' })).status).toBe(400);
    expect((await post('/api/alerts/ALT-1042/comments', { body: 'x'.repeat(5001) })).status).toBe(
      400,
    );
    expect((await post('/api/alerts/ALT-9999/comments', { body: 'x' })).status).toBe(404);
  });

  it('writes update the search index (new comment text becomes searchable)', async () => {
    const { post, get } = setup();
    await post('/api/alerts/ALT-1042/comments', { body: 'zebrafish detected' });
    const body = (await (await get('/api/alerts?q=zebrafish')).json()) as any;
    expect(body.items.map((i: any) => i.id)).toEqual(['ALT-1042']);
  });
});

describe('lifecycle', () => {
  it('acknowledge open→in_progress; second acknowledge → 409 illegal_transition', async () => {
    const { post } = setup();
    const r = await post('/api/alerts/ALT-1042/acknowledge');
    expect(r.status).toBe(200);
    const { alert, event } = (await r.json()) as any;
    expect(alert.status).toBe('in_progress');
    expect(event).toMatchObject({
      type: 'status_changed',
      from: 'open',
      to: 'in_progress',
      actorId: 'U-01',
    });
    const again = await post('/api/alerts/ALT-1042/acknowledge');
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { code: 'illegal_transition' } });
  });

  it('close requires outcome+note (400 otherwise), sets resolution; reopen requires reason, clears it', async () => {
    const { post } = setup();
    expect((await post('/api/alerts/ALT-1013/close', { outcome: 'false_positive' })).status).toBe(
      400,
    );
    expect((await post('/api/alerts/ALT-1013/close', { note: 'x' })).status).toBe(400);
    const closed = await post('/api/alerts/ALT-1013/close', {
      outcome: 'true_positive',
      note: 'Confirmed.',
    });
    expect(closed.status).toBe(200);
    const c = (await closed.json()) as any;
    expect(c.alert.status).toBe('closed');
    expect(c.alert.resolution).toMatchObject({
      outcome: 'true_positive',
      note: 'Confirmed.',
      closedBy: 'U-01',
    });
    expect(c.event).toMatchObject({
      type: 'status_changed',
      from: 'in_progress',
      to: 'closed',
      reason: 'Confirmed.',
    });

    expect((await post('/api/alerts/ALT-1013/reopen', {})).status).toBe(400);
    const reopened = await post('/api/alerts/ALT-1013/reopen', { reason: 'New evidence.' });
    expect(reopened.status).toBe(200);
    const r = (await reopened.json()) as any;
    expect(r.alert.status).toBe('open');
    expect(r.alert.resolution).toBeUndefined();
    expect(r.event).toMatchObject({ from: 'closed', to: 'open', reason: 'New evidence.' });
  });

  it('close from open and reopen from open are 409', async () => {
    const { post } = setup();
    const close = await post('/api/alerts/ALT-1042/close', { outcome: 'other', note: 'x' });
    expect(close.status).toBe(409);
    const reopen = await post('/api/alerts/ALT-1042/reopen', { reason: 'x' });
    expect(reopen.status).toBe(409);
  });

  it('W4 app side: reopen ALT-0987', async () => {
    const { post } = setup();
    const r = await post('/api/alerts/ALT-0987/reopen', {
      reason: 'ALT-1051 shows a second pre-listing trade.',
    });
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).alert.status).toBe('open');
  });
});

describe('escalation', () => {
  it('escalate keeps status, adds to escalatedTo, records escalated event', async () => {
    const { post, clock } = setup();
    const r = await post('/api/alerts/ALT-1013/escalations', {
      toUserId: 'U-04',
      reason: 'Third alert for this trader.',
    });
    expect(r.status).toBe(200);
    const { alert, event } = (await r.json()) as any;
    expect(alert.status).toBe('in_progress');
    expect(alert.assignees.escalatedTo).toEqual([
      {
        userId: 'U-04',
        at: clock.now.toISOString(),
        byUserId: 'U-01',
        reason: 'Third alert for this trader.',
      },
    ]);
    expect(event).toMatchObject({
      type: 'escalated',
      toUserId: 'U-04',
      reason: 'Third alert for this trader.',
    });
  });

  it('repeat target → 409 already_escalated; closed alert → 409 illegal_transition; unknown target → 400', async () => {
    const { post } = setup();
    await post('/api/alerts/ALT-1013/escalations', { toUserId: 'U-04', reason: 'x' });
    const again = await post('/api/alerts/ALT-1013/escalations', { toUserId: 'U-04', reason: 'y' });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { code: 'already_escalated' } });
    const closed = await post('/api/alerts/ALT-0987/escalations', {
      toUserId: 'U-04',
      reason: 'x',
    });
    expect(closed.status).toBe(409);
    expect(await closed.json()).toMatchObject({ error: { code: 'illegal_transition' } });
    const unknown = await post('/api/alerts/ALT-1013/escalations', {
      toUserId: 'U-99',
      reason: 'x',
    });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ error: { code: 'unknown_user' } });
  });
});

describe('assignees, links, attachments', () => {
  it('assignees update; unknown user → 400; same primary/backup → 400', async () => {
    const { put } = setup();
    const ok = await put('/api/alerts/ALT-1042/assignees', { primaryId: 'U-02', backupId: 'U-04' });
    expect(ok.status).toBe(200);
    const { alert, event } = (await ok.json()) as any;
    expect(alert.assignees).toMatchObject({ primaryId: 'U-02', backupId: 'U-04' });
    expect(event).toMatchObject({ type: 'assignees_changed', primaryId: 'U-02', backupId: 'U-04' });
    const unknown = await put('/api/alerts/ALT-1042/assignees', {
      primaryId: 'U-99',
      backupId: 'U-04',
    });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ error: { code: 'unknown_user' } });
    const same = await put('/api/alerts/ALT-1042/assignees', {
      primaryId: 'U-02',
      backupId: 'U-02',
    });
    expect(same.status).toBe(400);
    expect(await same.json()).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('assignees can be edited on a closed alert', async () => {
    const { put } = setup();
    expect(
      (await put('/api/alerts/ALT-0987/assignees', { primaryId: 'U-01', backupId: 'U-03' })).status,
    ).toBe(200);
  });

  it('link added; non-http urls rejected', async () => {
    const { post } = setup();
    const ok = await post('/api/alerts/ALT-1042/links', {
      title: 'Venue rules',
      url: 'https://example.com/rules',
    });
    expect(ok.status).toBe(200);
    const { alert, event } = (await ok.json()) as any;
    expect(alert.links).toHaveLength(2);
    const link = alert.links.at(-1);
    expect(link).toMatchObject({
      title: 'Venue rules',
      url: 'https://example.com/rules',
      addedBy: 'U-01',
    });
    expect(link.id).toMatch(/^LNK-\d{4}$/);
    expect(event).toMatchObject({ type: 'link_added', linkId: link.id });
    const bad = await post('/api/alerts/ALT-1042/links', {
      title: 'x',
      url: 'javascript:alert(1)',
    });
    expect(bad.status).toBe(400);
  });

  it('attachment upload stored and downloadable with the same bytes', async () => {
    const { app } = setup();
    const bytes = new TextEncoder().encode('time,qty\n1,2\n');
    const r = await upload(
      app,
      '/api/alerts/ALT-1042/attachments',
      bytes,
      'my notes.csv',
      'text/csv',
    );
    expect(r.status).toBe(200);
    const { alert, event } = (await r.json()) as any;
    const att = alert.attachments.at(-1);
    expect(att).toMatchObject({
      filename: 'my notes.csv',
      mimeType: 'text/csv',
      sizeBytes: bytes.length,
      uploadedBy: 'U-01',
    });
    expect(event).toMatchObject({ type: 'attachment_added', attachmentId: att.id });
    const dl = await app.request(`/api/attachments/${att.id}/content`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-type')).toBe('text/csv');
    expect(dl.headers.get('content-disposition')).toContain('my%20notes.csv');
    expect(new Uint8Array(await dl.arrayBuffer())).toEqual(bytes);
  });

  it('seeded attachment downloads', async () => {
    const { app } = setup();
    const dl = await app.request('/api/attachments/ATT-0001/content');
    expect(dl.status).toBe(200);
    expect(await dl.text()).toContain('time,side,price,qty,status,cancelLatencyMs');
    expect((await app.request('/api/attachments/ATT-9999/content')).status).toBe(404);
  });

  it('exactly 5 MB is accepted; 5 MB + 1 → 413 too_large', async () => {
    const { app } = setup();
    const MB5 = 5 * 1024 * 1024;
    const ok = await upload(
      app,
      '/api/alerts/ALT-1042/attachments',
      new Uint8Array(MB5),
      'big.bin',
      'application/octet-stream',
    );
    expect(ok.status).toBe(200);
    const big = await upload(
      app,
      '/api/alerts/ALT-1042/attachments',
      new Uint8Array(MB5 + 1),
      'bigger.bin',
      'application/octet-stream',
    );
    expect(big.status).toBe(413);
    expect(await big.json()).toMatchObject({ error: { code: 'too_large' } });
  });

  it('upload without a file → 400', async () => {
    const { app } = setup();
    const r = await app.request('/api/alerts/ALT-1042/attachments', {
      method: 'POST',
      headers: U1,
      body: new FormData(),
    });
    expect(r.status).toBe(400);
  });
});

describe('identity and agent guard', () => {
  it('missing X-User-Id → 400 missing_user; unknown → 400 unknown_user', async () => {
    const { app } = setup();
    const missing = await call(app, 'POST', '/api/alerts/ALT-1042/comments', {
      body: { body: 'x' },
    });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: { code: 'missing_user' } });
    const unknown = await call(app, 'POST', '/api/alerts/ALT-1042/comments', {
      headers: asUser('U-99'),
      body: { body: 'x' },
    });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ error: { code: 'unknown_user' } });
  });

  it('agent token on every other write route → 403 agent_forbidden', async () => {
    const { app, store } = setup();
    const agent = asAgent('U-01');
    const calls: Array<[string, string, unknown]> = [
      ['POST', '/api/alerts/ALT-1013/close', { outcome: 'other', note: 'x' }],
      ['POST', '/api/alerts/ALT-0987/reopen', { reason: 'x' }],
      ['POST', '/api/alerts/ALT-1013/escalations', { toUserId: 'U-04', reason: 'x' }],
      ['PUT', '/api/alerts/ALT-1042/assignees', { primaryId: 'U-02', backupId: 'U-03' }],
      ['POST', '/api/alerts/ALT-1042/links', { title: 'x', url: 'https://example.com' }],
    ];
    const before = store.eventsFor('ALT-1042').length;
    for (const [method, path, body] of calls) {
      const r = await call(app, method, path, { headers: agent, body });
      expect(r.status, `${method} ${path}`).toBe(403);
      expect(await r.json()).toMatchObject({ error: { code: 'agent_forbidden' } });
    }
    const up = await upload(
      app,
      '/api/alerts/ALT-1042/attachments',
      new Uint8Array(3),
      'a.bin',
      'application/octet-stream',
      agent,
    );
    expect(up.status).toBe(403);
    expect(store.eventsFor('ALT-1042')).toHaveLength(before);
  });
});
