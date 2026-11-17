import {
  SEVERITY_RANK,
  type Alert,
  type AlertListQuery,
  type AlertSort,
  type AlertSummary,
  type Resolution,
} from '@app/domain';
import type { Store } from '../store/store.ts';

export function toSummary(a: Alert): AlertSummary {
  return {
    id: a.id,
    title: a.title,
    status: a.status,
    severity: a.severity,
    category: a.category,
    desk: a.desk,
    trader: a.trader,
    instrument: a.instrument,
    rule: { id: a.rule.id, name: a.rule.name },
    assignees: a.assignees,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

const startOfDay = (d: string) => `${d}T00:00:00.000Z`;
const endOfDay = (d: string) => `${d}T23:59:59.999Z`;

function isAssignee(a: Alert, userId: string): boolean {
  return (
    a.assignees.primaryId === userId ||
    a.assignees.backupId === userId ||
    a.assignees.escalatedTo.some((e) => e.userId === userId)
  );
}

function compare(sort: AlertSort | 'relevance', scores: Map<string, number>) {
  return (a: Alert, b: Alert): number => {
    let c = 0;
    switch (sort) {
      case 'relevance':
        c = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
        break;
      case 'createdAt':
        c = a.createdAt.localeCompare(b.createdAt);
        break;
      case '-createdAt':
        c = b.createdAt.localeCompare(a.createdAt);
        break;
      case 'updatedAt':
        c = a.updatedAt.localeCompare(b.updatedAt);
        break;
      case '-updatedAt':
        c = b.updatedAt.localeCompare(a.updatedAt);
        break;
      case 'severity':
        c = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        break;
      case '-severity':
        c = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        break;
    }
    // Stable, total order: newest first, then id.
    return c || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  };
}

export function queryAlerts(store: Store, query: AlertListQuery) {
  const scores = query.q ? store.search.search(query.q) : undefined;
  const actors = (alertId: string) =>
    new Set(
      store.eventsFor(alertId).flatMap((e) => [e.actorId, ...(e.approvedBy ? [e.approvedBy] : [])]),
    );

  const matches = [...store.alerts.values()].filter((a) => {
    if (query.status && !query.status.includes(a.status)) return false;
    if (query.severity && !query.severity.includes(a.severity)) return false;
    if (query.category && !query.category.includes(a.category)) return false;
    if (query.desk && !query.desk.includes(a.desk)) return false;
    if (query.assigneeId && !isAssignee(a, query.assigneeId)) return false;
    if (query.traderId && a.trader.id !== query.traderId) return false;
    if (query.instrument && a.instrument.symbol.toLowerCase() !== query.instrument.toLowerCase()) {
      return false;
    }
    if (query.from && a.createdAt < startOfDay(query.from)) return false;
    if (query.to && a.createdAt > endOfDay(query.to)) return false;
    if (query.updatedFrom && a.updatedAt < query.updatedFrom) return false;
    if (query.updatedTo && a.updatedAt > query.updatedTo) return false;
    if (
      query.involvedUserId &&
      !isAssignee(a, query.involvedUserId) &&
      !actors(a.id).has(query.involvedUserId)
    ) {
      return false;
    }
    if (scores && !scores.has(a.id)) return false;
    return true;
  });

  const sort = query.sort ?? (scores ? 'relevance' : '-createdAt');
  matches.sort(compare(sort, scores ?? new Map()));

  const page = query.page ?? 1;
  const start = (page - 1) * query.pageSize;
  return {
    items: matches.slice(start, start + query.pageSize).map(toSummary),
    total: matches.length,
    page,
    pageSize: query.pageSize,
  };
}

export type MatchedOn = 'trader' | 'instrument' | 'rule';

export function relatedAlerts(
  store: Store,
  alert: Alert,
  days: number,
): Array<{ alert: AlertSummary; matchedOn: MatchedOn[]; resolution?: Resolution }> {
  const since = new Date(store.now().getTime() - days * 24 * 3_600_000).toISOString();
  const out: Array<{ alert: Alert; matchedOn: MatchedOn[] }> = [];
  for (const other of store.alerts.values()) {
    if (other.id === alert.id || other.createdAt < since) continue;
    const matchedOn: MatchedOn[] = [];
    if (other.trader.id === alert.trader.id) matchedOn.push('trader');
    if (other.instrument.symbol === alert.instrument.symbol) matchedOn.push('instrument');
    if (other.rule.id === alert.rule.id) matchedOn.push('rule');
    if (matchedOn.length > 0) out.push({ alert: other, matchedOn });
  }
  out.sort(
    (a, b) =>
      b.alert.createdAt.localeCompare(a.alert.createdAt) || a.alert.id.localeCompare(b.alert.id),
  );
  return out.map(({ alert: other, matchedOn }) => ({
    alert: toSummary(other),
    matchedOn,
    ...(other.resolution ? { resolution: other.resolution } : {}),
  }));
}
