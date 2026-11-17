import {
  checkTransition,
  type Alert,
  type DecisionSurface,
  type ResolutionOutcome,
  type TimelineEvent,
  type Transition,
  type Via,
} from '@app/domain';
import { ApiError } from '../errors.ts';
import type { Store } from '../store/store.ts';

export type Command =
  | { kind: 'add_comment'; body: string }
  | { kind: 'acknowledge' }
  | { kind: 'close'; outcome: ResolutionOutcome; note: string }
  | { kind: 'reopen'; reason: string }
  | { kind: 'escalate'; toUserId: string; reason: string }
  | { kind: 'set_assignees'; primaryId: string; backupId: string }
  | { kind: 'add_link'; title: string; url: string }
  | { kind: 'add_attachment'; filename: string; mimeType: string; bytes: Uint8Array };

export interface Actor {
  userId: string;
  via: Via;
  actionRequestId?: string;
  approvedBy?: string;
  /** Where the human approved the request that produced this write. */
  decidedIn?: DecisionSurface;
}

export interface CommandResult {
  alert: Alert;
  event: TimelineEvent;
}

function requireKnownUser(store: Store, userId: string): void {
  if (!store.users.has(userId)) throw new ApiError(400, 'unknown_user', `Unknown user ${userId}`);
}

function transition(alert: Alert, t: Transition): Alert['status'] {
  const result = checkTransition(alert, t);
  if (!result.ok) throw new ApiError(409, result.code, result.message);
  return result.nextStatus;
}

/**
 * The single code path for every alert write: direct human writes and approved agent requests.
 * Appends the timeline event, updates the alert (bumping `updatedAt`) and reindexes search.
 */
export function applyCommand(
  store: Store,
  alertId: string,
  cmd: Command,
  actor: Actor,
): CommandResult {
  const alert = store.getAlert(alertId);
  if (!alert) throw new ApiError(404, 'not_found', `Alert ${alertId} not found`);

  const common = {
    alertId,
    actorId: actor.userId,
    via: actor.via,
    ...(actor.actionRequestId ? { actionRequestId: actor.actionRequestId } : {}),
    ...(actor.approvedBy ? { approvedBy: actor.approvedBy } : {}),
    ...(actor.decidedIn ? { decidedIn: actor.decidedIn } : {}),
  };
  const nowIso = () => store.now().toISOString();
  const statusEvent = (from: Alert['status'], to: Alert['status'], reason?: string) =>
    store.appendEvent({
      ...common,
      type: 'status_changed',
      from,
      to,
      ...(reason ? { reason } : {}),
    });

  switch (cmd.kind) {
    case 'add_comment': {
      const event = store.appendEvent({ ...common, type: 'comment', body: cmd.body });
      return { alert: store.saveAlert(alert), event };
    }
    case 'acknowledge': {
      const next = transition(alert, { kind: 'acknowledge' });
      const event = statusEvent(alert.status, next);
      return { alert: store.saveAlert({ ...alert, status: next }), event };
    }
    case 'close': {
      const next = transition(alert, { kind: 'close', outcome: cmd.outcome, note: cmd.note });
      const event = statusEvent(alert.status, next, cmd.note);
      const resolution = {
        outcome: cmd.outcome,
        note: cmd.note,
        closedBy: actor.userId,
        closedAt: nowIso(),
      };
      return { alert: store.saveAlert({ ...alert, status: next, resolution }), event };
    }
    case 'reopen': {
      const next = transition(alert, { kind: 'reopen', reason: cmd.reason });
      const event = statusEvent(alert.status, next, cmd.reason);
      const { resolution: _cleared, ...rest } = alert;
      return { alert: store.saveAlert({ ...rest, status: next }), event };
    }
    case 'escalate': {
      requireKnownUser(store, cmd.toUserId);
      transition(alert, { kind: 'escalate', toUserId: cmd.toUserId, reason: cmd.reason });
      const event = store.appendEvent({
        ...common,
        type: 'escalated',
        toUserId: cmd.toUserId,
        reason: cmd.reason,
      });
      const escalation = {
        userId: cmd.toUserId,
        at: nowIso(),
        byUserId: actor.userId,
        reason: cmd.reason,
      };
      return {
        alert: store.saveAlert({
          ...alert,
          assignees: {
            ...alert.assignees,
            escalatedTo: [...alert.assignees.escalatedTo, escalation],
          },
        }),
        event,
      };
    }
    case 'set_assignees': {
      requireKnownUser(store, cmd.primaryId);
      requireKnownUser(store, cmd.backupId);
      const event = store.appendEvent({
        ...common,
        type: 'assignees_changed',
        primaryId: cmd.primaryId,
        backupId: cmd.backupId,
      });
      return {
        alert: store.saveAlert({
          ...alert,
          assignees: { ...alert.assignees, primaryId: cmd.primaryId, backupId: cmd.backupId },
        }),
        event,
      };
    }
    case 'add_link': {
      const link = {
        id: store.nextId('LNK'),
        title: cmd.title,
        url: cmd.url,
        addedBy: actor.userId,
        addedAt: nowIso(),
      };
      const event = store.appendEvent({ ...common, type: 'link_added', linkId: link.id });
      return { alert: store.saveAlert({ ...alert, links: [...alert.links, link] }), event };
    }
    case 'add_attachment': {
      const meta = {
        id: store.nextId('ATT'),
        filename: cmd.filename,
        mimeType: cmd.mimeType,
        sizeBytes: cmd.bytes.length,
        uploadedBy: actor.userId,
        uploadedAt: nowIso(),
      };
      store.attachments.set(meta.id, { meta, bytes: cmd.bytes });
      const event = store.appendEvent({
        ...common,
        type: 'attachment_added',
        attachmentId: meta.id,
      });
      return {
        alert: store.saveAlert({ ...alert, attachments: [...alert.attachments, meta] }),
        event,
      };
    }
  }
}
