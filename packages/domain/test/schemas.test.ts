import { describe, expect, it } from 'vitest';
import { AlertSchema, AssigneesBody, LinkBody, TimelineEventSchema } from '../src/index.ts';
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
