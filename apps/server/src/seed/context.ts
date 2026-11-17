import type { TimelineEvent } from '@app/domain';
import type { DistributiveOmit } from '../types.ts';

export const MIN = 60_000;
export const H = 60 * MIN;
export const D = 24 * H;

export class IdGen {
  private counters: Record<string, number> = {};
  next(prefix: 'EV' | 'LNK' | 'ATT'): string {
    const n = (this.counters[prefix] ?? 0) + 1;
    this.counters[prefix] = n;
    return `${prefix}-${String(n).padStart(prefix === 'EV' ? 5 : 4, '0')}`;
  }
}

export interface SeedCtx {
  now: Date;
  ids: IdGen;
  /** ISO timestamp `ms` before now. */
  ago(ms: number): string;
  /** ISO timestamp for the given UTC time of day, `days` days before now's date. */
  dayAt(days: number, hour: number, minute: number): string;
  event(e: DistributiveOmit<TimelineEvent, 'id'>): TimelineEvent;
}

export function makeCtx(now: Date): SeedCtx {
  const ids = new IdGen();
  return {
    now,
    ids,
    ago: (ms) => new Date(now.getTime() - ms).toISOString(),
    dayAt: (days, hour, minute) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - days);
      d.setUTCHours(hour, minute, 0, 0);
      return d.toISOString();
    },
    event: (e) => ({ id: ids.next('EV'), ...e }) as TimelineEvent,
  };
}

export interface SeedAttachment {
  meta: import('@app/domain').Attachment;
  bytes: Uint8Array;
}

export interface SeedPart {
  alerts: import('@app/domain').Alert[];
  timeline: TimelineEvent[];
  attachments: SeedAttachment[];
}
