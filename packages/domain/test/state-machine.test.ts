import { describe, expect, it } from 'vitest';
import {
  allowedActions,
  checkTransition,
  type AlertStatus,
  type Transition,
} from '../src/index.ts';

const assignees = { primaryId: 'U-01', backupId: 'U-03', escalatedTo: [] };

function transition(kind: Transition['kind']): Transition {
  switch (kind) {
    case 'acknowledge':
      return { kind };
    case 'close':
      return { kind, outcome: 'false_positive', note: 'benign' };
    case 'reopen':
      return { kind, reason: 'new evidence' };
    case 'escalate':
      return { kind, toUserId: 'U-04', reason: 'needs review' };
  }
}

describe('checkTransition', () => {
  it.each([
    ['open', 'acknowledge', true, 'in_progress'],
    ['in_progress', 'acknowledge', false],
    ['closed', 'acknowledge', false],
    ['in_progress', 'close', true, 'closed'],
    ['open', 'close', false],
    ['closed', 'close', false],
    ['closed', 'reopen', true, 'open'],
    ['open', 'reopen', false],
    ['in_progress', 'reopen', false],
    ['open', 'escalate', true, 'open'],
    ['in_progress', 'escalate', true, 'in_progress'],
    ['closed', 'escalate', false],
  ] as const)('%s + %s → ok=%s', (status, kind, ok, next?: AlertStatus) => {
    const result = checkTransition({ status, assignees }, transition(kind));
    expect(result.ok).toBe(ok);
    if (result.ok) {
      expect(result.nextStatus).toBe(next);
    } else {
      expect(result.code).toBe('illegal_transition');
    }
  });

  it('escalating to an already-escalated user is already_escalated', () => {
    const escalated = {
      ...assignees,
      escalatedTo: [
        { userId: 'U-04', at: '2026-11-17T09:00:00.000Z', byUserId: 'U-01', reason: 'x' },
      ],
    };
    const result = checkTransition(
      { status: 'open', assignees: escalated },
      { kind: 'escalate', toUserId: 'U-04', reason: 'again' },
    );
    expect(result).toMatchObject({ ok: false, code: 'already_escalated' });
  });
});

describe('allowedActions', () => {
  it('allowedActions(open) = [acknowledge, escalate, comment, edit_assignees, add_link, add_attachment]', () => {
    expect(allowedActions({ status: 'open' })).toEqual([
      'acknowledge',
      'escalate',
      'comment',
      'edit_assignees',
      'add_link',
      'add_attachment',
    ]);
  });
  it('allowedActions(in_progress) = [close, escalate, comment, edit_assignees, add_link, add_attachment]', () => {
    expect(allowedActions({ status: 'in_progress' })).toEqual([
      'close',
      'escalate',
      'comment',
      'edit_assignees',
      'add_link',
      'add_attachment',
    ]);
  });
  it('allowedActions(closed) = [reopen, comment, edit_assignees, add_link, add_attachment]', () => {
    expect(allowedActions({ status: 'closed' })).toEqual([
      'reopen',
      'comment',
      'edit_assignees',
      'add_link',
      'add_attachment',
    ]);
  });
  it('is stable for every status', () => {
    for (const status of ['open', 'in_progress', 'closed'] as AlertStatus[]) {
      expect(allowedActions({ status })).toEqual(allowedActions({ status }));
    }
  });
});
