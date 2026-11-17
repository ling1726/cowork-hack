import { describe, expect, it } from 'vitest';
import { buildSeed } from '../src/seed/index.ts';
import { Store } from '../src/store/store.ts';
import { T0 } from './helpers.ts';

const seed = () => buildSeed({ now: T0, seed: 1042 });
const makeStore = (now = T0) => new Store(seed(), () => now);

describe('Store', () => {
  it('continues id sequences after the seed', () => {
    const store = makeStore();
    const maxEv = Math.max(...seed().timeline.map((e) => Number(e.id.slice(3))));
    expect(store.nextId('EV')).toBe(`EV-${String(maxEv + 1).padStart(5, '0')}`);
    expect(store.nextId('AR')).toBe('AR-0001');
    expect(store.nextId('AR')).toBe('AR-0002');
    expect(store.nextId('ATT')).toBe('ATT-0003'); // ATT-0001 and ATT-0002 are seeded
    expect(store.nextId('LNK')).toBe('LNK-0002'); // LNK-0001 is seeded
  });

  it('appendEvent stamps id and now, and keeps the timeline ordered', () => {
    const now = new Date(T0.getTime() + 60_000);
    const store = makeStore(now);
    const before = store.eventsFor('ALT-1042').length;
    const e = store.appendEvent({
      type: 'comment',
      alertId: 'ALT-1042',
      actorId: 'U-01',
      via: 'app',
      body: 'hello',
    });
    expect(e.at).toBe(now.toISOString());
    expect(store.eventsFor('ALT-1042')).toHaveLength(before + 1);
    expect(store.eventsFor('ALT-1042').at(-1)).toEqual(e);
  });

  it('saveAlert bumps updatedAt to now', () => {
    const now = new Date(T0.getTime() + 5 * 60_000);
    const store = makeStore(now);
    const alert = store.getAlert('ALT-1042');
    if (!alert) throw new Error('missing');
    expect(store.saveAlert({ ...alert, severity: 'critical' }).updatedAt).toBe(now.toISOString());
    expect(store.getAlert('ALT-1042')?.severity).toBe('critical');
  });

  it('a new comment becomes searchable', () => {
    const store = makeStore();
    expect(store.search.search('zebrafish').size).toBe(0);
    store.appendEvent({
      type: 'comment',
      alertId: 'ALT-1042',
      actorId: 'U-01',
      via: 'app',
      body: 'zebrafish pattern noted',
    });
    expect([...store.search.search('zebrafish').keys()]).toEqual(['ALT-1042']);
  });

  it('settings default to requiring approval', () => {
    expect(makeStore().settingsFor('U-01')).toEqual({ requireApprovalForAgentActions: true });
  });

  it('reset restores the seed and the id counters', () => {
    const store = makeStore();
    store.appendEvent({
      type: 'comment',
      alertId: 'ALT-1042',
      actorId: 'U-01',
      via: 'app',
      body: 'x',
    });
    store.actionRequests.set('AR-0001', {} as never);
    store.reset(seed());
    expect(store.eventsFor('ALT-1042')).toHaveLength(3);
    expect(store.actionRequests.size).toBe(0);
    expect(store.nextId('AR')).toBe('AR-0001');
  });
});

describe('AlertSearchIndex', () => {
  const store = makeStore();
  it('matches prefixes and fuzzy terms', () => {
    expect(store.search.search('layer').has('ALT-1042')).toBe(true);
    expect(store.search.search('layerng').has('ALT-1042')).toBe(true);
  });
  it('finds comment bodies', () => {
    expect([...store.search.search('benign').keys()]).toEqual(['ALT-0987']);
  });
  it.each(['', '   ', '"', '(', '*', '🙂', 'x'.repeat(500)])('never throws for %j', (q) => {
    expect(() => store.search.search(q)).not.toThrow();
  });
});
