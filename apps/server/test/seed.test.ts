import {
  ActionRequestSchema,
  AlertSchema,
  TimelineEventSchema,
  UserSchema,
  type Alert,
  type TimelineEvent,
} from '@app/domain';
import { describe, expect, it } from 'vitest';
import { buildSeed } from '../src/seed/index.ts';
import { T0 } from './helpers.ts';

const s = buildSeed({ now: T0, seed: 1042 });
const alert = (id: string): Alert => {
  const a = s.alerts.find((x) => x.id === id);
  if (!a) throw new Error(`missing ${id}`);
  return a;
};
const isBackground = (id: string) => /^ALT-09[0-4]\d$/.test(id) && id !== 'ALT-0911';
const H = 3_600_000;
const D = 24 * H;
const ago = (ms: number) => new Date(T0.getTime() - ms);
const eventsOf = (id: string): TimelineEvent[] => s.timeline.filter((e) => e.alertId === id);
void ActionRequestSchema;

describe('seed', () => {
  it('is deterministic', () => {
    expect(buildSeed({ now: T0, seed: 1042 })).toEqual(s);
  });

  it('differs for a different seed (faker is wired to the seed)', () => {
    const other = buildSeed({ now: T0, seed: 7 });
    expect(other.alerts.map((a) => a.title)).not.toEqual(s.alerts.map((a) => a.title));
  });

  it('every alert, event and user parses with domain schemas', () => {
    for (const a of s.alerts) AlertSchema.parse(a);
    for (const e of s.timeline) TimelineEventSchema.parse(e);
    for (const u of s.users) UserSchema.parse(u);
  });

  it('has unique ids', () => {
    expect(new Set(s.alerts.map((a) => a.id)).size).toBe(s.alerts.length);
    expect(new Set(s.timeline.map((e) => e.id)).size).toBe(s.timeline.length);
  });

  it('has 6 users covering all 4 roles', () => {
    expect(s.users).toHaveLength(6);
    expect(new Set(s.users.map((u) => u.role))).toEqual(
      new Set(['analyst', 'senior_analyst', 'compliance_lead', 'cco']),
    );
    expect(s.users[0]).toMatchObject({ id: 'U-01', name: 'Priya Shah', role: 'analyst' });
  });

  it('has ~45 background alerts from ALT-0900 upward, skipping story ids', () => {
    const background = s.alerts.filter((a) => isBackground(a.id));
    expect(background).toHaveLength(45);
    expect(background.map((a) => a.id)).not.toContain('ALT-0911');
    expect(background[0]?.id).toBe('ALT-0900');
    expect(background.at(-1)?.id).toBe('ALT-0945'); // 0900..0945 minus story id ALT-0911
    expect(s.alerts).toHaveLength(55);
  });

  it('ALT-1042 is open, high, eu-equities, T-0412, meets exactly 2 of 3 indicators via highlights', () => {
    const a = alert('ALT-1042');
    expect(a).toMatchObject({
      status: 'open',
      severity: 'high',
      desk: 'eu-equities',
      category: 'spoofing_layering',
      trader: { id: 'T-0412', name: 'James Whitfield' },
      instrument: { symbol: 'SAP GY' },
      assignees: { primaryId: 'U-01', backupId: 'U-03' },
    });
    expect(a.description.toLowerCase()).toContain('layering');
    expect(a.rule.indicators.map((i) => i.id)).toEqual(['otr', 'fast_cancel', 'book_imbalance']);
    const byLabel = Object.fromEntries(a.highlights.map((h) => [h.label, h]));
    expect(byLabel['Order-to-trade ratio']).toMatchObject({ value: '34:1', tone: 'danger' });
    expect(byLabel['Fast cancels']).toMatchObject({ value: '72%', tone: 'danger' });
    expect(byLabel['Book imbalance']).toMatchObject({ value: '64%', tone: 'neutral' });
    expect(byLabel.Notional).toMatchObject({ value: '€18.4m' });
    expect(a.links).toHaveLength(1);
    expect(a.attachments.map((x) => x.filename)).toEqual(['order-blotter.csv']);
    expect(new Date(a.createdAt).getTime()).toBe(T0.getTime() - 2 * H);
  });

  it('ALT-1042 orders data tab backs up the highlights (34:1 and 72%)', () => {
    const a = alert('ALT-1042');
    const orders = a.dataTabs.find((t) => t.id === 'orders');
    const executions = a.dataTabs.find((t) => t.id === 'executions');
    if (!orders || !executions) throw new Error('missing tabs');
    expect(orders.columns.map((c) => c.key)).toEqual([
      'time',
      'side',
      'price',
      'qty',
      'status',
      'cancelLatencyMs',
    ]);
    expect(orders.rows.length).toBeGreaterThanOrEqual(12);
    const cancelled = orders.rows.filter((r) => r.status === 'cancelled');
    const fast = cancelled.filter((r) => Number(r.cancelLatencyMs) < 500);
    expect(Math.round((fast.length / orders.rows.length) * 100)).toBe(72);
    expect(Math.round(orders.rows.length / executions.rows.length)).toBe(34);
  });

  it('T-0412 has exactly 4 alerts within 49 days across 2 rules, 2 closed false_positive by different users', () => {
    const t = s.alerts.filter((a) => a.trader.id === 'T-0412');
    expect(t.map((a) => a.id).sort()).toEqual(['ALT-0911', 'ALT-0958', 'ALT-1013', 'ALT-1042']);
    expect(new Set(t.map((a) => a.rule.id)).size).toBe(2);
    for (const a of t)
      expect(T0.getTime() - new Date(a.createdAt).getTime()).toBeLessThanOrEqual(49 * D);
    const closed = t.filter((a) => a.status === 'closed');
    expect(closed.map((a) => a.resolution?.outcome)).toEqual(['false_positive', 'false_positive']);
    expect(new Set(closed.map((a) => a.resolution?.closedBy)).size).toBe(2);
    expect(alert('ALT-0911').resolution?.closedBy).toBe('U-02');
    expect(alert('ALT-0958').resolution?.closedBy).toBe('U-06');
    expect(alert('ALT-0958').rule.id).toBe('MAR-12-1b');
    expect(alert('ALT-1013')).toMatchObject({
      status: 'in_progress',
      category: 'wash_trade',
      assignees: { primaryId: 'U-01', backupId: 'U-02' },
    });
    expect(new Date(alert('ALT-0911').createdAt).getTime()).toBe(T0.getTime() - 49 * D);
  });

  it('each closure has a closing comment', () => {
    for (const id of ['ALT-0911', 'ALT-0958', 'ALT-0987']) {
      const comments = eventsOf(id).filter((e) => e.type === 'comment');
      expect(comments.length, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('ALT-0987 closed with the benign note; ALT-1051 trade precedes restricted list entry', () => {
    const a = alert('ALT-0987');
    expect(a).toMatchObject({
      status: 'closed',
      category: 'restricted_list',
      rule: { id: 'RL-01' },
      instrument: { symbol: 'NVLX', name: 'Novalux Pharma' },
      trader: { id: 'T-0733', name: 'Elena Rossi' },
    });
    expect(a.resolution).toMatchObject({
      closedBy: 'U-03',
      note: 'Name added to restricted list after trade; timing benign',
    });
    expect(a.description).toContain('Project Kestrel');
    expect(T0.getTime() - new Date(a.resolution?.closedAt ?? '').getTime()).toBe(21 * D);

    const b = alert('ALT-1051');
    expect(b).toMatchObject({ status: 'open', severity: 'high', instrument: { symbol: 'NVLX' } });
    expect(b.description).toContain('Project Kestrel');
    expect(T0.getTime() - new Date(b.createdAt).getTime()).toBe(1 * H);
    const trade = b.dataTabs.find((t) => t.id === 'trades')?.rows[0];
    const entry = b.dataTabs.find((t) => t.id === 'restrictedListEntry')?.rows[0];
    expect(new Date(String(trade?.time)).getTime()).toBeLessThan(
      new Date(String(entry?.time)).getTime(),
    );
    expect(String(trade?.time)).toMatch(/T14:05:00\.000Z$/);
    expect(String(entry?.time)).toMatch(/T16:30:00\.000Z$/);
    expect(Math.round((T0.getTime() - new Date(String(trade?.time)).getTime()) / D)).toBe(22);
  });

  it('W1: exactly 3 open/high/eu-equities alerts; exactly 2 mention "layering"', () => {
    const set = s.alerts.filter(
      (a) => a.status === 'open' && a.severity === 'high' && a.desk === 'eu-equities',
    );
    expect(set.map((a) => a.id).sort()).toEqual(['ALT-1042', 'ALT-1047', 'ALT-1049']);
    const mentions = (a: Alert) =>
      `${a.title} ${a.summary} ${a.description}`.toLowerCase().includes('layering');
    expect(
      set
        .filter(mentions)
        .map((a) => a.id)
        .sort(),
    ).toEqual(['ALT-1042', 'ALT-1047']);
    expect(alert('ALT-1049').category).toBe('marking_the_close');
  });

  it('background alerts never mention "layering" in their text', () => {
    const story = new Set([
      'ALT-0911',
      'ALT-0958',
      'ALT-0987',
      'ALT-1013',
      'ALT-1029',
      'ALT-1033',
      'ALT-1042',
      'ALT-1047',
      'ALT-1049',
      'ALT-1051',
    ]);
    for (const a of s.alerts.filter((x) => !story.has(x.id))) {
      expect(`${a.title} ${a.summary} ${a.description}`.toLowerCase(), a.id).not.toContain(
        'layering',
      );
    }
  });

  it('background alerts cover all categories, desks and statuses', () => {
    const bg = s.alerts.filter((a) => isBackground(a.id));
    expect(new Set(bg.map((a) => a.category)).size).toBe(8);
    expect(new Set(bg.map((a) => a.desk)).size).toBe(6);
    expect(new Set(bg.map((a) => a.status)).size).toBe(3);
  });

  it('W5: U-01 has exactly 3 timeline events after now−24h', () => {
    const mine = s.timeline.filter(
      (e) => e.actorId === 'U-01' && new Date(e.at).getTime() > T0.getTime() - D,
    );
    expect(mine.map((e) => [e.alertId, e.type, T0.getTime() - new Date(e.at).getTime()])).toEqual(
      expect.arrayContaining([
        ['ALT-1013', 'comment', 3 * H],
        ['ALT-1033', 'status_changed', 2 * H],
        ['ALT-1029', 'status_changed', 1 * H],
      ]),
    );
    expect(mine).toHaveLength(3);
    expect(alert('ALT-1033')).toMatchObject({ category: 'best_execution', status: 'in_progress' });
    expect(alert('ALT-1029')).toMatchObject({ category: 'late_reporting', status: 'closed' });
    expect(alert('ALT-1029').resolution).toMatchObject({
      outcome: 'false_positive',
      closedBy: 'U-01',
    });
  });

  it('every timestamp is <= now and alerts are consistent with their timelines', () => {
    for (const e of s.timeline)
      expect(new Date(e.at).getTime(), e.id).toBeLessThanOrEqual(T0.getTime());
    for (const a of s.alerts) {
      expect(new Date(a.createdAt).getTime(), a.id).toBeLessThanOrEqual(T0.getTime());
      expect(new Date(a.updatedAt).getTime(), a.id).toBeLessThanOrEqual(T0.getTime());
      const last = eventsOf(a.id)
        .map((e) => new Date(e.at).getTime())
        .sort((x, y) => y - x)[0];
      expect(new Date(a.updatedAt).getTime(), a.id).toBe(last);
      expect(eventsOf(a.id)[0]?.type, a.id).toBe('created');
    }
    expect(ago(0).getTime()).toBe(T0.getTime());
  });

  it('attachments have bytes whose size matches the metadata', () => {
    const blotter = s.attachments.find((x) => x.meta.filename === 'order-blotter.csv');
    expect(blotter?.bytes.length).toBe(blotter?.meta.sizeBytes);
    expect(new TextDecoder().decode(blotter?.bytes).split('\n')[0]).toBe(
      'time,side,price,qty,status,cancelLatencyMs',
    );
    const pdf = s.attachments.find((x) => x.meta.mimeType === 'application/pdf');
    expect(new TextDecoder().decode(pdf?.bytes.slice(0, 8))).toBe('%PDF-1.4');
  });
});
