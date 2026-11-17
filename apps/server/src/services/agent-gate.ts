import {
  checkTransition,
  type ActionRequest,
  type Alert,
  type AlertSummary,
  type TimelineEvent,
  type Via,
} from '@app/domain';
import { ApiError } from '../errors.ts';
import type { Store } from '../store/store.ts';
import { toSummary } from './alert-queries.ts';
import { applyCommand, type Command, type CommandResult } from './commands.ts';

export type GateCommand = Extract<Command, { kind: 'add_comment' | 'acknowledge' }>;

export type GateResult =
  | ({ kind: 'applied' } & CommandResult)
  | { kind: 'queued'; actionRequest: ActionRequest };

export interface GateCtx {
  userId: string;
  via: Via;
}

const requireAlert = (store: Store, id: string): Alert => {
  const alert = store.getAlert(id);
  if (!alert) throw new ApiError(404, 'not_found', `Alert ${id} not found`);
  return alert;
};

/**
 * Entry point for comments and acknowledgements.
 * - Humans apply directly.
 * - Claude with approval off applies directly, still marked `via: 'claude'`.
 * - Claude with approval on is validated against the state machine, then queued as a pending
 *   action request. Nothing about the alert changes until a human approves.
 */
export function submitOrApply(
  store: Store,
  alertId: string,
  cmd: GateCommand,
  ctx: GateCtx,
  rationale?: string,
): GateResult {
  if (ctx.via === 'app') {
    return {
      kind: 'applied',
      ...applyCommand(store, alertId, cmd, { userId: ctx.userId, via: 'app' }),
    };
  }
  if (!rationale) {
    throw new ApiError(
      400,
      'rationale_required',
      'Claude must include a rationale with every write',
    );
  }
  if (!store.settingsFor(ctx.userId).requireApprovalForAgentActions) {
    return {
      kind: 'applied',
      ...applyCommand(store, alertId, cmd, { userId: ctx.userId, via: 'claude' }),
    };
  }

  const alert = requireAlert(store, alertId);
  if (cmd.kind === 'acknowledge') {
    const check = checkTransition(alert, { kind: 'acknowledge' });
    if (!check.ok) throw new ApiError(409, check.code, check.message);
  }

  const base = {
    id: store.nextId('AR'),
    alertId,
    onBehalfOf: ctx.userId,
    via: 'claude' as const,
    rationale,
    status: 'pending' as const,
    createdAt: store.now().toISOString(),
  };
  const actionRequest: ActionRequest =
    cmd.kind === 'add_comment'
      ? { ...base, kind: 'add_comment', payload: { body: cmd.body } }
      : { ...base, kind: 'acknowledge', payload: {} };
  store.actionRequests.set(actionRequest.id, actionRequest);
  store.appendEvent({
    type: 'action_requested',
    alertId,
    actorId: ctx.userId,
    via: 'claude',
    requestId: actionRequest.id,
    kind: actionRequest.kind,
  });
  return { kind: 'queued', actionRequest };
}

export type ActionRequestDetail = ActionRequest & {
  alert: AlertSummary;
  resultEvent?: TimelineEvent;
};

export function requestDetail(store: Store, request: ActionRequest): ActionRequestDetail {
  const alert = requireAlert(store, request.alertId);
  const resultEvent = request.resultEventId
    ? store.eventsFor(request.alertId).find((e) => e.id === request.resultEventId)
    : undefined;
  return { ...request, alert: toSummary(alert), ...(resultEvent ? { resultEvent } : {}) };
}

function loadDecidable(store: Store, id: string, caller: string): ActionRequest {
  const request = store.actionRequests.get(id);
  if (!request) throw new ApiError(404, 'not_found', `Action request ${id} not found`);
  if (request.onBehalfOf !== caller) {
    throw new ApiError(403, 'not_owner', 'Only the user Claude acted for can decide this request');
  }
  if (request.status !== 'pending') {
    throw new ApiError(409, 'already_decided', `Request ${id} is already ${request.status}`);
  }
  return request;
}

/** Approves a pending request. If the alert no longer allows the action, the request fails instead. */
export function approveRequest(store: Store, id: string, caller: string): ActionRequestDetail {
  const request = loadDecidable(store, id, caller);
  const decided = { decidedAt: store.now().toISOString(), decidedBy: caller };
  const cmd: GateCommand =
    request.kind === 'add_comment'
      ? { kind: 'add_comment', body: request.payload.body }
      : { kind: 'acknowledge' };

  let updated: ActionRequest;
  try {
    const { event } = applyCommand(store, request.alertId, cmd, {
      userId: request.onBehalfOf,
      via: 'claude',
      actionRequestId: request.id,
      approvedBy: caller,
    });
    updated = { ...request, ...decided, status: 'approved', resultEventId: event.id };
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 409) throw err;
    updated = {
      ...request,
      ...decided,
      status: 'failed',
      failure: { code: err.code, message: err.message },
    };
  }
  store.actionRequests.set(id, updated);
  return requestDetail(store, updated);
}

export function rejectRequest(
  store: Store,
  id: string,
  caller: string,
  reason?: string,
): ActionRequestDetail {
  const request = loadDecidable(store, id, caller);
  store.appendEvent({
    type: 'action_rejected',
    alertId: request.alertId,
    actorId: caller,
    via: 'app',
    actionRequestId: request.id,
    requestId: request.id,
    ...(reason ? { reason } : {}),
  });
  const updated: ActionRequest = {
    ...request,
    status: 'rejected',
    decidedAt: store.now().toISOString(),
    decidedBy: caller,
    ...(reason ? { rejectReason: reason } : {}),
  };
  store.actionRequests.set(id, updated);
  return requestDetail(store, updated);
}
