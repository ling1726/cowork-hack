import type { AlertListSearch } from '@app/domain';
import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@app/ui';
import { RotateCcw, X } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useMeta, useUsers } from '../../hooks.ts';
import { useUiStore } from '../../store/ui-store.ts';
import { SearchBox } from '../SearchBox.tsx';
import { FacetedFilter } from './FacetedFilter.tsx';

const ANY_TRADER = '__any__';

export interface ListToolbarProps {
  search: AlertListSearch;
  onChange: (patch: Partial<AlertListSearch>, opts?: { replace?: boolean }) => void;
  onClear: () => void;
}

const FACETS = [
  { key: 'status', label: 'Status', meta: 'statuses' },
  { key: 'severity', label: 'Severity', meta: 'severities' },
  { key: 'category', label: 'Category', meta: 'categories' },
  { key: 'desk', label: 'Desk', meta: 'desks' },
] as const;

export function ListToolbar({ search, onChange, onClear }: ListToolbarProps) {
  const { data: meta } = useMeta();
  const { data: users = [] } = useUsers();
  const currentUserId = useUiStore((s) => s.currentUserId);
  const mineId = useId();

  const commitQuery = useCallback(
    (q: string) => onChange({ q: q.trim() || undefined }, { replace: true }),
    [onChange],
  );

  const chips: Array<{ label: string; clear: Partial<AlertListSearch> }> = [];
  if (search.instrument)
    chips.push({ label: `Instrument: ${search.instrument}`, clear: { instrument: undefined } });
  if (search.from) chips.push({ label: `From: ${search.from}`, clear: { from: undefined } });
  if (search.to) chips.push({ label: `To: ${search.to}`, clear: { to: undefined } });
  if (search.assigneeId && search.assigneeId !== currentUserId) {
    const name = users.find((u) => u.id === search.assigneeId)?.name ?? search.assigneeId;
    chips.push({ label: `Assignee: ${name}`, clear: { assigneeId: undefined } });
  }

  const traders = meta?.traders ?? [];
  const traderItems = [
    { value: ANY_TRADER, label: 'Any trader' },
    ...traders.map((t) => ({ value: t.id, label: t.name })),
  ];
  const filtered = Object.entries(search).some(
    ([k, v]) => k !== 'sort' && k !== 'page' && v !== undefined,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search.q ?? ''} onCommit={commitQuery} />
        {FACETS.map((f) => (
          <FacetedFilter
            key={f.key}
            label={f.label}
            options={meta?.[f.meta] ?? []}
            selected={search[f.key] ?? []}
            onChange={(next) =>
              onChange({ [f.key]: next.length ? next : undefined } as Partial<AlertListSearch>)
            }
          />
        ))}
        <Select
          items={traderItems}
          value={search.traderId ?? ANY_TRADER}
          onValueChange={(v) =>
            onChange({ traderId: !v || v === ANY_TRADER ? undefined : String(v) })
          }
        >
          <SelectTrigger size="sm" aria-label="Trader" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_TRADER}>Any trader</SelectItem>
            {traders.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} <span className="text-muted-foreground">({t.id})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-1">
          <Switch
            id={mineId}
            aria-label="Assigned to me"
            checked={search.assigneeId === currentUserId}
            onCheckedChange={(checked) =>
              onChange({ assigneeId: checked ? currentUserId : undefined })
            }
          />
          <Label htmlFor={mineId} className="font-normal whitespace-nowrap">
            Assigned to me
          </Label>
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <RotateCcw />
            Reset
          </Button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((chip) => (
            <Badge
              key={chip.label}
              variant="secondary"
              className="h-6 gap-1 pr-0.5 pl-2"
              data-testid="filter-chip"
            >
              {chip.label}
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5 rounded-full"
                aria-label={`Remove filter ${chip.label}`}
                onClick={() => onChange(chip.clear)}
              >
                <X />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
