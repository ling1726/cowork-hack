import type { Alert, TimelineEvent, User } from '@app/domain';
import { Card, Link, Text, makeStyles, tokens } from '@fluentui/react-components';
import type { ReactNode } from 'react';
import { AlertHeader } from './AlertHeader.tsx';
import { AlertHighlights } from './AlertHighlights.tsx';
import { AlertTimeline } from './AlertTimeline.tsx';

const useStyles = makeStyles({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    maxWidth: '720px',
  },
  footer: { display: 'flex', justifyContent: 'flex-end' },
});

export interface AlertSummaryCardProps {
  alert: Alert;
  recentEvents: TimelineEvent[];
  users: User[];
  openInAppHref: string;
  renderLink?: (href: string, label: string) => ReactNode;
}

/** The Cowork card: header, highlights, the last three timeline entries and an "Open in app" link. */
export function AlertSummaryCard({
  alert,
  recentEvents,
  users,
  openInAppHref,
  renderLink,
}: AlertSummaryCardProps) {
  const styles = useStyles();
  return (
    <Card className={styles.card} data-testid="alert-summary-card">
      <AlertHeader alert={alert} actions={[]} onAction={() => {}} />
      <AlertHighlights highlights={alert.highlights} />
      <Text weight="semibold">Recent activity</Text>
      <AlertTimeline events={recentEvents.slice(-3)} users={users} />
      <div className={styles.footer}>
        {renderLink ? (
          renderLink(openInAppHref, 'Open in app')
        ) : (
          <Link href={openInAppHref} target="_blank" rel="noreferrer">
            Open in app
          </Link>
        )}
      </div>
    </Card>
  );
}
