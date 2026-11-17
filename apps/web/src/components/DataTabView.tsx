import type { DataTab } from '@app/domain';
import { DataTabTable } from '@app/ui';
import { Tab, TabList, Text } from '@fluentui/react-components';

export interface DataTabViewProps {
  tabs: DataTab[];
  /** The selected tab id from the URL; unknown or missing ids fall back to the first tab. */
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function DataTabView({ tabs, selectedId, onSelect }: DataTabViewProps) {
  const selected = tabs.find((t) => t.id === selectedId) ?? tabs[0];
  if (!selected) return <Text>This alert has no data tabs.</Text>;
  return (
    <div>
      <TabList
        size="small"
        selectedValue={selected.id}
        onTabSelect={(_e, d) => onSelect(String(d.value))}
        aria-label="Data tabs"
      >
        {tabs.map((t) => (
          <Tab key={t.id} value={t.id}>
            {t.title}
          </Tab>
        ))}
      </TabList>
      <DataTabTable tab={selected} />
    </div>
  );
}
