import type { Alert } from '@app/domain';
import MiniSearch from 'minisearch';

interface SearchDoc {
  id: string;
  title: string;
  summary: string;
  description: string;
  traderName: string;
  instrument: string;
  ruleName: string;
  comments: string;
}

export class AlertSearchIndex {
  private index = new MiniSearch<SearchDoc>({
    fields: ['title', 'summary', 'description', 'traderName', 'instrument', 'ruleName', 'comments'],
    idField: 'id',
    searchOptions: { prefix: true, fuzzy: 0.2, combineWith: 'AND' },
  });

  upsert(alert: Alert, comments: string[]): void {
    const doc: SearchDoc = {
      id: alert.id,
      title: alert.title,
      summary: alert.summary,
      description: alert.description,
      traderName: alert.trader.name,
      instrument: `${alert.instrument.symbol} ${alert.instrument.name}`,
      ruleName: alert.rule.name,
      comments: comments.join('\n'),
    };
    if (this.index.has(alert.id)) this.index.replace(doc);
    else this.index.add(doc);
  }

  /** Plain-term search; query-syntax characters are just text and can't throw. */
  search(q: string): Map<string, number> {
    const results = this.index.search(q);
    return new Map(results.map((r) => [r.id, r.score]));
  }

  clear(): void {
    this.index.removeAll();
  }
}
