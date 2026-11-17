import type { AllowedAction, AlertStatus, ResolutionOutcome } from './enums.ts';
import type { Alert } from './schemas.ts';

export type Transition =
  | { kind: 'acknowledge' }
  | { kind: 'close'; outcome: ResolutionOutcome; note: string }
  | { kind: 'reopen'; reason: string }
  | { kind: 'escalate'; toUserId: string; reason: string };

export type TransitionResult =
  | { ok: true; nextStatus: AlertStatus }
  | { ok: false; code: 'illegal_transition' | 'already_escalated'; message: string };

type LifecycleKind = Transition['kind'];

// status → kind → next status. A missing entry means the transition is illegal.
const TABLE: Record<AlertStatus, Partial<Record<LifecycleKind, AlertStatus>>> = {
  open: { acknowledge: 'in_progress', escalate: 'open' },
  in_progress: { close: 'closed', escalate: 'in_progress' },
  closed: { reopen: 'open' },
};

export function checkTransition(
  alert: Pick<Alert, 'status' | 'assignees'>,
  t: Transition,
): TransitionResult {
  const next = TABLE[alert.status][t.kind];
  if (!next) {
    return {
      ok: false,
      code: 'illegal_transition',
      message: `Cannot ${t.kind} an alert that is ${alert.status}`,
    };
  }
  if (t.kind === 'escalate' && alert.assignees.escalatedTo.some((e) => e.userId === t.toUserId)) {
    return {
      ok: false,
      code: 'already_escalated',
      message: `${t.toUserId} is already escalated on this alert`,
    };
  }
  return { ok: true, nextStatus: next };
}

const COMMON_ACTIONS: AllowedAction[] = ['comment', 'edit_assignees', 'add_link', 'add_attachment'];

const LIFECYCLE_ACTIONS: Record<AlertStatus, AllowedAction[]> = {
  open: ['acknowledge', 'escalate'],
  in_progress: ['close', 'escalate'],
  closed: ['reopen'],
};

export function allowedActions(alert: Pick<Alert, 'status'>): AllowedAction[] {
  return [...LIFECYCLE_ACTIONS[alert.status], ...COMMON_ACTIONS];
}
