import type { Alert, TimelineEvent, User } from '@app/domain';
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { buttonVariants } from '../primitives/button.tsx';
import { Card, CardContent, CardFooter } from '../primitives/card.tsx';
import { AlertHeader } from './AlertHeader.tsx';
import { AlertHighlights } from './AlertHighlights.tsx';
import { AlertTimeline } from './AlertTimeline.tsx';

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
  return (
    <Card className="max-w-3xl" data-testid="alert-summary-card">
      <CardContent className="flex flex-col gap-5">
        <AlertHeader alert={alert} actions={[]} onAction={() => {}} />
        <AlertHighlights highlights={alert.highlights} />
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recent activity</h2>
          <AlertTimeline events={recentEvents.slice(-3)} users={users} />
        </section>
      </CardContent>
      <CardFooter className="justify-end">
        {renderLink ? (
          renderLink(openInAppHref, 'Open in app')
        ) : (
          <a
            href={openInAppHref}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Open in app
            <ExternalLink aria-hidden />
          </a>
        )}
      </CardFooter>
    </Card>
  );
}
