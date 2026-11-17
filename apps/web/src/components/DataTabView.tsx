import type { DataTab } from '@app/domain';
import { DataTabTable, Tabs, TabsList, TabsTrigger } from '@app/ui';

export interface DataTabViewProps {
  tabs: DataTab[];
  /** The selected tab id from the URL; unknown or missing ids fall back to the first tab. */
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function DataTabView({ tabs, selectedId, onSelect }: DataTabViewProps) {
  const selected = tabs.find((t) => t.id === selectedId) ?? tabs[0];
  if (!selected)
    return <p className="text-sm text-muted-foreground">This alert has no data tabs.</p>;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Tabs value={selected.id} onValueChange={(value) => onSelect(String(value))}>
        <TabsList aria-label="Data tabs">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTabTable tab={selected} />
    </div>
  );
}
