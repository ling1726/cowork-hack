import { describe, expect, it } from 'vitest';
import { asAgent, asUser, call, makeApp, T0 } from './helpers.ts';

const U1 = asUser('U-01');
const A1 = asAgent('U-01');

function setup() {
  const made = makeApp();
  const req = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
    call(made.app, method, path, { headers, ...(body !== undefined ? { body } : {}) });
  const agentComment = (alertId = 'ALT-1042', body = 'Recommend escalation.') =>
    req('POST', `/api/alerts/${alertId}/comments`, A1, {
      body,
      rationale: 'Pattern matches the rule.',
    });
  const agentAck = (alertId = 'ALT-1042') =>
    req('POST', `/api/alerts/${alertId}/acknowledge`, A1, {
      rationale: 'Starting the investigation.',
    });
  const approve = (id: string, headers = U1) =>
    req('POST', `/api/action-requests/${id}/approve`, headers);
  const reject = (id: string, reason?: string, headers = U1) =>
    req('POST', `/api/action-requests/${id}/reject`, headers, reason ? { reason } : {});
  return { ...made, req, agentComment, agentAck, approve, reject };
}

const json = async (r: Response) => (await r.json()) as any;

describe('queueing agent writes', () => {
  it('agent comment with approval on → 202 pending AR; timeline gains only action_requested', async () => {
    const { agentComment, store, clock } = setup();
    const before = store.eventsFor('ALT-1042').length;
    const r = await agentComment();
    expect(r.status).toBe(202);
    const { actionRequest: ar } = await json(r);
    expect(ar).toMatchObject({
      id: 'AR-0001',
      alertId: 'ALT-1042',
      kind: 'add_comment',
      payload: { body: 'Recommend escalation.' },
      onBehalfOf: 'U-01',
      via: 'claude',
      rationale: 'Pattern matches the rule.',
      status: 'pending',
      createdAt: clock.now.toISOString(),
    });
    const events = store.eventsFor('ALT-1042');
    expect(events).toHaveLength(before + 1);
    expect(events.at(-1)).toMatchObject({
      type: 'action_requested',
      requestId: 'AR-0001',
      kind: 'add_comment',
      via: 'claude',
      actorId: 'U-01',
    });
    expect(events.some((e) => e.type === 'comment' && e.body === 'Recommend escalation.')).toBe(
      false,
    );
    expect(store.getAlert('ALT-1042')?.status).toBe('open');
  });

  it('agent acknowledge is queued with an empty payload', async () => {
    const { agentAck } = setup();
    const r = await agentAck();
    expect(r.status).toBe(202);
    expect((await json(r)).actionRequest).toMatchObject({
      kind: 'acknowledge',
      payload: {},
      status: 'pending',
    });
  });

  it('agent without rationale → 400', async () => {
    const { req } = setup();
    const c = await req('POST', '/api/alerts/ALT-1042/comments', A1, { body: 'x' });
    expect(c.status).toBe(400);
    expect(await json(c)).toMatchObject({ error: { code: 'rationale_required' } });
    expect((await req('POST', '/api/alerts/ALT-1042/acknowledge', A1)).status).toBe(400);
  });

  it('humans may omit the rationale', async () => {
    const { req } = setup();
    expect((await req('POST', '/api/alerts/ALT-1042/comments', U1, { body: 'x' })).status).toBe(
      200,
    );
    expect((await req('POST', '/api/alerts/ALT-1042/acknowledge', U1)).status).toBe(200);
  });

  it('agent acknowledge on an in_progress alert → 409 at submission; unknown alert → 404', async () => {
    const { agentAck, store } = setup();
    const r = await agentAck('ALT-1013');
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ error: { code: 'illegal_transition' } });
    expect(store.actionRequests.size).toBe(0);
    expect((await agentAck('ALT-9999')).status).toBe(404);
  });

  it('agent requests need a known user', async () => {
    const { req } = setup();
    const r = await req('POST', '/api/alerts/ALT-1042/comments', asAgent('U-99'), {
      body: 'x',
      rationale: 'y',
    });
    expect(r.status).toBe(400);
  });

  it('setting off → agent comment 200 applied immediately, via claude, no approvedBy', async () => {
    const { req, store } = setup();
    const put = await req('PUT', '/api/users/U-01/settings', U1, {
      requireApprovalForAgentActions: false,
    });
    expect(put.status).toBe(200);
    const r = await req('POST', '/api/alerts/ALT-1042/comments', A1, {
      body: 'Direct.',
      rationale: 'Approval is off.',
    });
    expect(r.status).toBe(200);
    const { event } = await json(r);
    expect(event).toMatchObject({
      type: 'comment',
      via: 'claude',
      actorId: 'U-01',
      body: 'Direct.',
    });
    expect(event.approvedBy).toBeUndefined();
    expect(event.actionRequestId).toBeUndefined();
    expect(store.actionRequests.size).toBe(0);
  });
});

