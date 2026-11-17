import type {
  ActionRequest,
  Alert,
  Attachment,
  TimelineEvent,
  User,
  UserSettings,
} from '@app/domain';
import type { SeedData } from '../seed/index.ts';
import type { DistributiveOmit } from '../types.ts';
import { AlertSearchIndex } from './search.ts';

export type IdPrefix = 'EV' | 'AR' | 'LNK' | 'ATT';
const WIDTH: Record<IdPrefix, number> = { EV: 5, AR: 4, LNK: 4, ATT: 4 };

export interface StoredAttachment {
  meta: Attachment;
  bytes: Uint8Array;
}

export class Store {
  users = new Map<string, User>();
  alerts = new Map<string, Alert>();
  /** alertId → events, oldest first */
  timeline = new Map<string, TimelineEvent[]>();
  attachments = new Map<string, StoredAttachment>();
  actionRequests = new Map<string, ActionRequest>();
  settings = new Map<string, UserSettings>();
  readonly search = new AlertSearchIndex();

  private counters: Record<IdPrefix, number> = { EV: 0, AR: 0, LNK: 0, ATT: 0 };

  constructor(
    seed: SeedData,
    readonly now: () => Date,
  ) {
    this.reset(seed);
  }

  reset(seed: SeedData): void {
    this.users = new Map(seed.users.map((u) => [u.id, u]));
    this.alerts = new Map(seed.alerts.map((a) => [a.id, a]));
    this.timeline = new Map();
    for (const e of seed.timeline) {
      const list = this.timeline.get(e.alertId) ?? [];
      list.push(e);
      this.timeline.set(e.alertId, list);
    }
    for (const list of this.timeline.values()) {
      list.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    }
    this.attachments = new Map(seed.attachments.map((a) => [a.meta.id, a]));
    this.actionRequests = new Map();
    this.settings = new Map();

    this.counters = { EV: 0, AR: 0, LNK: 0, ATT: 0 };
    const bump = (prefix: IdPrefix, id: string) => {
      const n = Number(id.slice(prefix.length + 1));
      if (Number.isFinite(n)) this.counters[prefix] = Math.max(this.counters[prefix], n);
    };
    for (const e of seed.timeline) bump('EV', e.id);
    for (const a of seed.alerts) for (const l of a.links) bump('LNK', l.id);
    for (const a of seed.attachments) bump('ATT', a.meta.id);

    this.search.clear();
    for (const alert of this.alerts.values()) this.reindex(alert);
  }

  nextId(prefix: IdPrefix): string {
    this.counters[prefix] += 1;
    return `${prefix}-${String(this.counters[prefix]).padStart(WIDTH[prefix], '0')}`;
  }

  getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  /** Stores the alert, bumps `updatedAt` to now and refreshes the search index. */
  saveAlert(alert: Alert): Alert {
    const saved = { ...alert, updatedAt: this.now().toISOString() };
    this.alerts.set(saved.id, saved);
    this.reindex(saved);
    return saved;
  }

  appendEvent(e: DistributiveOmit<TimelineEvent, 'id' | 'at'>): TimelineEvent {
    const event = { ...e, id: this.nextId('EV'), at: this.now().toISOString() } as TimelineEvent;
    const list = this.timeline.get(event.alertId) ?? [];
    list.push(event);
    this.timeline.set(event.alertId, list);
    const alert = this.alerts.get(event.alertId);
    if (alert && event.type === 'comment') this.reindex(alert);
    return event;
  }

  eventsFor(alertId: string): TimelineEvent[] {
    return this.timeline.get(alertId) ?? [];
  }

  settingsFor(userId: string): UserSettings {
    return this.settings.get(userId) ?? { requireApprovalForAgentActions: true };
  }

  private reindex(alert: Alert): void {
    const comments = this.eventsFor(alert.id).flatMap((e) =>
      e.type === 'comment' ? [e.body] : [],
    );
    this.search.upsert(alert, comments);
  }
}
