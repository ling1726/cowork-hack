import { describe, expect, it } from 'vitest';
import {
  ActionRequestSchema,
  AlertSchema,
  AssigneesBody,
  DECISION_SURFACE_LABELS,
  DecisionSurface,
  LinkBody,
  TimelineEventSchema,
} from '../src/index.ts';
import { fixtureAlert } from './fixtures.ts';

describe('schemas', () => {
  it('AlertSchema parses a minimal valid alert and rejects bad status', () => {
    expect(AlertSchema.parse(fixtureAlert()).id).toBe('ALT-1042');
    expect(() => AlertSchema.parse({ ...fixtureAlert(), status: 'done' })).toThrow();
  });
  it('TimelineEventSchema discriminates on type', () => {
    const e = TimelineEventSchema.parse({
      id: 'EV-00001',
      alertId: 'ALT-1042',
      at: '2026-11-17T09:00:00.000Z',
      actorId: 'U-01',
      via: 'claude',
      type: 'comment',
      body: 'x',
    });
    expect(e.type === 'comment' && e.body).toBe('x');
  });
  it('AssigneesBody rejects identical primary and backup', () => {
    expect(AssigneesBody.safeParse({ primaryId: 'U-01', backupId: 'U-01' }).success).toBe(false);
  });
  it('LinkBody rejects non-http urls', () => {
    expect(LinkBody.safeParse({ title: 'x', url: 'javascript:alert(1)' }).success).toBe(false);
  });
});

describe('decidedIn', () => {
  const request = {
    id: 'AR-0001',
    alertId: 'ALT-1042',
    onBehalfOf: 'U-01',
    via: 'claude',
    rationale: 'why',
    status: 'approved',
    createdAt: '2026-11-17T09:00:00.000Z',
    kind: 'acknowledge',
    payload: {},
  };
  it('ActionRequestSchema keeps decidedIn cowork', () => {
    const r = ActionRequestSchema.parse({ ...request, decidedIn: 'cowork' });
    expect(r.decidedIn).toBe('cowork');
  });
  it('ActionRequestSchema still parses requests without decidedIn', () => {
    expect(ActionRequestSchema.parse(request).decidedIn).toBeUndefined();
  });
  it('ActionRequestSchema rejects an unknown surface', () => {
    expect(ActionRequestSchema.safeParse({ ...request, decidedIn: 'slack' }).success).toBe(false);
  });
  it('TimelineEventSchema keeps decidedIn on action_rejected', () => {
    const e = TimelineEventSchema.parse({
      id: 'EV-00002',
      alertId: 'ALT-1042',
      at: '2026-11-17T09:00:00.000Z',
      actorId: 'U-01',
      via: 'app',
      type: 'action_rejected',
      requestId: 'AR-0001',
      decidedIn: 'cowork',
    });
    expect(e.decidedIn).toBe('cowork');
  });
  it('DECISION_SURFACE_LABELS reads naturally after a name', () => {
    expect(DECISION_SURFACE_LABELS.cowork).toBe('in Cowork');
    expect(DECISION_SURFACE_LABELS.app).toBe('in the app');
    expect(DecisionSurface.options).toEqual(['app', 'cowork']);
  });
});