describe('approving and rejecting', () => {
  it('approve applies the comment as actorId U-01, via claude, approvedBy U-01, actionRequestId set', async () => {
    const { agentComment, approve, store, clock } = setup();
    await agentComment();
    clock.now = new Date(T0.getTime() + 5 * 60_000);
    const r = await approve('AR-0001');
    expect(r.status).toBe(200);
    const body = await json(r);
    expect(body).toMatchObject({
      id: 'AR-0001',
      status: 'approved',
      decidedBy: 'U-01',
      decidedAt: clock.now.toISOString(),
      decidedIn: 'app',
      alert: { id: 'ALT-1042' },
    });
    expect(body.resultEvent).toMatchObject({
      type: 'comment',
      body: 'Recommend escalation.',
      actorId: 'U-01',
      via: 'claude',
      approvedBy: 'U-01',
      actionRequestId: 'AR-0001',
      decidedIn: 'app',
    });
    expect(body.resultEventId).toBe(body.resultEvent.id);
    expect(store.eventsFor('ALT-1042').at(-1)?.id).toBe(body.resultEventId);
  });

  it('approving an acknowledge moves the alert to in_progress', async () => {
    const { agentAck, approve, store } = setup();
    await agentAck();
    const r = await approve('AR-0001');
    expect(r.status).toBe(200);
    expect(store.getAlert('ALT-1042')?.status).toBe('in_progress');
    expect((await json(r)).alert.status).toBe('in_progress');
  });

  it('agent acknowledge queued; human acknowledges first; approve → request failed illegal_transition, alert unchanged', async () => {
    const { agentAck, approve, req, store } = setup();
    await agentAck();
    await req('POST', '/api/alerts/ALT-1042/acknowledge', U1);
    const eventsBefore = store.eventsFor('ALT-1042').length;
    const r = await approve('AR-0001');
    expect(r.status).toBe(200);
    const body = await json(r);
    expect(body.status).toBe('failed');
    expect(body.failure).toMatchObject({ code: 'illegal_transition' });
    expect(body.resultEventId).toBeUndefined();
    expect(store.eventsFor('ALT-1042')).toHaveLength(eventsBefore);
    expect(store.getAlert('ALT-1042')?.status).toBe('in_progress');
  });

  it('reject records action_rejected event with reason; request rejected', async () => {
    const { agentComment, reject, store } = setup();
    await agentComment();
    const r = await reject('AR-0001', 'Not now.');
    expect(r.status).toBe(200);
    const body = await json(r);
    expect(body).toMatchObject({
      status: 'rejected',
      rejectReason: 'Not now.',
      decidedBy: 'U-01',
      decidedIn: 'app',
    });
    expect(store.eventsFor('ALT-1042').at(-1)).toMatchObject({
      type: 'action_rejected',
      requestId: 'AR-0001',
      reason: 'Not now.',
      actorId: 'U-01',
      via: 'app',
      decidedIn: 'app',
    });
    expect(
      store
        .eventsFor('ALT-1042')
        .some((e) => e.type === 'comment' && e.body === 'Recommend escalation.'),
    ).toBe(false);
  });

  it('reject without a reason is allowed', async () => {
    const { agentComment, reject } = setup();
    await agentComment();
    const body = await json(await reject('AR-0001'));
    expect(body.status).toBe('rejected');
    expect(body.rejectReason).toBeUndefined();
  });

  it.each([
    ['approve', 'approve'],
    ['reject', 'approve'],
    ['approve', 'reject'],
  ] as const)(
    '%s then %s → second 409 already_decided and changes nothing',
    async (first, second) => {
      const { agentComment, approve, reject, store } = setup();
      await agentComment();
      const act = (what: string) => (what === 'approve' ? approve('AR-0001') : reject('AR-0001'));
      expect((await act(first)).status).toBe(200);
      const snapshot = JSON.stringify([
        store.actionRequests.get('AR-0001'),
        store.eventsFor('ALT-1042'),
      ]);
      const r = await act(second);
      expect(r.status).toBe(409);
      expect(await json(r)).toMatchObject({ error: { code: 'already_decided' } });
      expect(
        JSON.stringify([store.actionRequests.get('AR-0001'), store.eventsFor('ALT-1042')]),
      ).toBe(snapshot);
    },
  );

  it('agent token → 403 on approve, reject, PUT settings', async () => {
    const { agentComment, req, store } = setup();
    await agentComment();
    for (const [method, path, body] of [
      ['POST', '/api/action-requests/AR-0001/approve', undefined],
      ['POST', '/api/action-requests/AR-0001/reject', {}],
      ['PUT', '/api/users/U-01/settings', { requireApprovalForAgentActions: false }],
    ] as const) {
      const r = await req(method, path, A1, body);
      expect(r.status, path).toBe(403);
      expect(await json(r)).toMatchObject({ error: { code: 'agent_forbidden' } });
    }
    expect(store.actionRequests.get('AR-0001')?.status).toBe('pending');
    expect(store.settingsFor('U-01').requireApprovalForAgentActions).toBe(true);
  });

  it('other user approving or rejecting → 403 not_owner', async () => {
    const { agentComment, approve, reject } = setup();
    await agentComment();
    for (const r of [
      await approve('AR-0001', asUser('U-02')),
      await reject('AR-0001', 'no', asUser('U-02')),
    ]) {
      expect(r.status).toBe(403);
      expect(await json(r)).toMatchObject({ error: { code: 'not_owner' } });
    }
  });

  it('unknown request → 404; missing user → 400', async () => {
    const { req } = setup();
    expect((await req('POST', '/api/action-requests/AR-9999/approve', U1)).status).toBe(404);
    expect((await req('GET', '/api/action-requests/AR-9999', U1)).status).toBe(404);
    expect((await req('POST', '/api/action-requests/AR-0001/approve', {})).status).toBe(400);
  });
});

