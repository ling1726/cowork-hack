import type { Highlight } from '@app/domain';
import { Card, Text, makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  row: { display: 'flex', gap: tokens.spacingHorizontalM, flexWrap: 'wrap' },
  card: { minWidth: '150px' },
  neutral: {},
  warning: { color: tokens.colorPaletteDarkOrangeForeground1 },
  danger: { color: tokens.colorPaletteRedForeground1 },
});

export function AlertHighlights({ highlights }: { highlights: Highlight[] }) {
  const styles = useStyles();
  return (
    <div className={styles.row} data-testid="highlights">
      {highlights.map((h) => (
        <Card key={h.label} className={styles.card} size="small" data-testid="highlight">
          <Text size={200}>{h.label}</Text>
          <Text size={600} weight="semibold" className={styles[h.tone ?? 'neutral']}>
            {h.value}
          </Text>
        </Card>
      ))}
    </div>
  );
}
