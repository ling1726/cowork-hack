import {
  ALERT_STATUS_LABELS,
  ACTION_REQUEST_KIND_LABELS,
  type TimelineEvent,
  type User,
} from '@app/domain';
import { Text, makeStyles, tokens } from '@fluentui/react-components';
import type { ReactNode } from 'react';
import { formatDateTime, nameOf } from '../format.ts';
import { ViaClaudeTag } from './ViaClaudeTag.tsx';

const useStyles = makeStyles({
  list: {
    listStyleType: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    paddingLeft: tokens.spacingHorizontalM,
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
  },
  head: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
  body: { whiteSpace: 'pre-wrap' },
  reason: { color: tokens.colorNeutralForeground2 },
});

export interface AlertTimelineProps {
  events: TimelineEvent[];
  users: User[];
  /** Renders an in-app link; `href` is an app-relative path such as `/queue/AR-0001`. */
  renderLink?: (href: string, label: string) => ReactNode;
}

export function AlertTimeline({ events, users, renderLink }: AlertTimelineProps) {
  const styles = useStyles();

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
          summary: `Rejected request ${e.requestId}`,
          ...(e.reason ? { detail: e.reason } : {}),
        };
    }
  };

  return (
    <ol className={styles.list} data-testid="timeline">
      {events.map((e) => {
        const { summary, detail } = describe(e);
        return (
          <li key={e.id} className={styles.item} data-testid="timeline-event">
            <div className={styles.head}>
              <Text weight="semibold">{nameOf(users, e.actorId)}</Text>
              <Text size={200} className={styles.reason}>
                {formatDateTime(e.at)}
              </Text>
              {e.via === 'claude' && (
                <ViaClaudeTag
                  {...(e.approvedBy ? { approvedByName: nameOf(users, e.approvedBy) } : {})}
                />
              )}
            </div>
            <Text>{summary}</Text>
            {detail && (
              <Text block className={e.type === 'comment' ? styles.body : styles.reason}>
                {detail}
              </Text>
            )}
          </li>
        );
      })}
    </ol>
  );
}