describe('listing and detail', () => {
  it('list filters by status, alertId and onBehalfOf; newest first', async () => {
    const { agentComment, agentAck, approve, req } = setup();
    await agentComment('ALT-1042', 'first');
    await agentComment('ALT-1047', 'second');
    await agentAck('ALT-1049');
    await approve('AR-0001');
    const all = await json(await req('GET', '/api/action-requests', U1));
    expect(all.map((r: any) => r.id)).toEqual(['AR-0003', 'AR-0002', 'AR-0001']);
    const pending = await json(await req('GET', '/api/action-requests?status=pending', U1));
    expect(pending.map((r: any) => r.id)).toEqual(['AR-0003', 'AR-0002']);
    const multi = await json(await req('GET', '/api/action-requests?status=pending,approved', U1));
    expect(multi).toHaveLength(3);
    const byAlert = await json(await req('GET', '/api/action-requests?alertId=ALT-1047', U1));
    expect(byAlert.map((r: any) => r.id)).toEqual(['AR-0002']);
    const none = await json(await req('GET', '/api/action-requests?onBehalfOf=U-02', U1));
    expect(none).toEqual([]);
    expect((await req('GET', '/api/action-requests?status=bogus', U1)).status).toBe(400);
  });

  it('detail includes the alert summary, and the resultEvent after approval', async () => {
    const { agentComment, approve, req } = setup();
    await agentComment();
    const pending = await json(await req('GET', '/api/action-requests/AR-0001', U1));
    expect(pending).toMatchObject({
      id: 'AR-0001',
      status: 'pending',
      alert: { id: 'ALT-1042', title: expect.any(String) },
    });
    expect(pending.resultEvent).toBeUndefined();
    await approve('AR-0001');
    const done = await json(await req('GET', '/api/action-requests/AR-0001', U1));
    expect(done.resultEvent).toMatchObject({ type: 'comment', approvedBy: 'U-01' });
  });

  it('alert detail pendingActionRequestIds reflects the queue', async () => {
    const { agentComment, agentAck, approve, req } = setup();
    await agentComment();
    await agentAck();
    const get = async () =>
      (await json(await req('GET', '/api/alerts/ALT-1042', U1))).pendingActionRequestIds;
    expect(await get()).toEqual(['AR-0001', 'AR-0002']);
    await approve('AR-0001');
    expect(await get()).toEqual(['AR-0002']);
  });

  it('agent can read the queue (for get_action_request)', async () => {
    const { agentComment, req } = setup();
    await agentComment();
    const r = await req('GET', '/api/action-requests/AR-0001', A1);
    expect(r.status).toBe(200);
  });
});

describe('settings', () => {
  it('GET returns the default; PUT by the owner updates it', async () => {
    const { req, store } = setup();
    expect(await json(await req('GET', '/api/users/U-01/settings', U1))).toEqual({
      requireApprovalForAgentActions: true,
    });
    const put = await req('PUT', '/api/users/U-01/settings', U1, {
      requireApprovalForAgentActions: false,
    });
    expect(put.status).toBe(200);
    expect(await json(put)).toEqual({ requireApprovalForAgentActions: false });
    expect(store.settingsFor('U-01').requireApprovalForAgentActions).toBe(false);
    expect(store.settingsFor('U-02').requireApprovalForAgentActions).toBe(true);
  });

  it('PUT for someone else → 403 not_owner; unknown user → 404; bad body → 400', async () => {
    const { req } = setup();
    const other = await req('PUT', '/api/users/U-02/settings', U1, {
      requireApprovalForAgentActions: false,
    });
    expect(other.status).toBe(403);
    expect(await json(other)).toMatchObject({ error: { code: 'not_owner' } });
    expect((await req('GET', '/api/users/U-99/settings', U1)).status).toBe(404);
    expect(
      (await req('PUT', '/api/users/U-01/settings', U1, { requireApprovalForAgentActions: 'yes' }))
        .status,
    ).toBe(400);
  });
});
