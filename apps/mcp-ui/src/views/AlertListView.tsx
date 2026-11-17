import {
  Severity,
  type AlertListView as ListPayload,
  type AlertSort,
  type AlertSummary,
} from '@app/domain';
import { AlertTable, Button, Card } from '@app/ui';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useMemo, useState } from 'react';
import { viewOf, type ViewBridge } from '../bridge.ts';
import { HostLink, OpenButton } from './OpenButton.tsx';

type Item = AlertSummary & { url: string };
interface ListContent {
  items: Item[];
  total: number;
  listUrl?: string;
}

const rank = (s: AlertSummary['severity']) => Severity.options.indexOf(s);

function sortItems(items: Item[], sort: AlertSort | undefined): Item[] {
  if (!sort) return items;
  const desc = sort.startsWith('-');
  const field = sort.replace(/^-/, '') as 'severity' | 'createdAt' | 'updatedAt';
  const cmp = (a: Item, b: Item) =>
    field === 'severity' ? rank(a.severity) - rank(b.severity) : a[field].localeCompare(b[field]);
  return [...items].sort((a, b) => (desc ? -cmp(a, b) : cmp(a, b)));
}

/** `search_alerts` in Cowork: the app's alert table over the returned items. */
export function AlertListView({ result, bridge }: { result: CallToolResult; bridge: ViewBridge }) {
  const { items, total, listUrl } = result.structuredContent as unknown as ListContent;
  const users = viewOf<ListPayload>(result)?.users ?? [];
  const [sort, setSort] = useState<AlertSort>();
  const sorted = useMemo(() => sortItems(items, sort), [items, sort]);
  const urlOf = (id: string) => items.find((i) => i.id === id)?.url ?? '';

  const investigate = async (item: Item) => {
    const sent = await bridge.sendMessage(`Investigate ${item.id}`);
    if (!sent) await bridge.openLink(item.url);
  };

  return (
    <Card className="gap-0 overflow-hidden py-0" data-testid="alert-list-view">
      <AlertTable
        items={sorted}
        users={users}
        {...(sort ? { sort } : {})}
        onSortChange={setSort}
        renderAlertLink={(id, label) => (
          <HostLink href={urlOf(id)} label={label} onOpen={() => void bridge.openLink(urlOf(id))} />
        )}
        renderRowAction={(alert) => (
          <Button size="sm" variant="outline" onClick={() => void investigate(alert as Item)}>
            Investigate
          </Button>
        )}
      />
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
        <span>
          Showing {items.length} of {total}
        </span>
        {listUrl && <OpenButton label="Open in app" onOpen={() => void bridge.openLink(listUrl)} />}
      </div>
    </Card>
  );
}
