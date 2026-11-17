import {
  ALERT_STATUS_LABELS,
  ACTION_REQUEST_KIND_LABELS,
  type TimelineEvent,
  type User,
} from '@app/domain';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils.ts';
import { formatDateTime, nameOf } from '../format.ts';
import { UserAvatar } from './UserAvatar.tsx';
import { ViaClaudeTag } from './ViaClaudeTag.tsx';

export interface AlertTimelineProps {
  events: TimelineEvent[];
  users: User[];
  /** Renders an in-app link; `href` is an app-relative path such as `/queue/AR-0001`. */
  renderLink?: (href: string, label: string) => ReactNode;
}

export function AlertTimeline({ events, users, renderLink }: AlertTimelineProps) {
  const describe = (e: TimelineEvent): { summary: ReactNode; detail?: string } => {
    switch (e.type) {
      case 'created':
        return { summary: 'Alert created' };
      case 'comment':
        return { summary: 'Commented', detail: e.body };
      case 'status_changed':
        return {
          summary: `Status changed: ${ALERT_STATUS_LABELS[e.from]} → ${ALERT_STATUS_LABELS[e.to]}`,
          ...(e.reason ? { detail: e.reason } : {}),
        };
      case 'escalated':
        return { summary: `Escalated to ${nameOf(users, e.toUserId)}`, detail: e.reason };
      case 'assignees_changed':
        return {
          summary: `Assignees changed: ${nameOf(users, e.primaryId)} (primary), ${nameOf(users, e.backupId)} (backup)`,
        };
      case 'link_added':
        return { summary: 'Added a link' };
      case 'attachment_added':
        return { summary: 'Added an attachment' };
      case 'action_requested': {
        const href = `/queue/${e.requestId}`;
        return {
          summary: (
            <>
              Requested: {ACTION_REQUEST_KIND_LABELS[e.kind]} (
              {renderLink ? renderLink(href, e.requestId) : e.requestId})
            </>
          ),
        };
      }
      case 'action_rejected':
        return {
          summary: `Rejected request ${e.requestId}${e.decidedIn === 'cowork' ? ' in Cowork' : ''}`,
          ...(e.reason ? { detail: e.reason } : {}),
        };
    }
  };

  return (
    <ol className="flex flex-col" data-testid="timeline">
      {events.map((e, i) => {
        const { summary, detail } = describe(e);
        const actor = nameOf(users, e.actorId);
        const last = i === events.length - 1;
        return (
          <li
            key={e.id}
            className="relative flex gap-3 pb-5 last:pb-0"
            data-testid="timeline-event"
          >
            {!last && (
              <span aria-hidden className="absolute top-8 bottom-0 left-3 w-px bg-border" />
            )}
            <UserAvatar name={actor} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">{actor}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
                {e.via === 'claude' && (
                  <ViaClaudeTag
                    {...(e.approvedBy ? { approvedByName: nameOf(users, e.approvedBy) } : {})}
                    {...(e.decidedIn ? { decidedIn: e.decidedIn } : {})}
                  />
                )}
              </div>
              <div className="text-sm">{summary}</div>
              {detail && (
                <p
                  className={cn(
                    'text-sm',
                    e.type === 'comment'
                      ? 'rounded-lg border bg-muted/40 px-3 py-2 whitespace-pre-wrap'
                      : 'text-muted-foreground',
                  )}
                >
                  {detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
