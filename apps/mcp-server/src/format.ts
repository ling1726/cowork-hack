import {
  ACTION_REQUEST_KIND_LABELS,
  ALERT_STATUS_LABELS,
  CATEGORY_LABELS,
  DESK_LABELS,
  RESOLUTION_OUTCOME_LABELS,
  SEVERITY_LABELS,
  USER_ROLE_LABELS,
  type Alert,
  type AlertSummary,
  type DataTab,
  type TimelineEvent,
  type User,
} from '@app/domain';

export type Names = (userId: string) => string;

export function namesOf(users: readonly User[]): Names {
  return (id) => (id === 'system' ? 'System' : (users.find((u) => u.id === id)?.name ?? id));
}

/** "2h", "3d": how long ago, for ranking lines in a list. */
export function age(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');

export function summaryLine(a: AlertSummary, url: string, now?: Date): string {
  return (
    `${a.id} [${SEVERITY_LABELS[a.severity]}, ${ALERT_STATUS_LABELS[a.status]}] ${a.title} — ` +
    `rule ${a.rule.name}; trader ${a.trader.name} (${a.trader.id}); ${DESK_LABELS[a.desk]}; ` +
    `${CATEGORY_LABELS[a.category]}; created ${age(a.createdAt, now)} ago — ${url}`
  );
}

const MAX_ROWS = 100;

function tsv(tab: DataTab): string {
  const keys = tab.columns.map((c) => c.key);
  const lines = [keys.join('\t')];
  for (const row of tab.rows.slice(0, MAX_ROWS))
    lines.push(keys.map((k) => String(row[k] ?? '')).join('\t'));
  if (tab.rows.length > MAX_ROWS) lines.push(`… ${tab.rows.length - MAX_ROWS} more rows`);
  return lines.join('\n');
}

export function alertText(
  a: Alert & { allowedActions: string[]; pendingActionRequestIds: string[] },
  url: string,
  tabUrls: Record<string, string>,
  names: Names,
): string {
  const out: string[] = [
    `${a.id}: ${a.title}`,
    `Status ${ALERT_STATUS_LABELS[a.status]}; severity ${SEVERITY_LABELS[a.severity]}; ${CATEGORY_LABELS[a.category]}; ${DESK_LABELS[a.desk]}.`,
    `Trader ${a.trader.name} (${a.trader.id}); instrument ${a.instrument.symbol} (${a.instrument.name}).`,
    `Assignees: primary ${names(a.assignees.primaryId)}, backup ${names(a.assignees.backupId)}` +
      (a.assignees.escalatedTo.length
        ? `; escalated to ${a.assignees.escalatedTo.map((e) => names(e.userId)).join(', ')}`
        : '') +
      '.',
    '',
    a.summary,
    '',
    `Rule ${a.rule.id} ${a.rule.name} (${a.rule.regulation}). Indicators:`,
    ...a.rule.indicators.map((i) => `- ${i.id}: ${i.description} — threshold ${i.threshold}`),
    '',
    'Highlights:',
    ...a.highlights.map(
      (h) => `- ${h.label}: ${h.value}${h.tone && h.tone !== 'neutral' ? ` (${h.tone})` : ''}`,
    ),
  ];
  if (a.resolution) {
    out.push(
      '',
      `Resolution: ${RESOLUTION_OUTCOME_LABELS[a.resolution.outcome]} by ${names(a.resolution.closedBy)} — ${a.resolution.note}`,
    );
  }
  for (const tab of a.dataTabs) {
    out.push('', `Data tab "${tab.title}" (${tab.id}, ${tab.rows.length} rows):`, tsv(tab));
  }
  out.push(
    '',
    `Allowed actions: ${a.allowedActions.join(', ')}.`,
    a.pendingActionRequestIds.length
      ? `Pending Claude requests awaiting approval: ${a.pendingActionRequestIds.join(', ')}.`
      : '',
    `Open in the app: ${url}`,
    `Tabs: ${Object.entries(tabUrls)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')}`,
  );
  return out.filter((l, i, all) => l !== '' || all[i - 1] !== '').join('\n');
}

export function eventText(e: TimelineEvent, names: Names): string {
  const who = `${names(e.actorId)}${e.via === 'claude' ? ` (via Claude${e.approvedBy ? `, approved by ${names(e.approvedBy)}` : ''})` : ''}`;
  let what: string;
  switch (e.type) {
    case 'created':
      what = 'alert created';
      break;
    case 'comment':
      what = `commented: ${e.body}`;
      break;
    case 'status_changed':
      what = `status ${ALERT_STATUS_LABELS[e.from]} → ${ALERT_STATUS_LABELS[e.to]}${e.reason ? ` (${e.reason})` : ''}`;
      break;
    case 'escalated':
      what = `escalated to ${names(e.toUserId)}: ${e.reason}`;
      break;
    case 'assignees_changed':
      what = `assignees changed: primary ${names(e.primaryId)}, backup ${names(e.backupId)}`;
      break;
    case 'link_added':
      what = `added link ${e.linkId}`;
      break;
    case 'attachment_added':
      what = `added attachment ${e.attachmentId}`;
      break;
    case 'action_requested':
      what = `Claude requested "${ACTION_REQUEST_KIND_LABELS[e.kind]}" (${e.requestId}), awaiting approval`;
      break;
    case 'action_rejected':
      what = `rejected request ${e.requestId}${e.reason ? `: ${e.reason}` : ''}`;
      break;
  }
  return `${when(e.at)} ${who}: ${what}`;
}

export function userLine(u: User, acting: boolean): string {
  return `${u.id} ${u.name} — ${USER_ROLE_LABELS[u.role]}${u.desk ? `, ${DESK_LABELS[u.desk]}` : ''}${acting ? ' (the user Claude acts for)' : ''}`;
}

export const pendingText = (name: string, approveUrl: string) =>
  `Nothing has changed yet. ${name} must approve this in the app: ${approveUrl}`;
