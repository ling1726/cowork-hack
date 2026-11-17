import type { AlertListSearch } from '@app/domain';
import {
  Button,
  Dropdown,
  Option,
  Switch,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Dismiss12Regular } from '@fluentui/react-icons';
import { useCallback } from 'react';
import { useMeta, useUsers } from '../hooks.ts';
import { useUiStore } from '../store/ui-store.ts';
import { SearchBox } from './SearchBox.tsx';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  row: { display: 'flex', gap: tokens.spacingHorizontalM, flexWrap: 'wrap', alignItems: 'center' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    paddingLeft: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
});

type Option = { value: string; label: string };

function MultiFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: T[] | undefined;
  onChange: (next: T[]) => void;
}) {
  const chosen = selected ?? [];
  const text = chosen.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ');
  return (
    <Dropdown
      multiselect
      aria-label={label}
      placeholder={label}
      value={text}
      selectedOptions={chosen}
      onOptionSelect={(_e, d) => onChange(d.selectedOptions as T[])}
      style={{ minWidth: 150 }}
    >
      {options.map((o) => (
        <Option key={o.value} value={o.value}>
          {o.label}
        </Option>
      ))}
    </Dropdown>
  );
}

export interface FilterBarProps {
  search: AlertListSearch;
  /** Merges `patch` into the URL search params (and resets the page unless `page` is in the patch). */
  onChange: (patch: Partial<AlertListSearch>, opts?: { replace?: boolean }) => void;
  onClear: () => void;
}

export function FilterBar({ search, onChange, onClear }: FilterBarProps) {
  const styles = useStyles();
  const { data: meta } = useMeta();
  const { data: users = [] } = useUsers();
  const currentUserId = useUiStore((s) => s.currentUserId);

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
  const traderName = traders.find((t) => t.id === search.traderId)?.name;

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <SearchBox value={search.q ?? ''} onCommit={commitQuery} />
        <MultiFilter
          label="Status"
          options={meta?.statuses ?? []}
          selected={search.status}
          onChange={(status) => onChange({ status: status.length ? status : undefined })}
        />
        <MultiFilter
          label="Severity"
          options={meta?.severities ?? []}
          selected={search.severity}
          onChange={(severity) => onChange({ severity: severity.length ? severity : undefined })}
        />
        <MultiFilter
          label="Category"
          options={meta?.categories ?? []}
          selected={search.category}
          onChange={(category) => onChange({ category: category.length ? category : undefined })}
        />
        <MultiFilter
          label="Desk"
          options={meta?.desks ?? []}
          selected={search.desk}
          onChange={(desk) => onChange({ desk: desk.length ? desk : undefined })}
        />
        <Dropdown
          aria-label="Trader"
          placeholder="Trader"
          value={traderName ?? (search.traderId ? search.traderId : '')}
          selectedOptions={search.traderId ? [search.traderId] : []}
          onOptionSelect={(_e, d) => onChange({ traderId: d.optionValue || undefined })}
          style={{ minWidth: 170 }}
        >
          <Option value="">Any trader</Option>
          {traders.map((t) => (
            <Option key={t.id} value={t.id} text={t.name}>
              {t.name} ({t.id})
            </Option>
          ))}
        </Dropdown>
        <Switch
          label="Assigned to me"
          checked={search.assigneeId === currentUserId}
          onChange={(_e, d) => onChange({ assigneeId: d.checked ? currentUserId : undefined })}
        />
        <Button appearance="subtle" onClick={onClear}>
          Clear filters
        </Button>
      </div>
      {chips.length > 0 && (
        <div className={styles.row} aria-label="Active filters">
          {chips.map((chip) => (
            <span key={chip.label} className={styles.chip} data-testid="filter-chip">
              <Text size={200}>{chip.label}</Text>
              <Button
                size="small"
                appearance="transparent"
                icon={<Dismiss12Regular />}
                aria-label={`Remove filter ${chip.label}`}
                onClick={() => onChange(chip.clear)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
