import {
  Badge,
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@app/ui';
import { CirclePlus } from 'lucide-react';
import { useState } from 'react';

export interface FacetedFilterProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}

/** Multi-value filter: a dashed button that lists the chosen values, with a checkbox popover. */
export function FacetedFilter({ label, options, selected, onChange }: FacetedFilterProps) {
  const [query, setQuery] = useState('');
  const chosen = options.filter((o) => selected.includes(o.value));
  const visible = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (value: string, on: boolean) =>
    onChange(on ? [...selected, value] : selected.filter((v) => v !== value));

  return (
    <Popover onOpenChange={(open) => !open && setQuery('')}>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="border-dashed" />}
        aria-label={`${label} filter${chosen.length ? `: ${chosen.map((o) => o.label).join(', ')}` : ''}`}
      >
        <CirclePlus />
        {label}
        {chosen.length > 0 && (
          <>
            <Separator
              orientation="vertical"
              className="mx-0.5 data-vertical:h-4 data-vertical:self-center"
            />
            {chosen.length > 2 ? (
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {chosen.length} selected
              </Badge>
            ) : (
              chosen.map((o) => (
                <Badge key={o.value} variant="secondary" className="rounded-sm px-1 font-normal">
                  {o.label}
                </Badge>
              ))
            )}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-0 p-0">
        <div className="border-b p-1.5">
          <Input
            aria-label={`Filter ${label} options`}
            placeholder={`Filter ${label.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-7 border-none bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <ul className="flex max-h-64 flex-col overflow-y-auto p-1">
          {visible.map((o) => {
            const on = selected.includes(o.value);
            return (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <Checkbox
                    aria-label={o.label}
                    checked={on}
                    onCheckedChange={(checked) => toggle(o.value, checked)}
                  />
                  {o.label}
                </label>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-2 py-4 text-center text-sm text-muted-foreground">No matches</li>
          )}
        </ul>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
              Clear {label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
