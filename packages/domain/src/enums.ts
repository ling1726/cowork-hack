import { z } from 'zod';

export const AlertStatus = z.enum(['open', 'in_progress', 'closed']);
export type AlertStatus = z.infer<typeof AlertStatus>;
export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
};

export const Severity = z.enum(['low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof Severity>;
export const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};
export const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export const Category = z.enum([
  'spoofing_layering',
  'wash_trade',
  'position_limit',
  'best_execution',
  'restricted_list',
  'late_reporting',
  'insider_dealing',
  'marking_the_close',
]);
export type Category = z.infer<typeof Category>;
export const CATEGORY_LABELS: Record<Category, string> = {
  spoofing_layering: 'Spoofing / layering',
  wash_trade: 'Wash trade',
  position_limit: 'Position limit',
  best_execution: 'Best execution',
  restricted_list: 'Restricted list',
  late_reporting: 'Late reporting',
  insider_dealing: 'Insider dealing',
  marking_the_close: 'Marking the close',
};

export const Desk = z.enum([
  'eu-equities',
  'us-equities',
  'us-rates',
  'fx',
  'commodities',
  'credit',
]);
export type Desk = z.infer<typeof Desk>;
export const DESK_LABELS: Record<Desk, string> = {
  'eu-equities': 'EU Equities',
  'us-equities': 'US Equities',
  'us-rates': 'US Rates',
  fx: 'FX',
  commodities: 'Commodities',
  credit: 'Credit',
};

export const UserRole = z.enum(['analyst', 'senior_analyst', 'compliance_lead', 'cco']);
export type UserRole = z.infer<typeof UserRole>;
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  analyst: 'Analyst',
  senior_analyst: 'Senior analyst',
  compliance_lead: 'Compliance lead',
  cco: 'CCO',
};

export const ResolutionOutcome = z.enum(['false_positive', 'true_positive', 'duplicate', 'other']);
export type ResolutionOutcome = z.infer<typeof ResolutionOutcome>;
export const RESOLUTION_OUTCOME_LABELS: Record<ResolutionOutcome, string> = {
  false_positive: 'False positive',
  true_positive: 'True positive',
  duplicate: 'Duplicate',
  other: 'Other',
};

export const ActionRequestKind = z.enum(['add_comment', 'acknowledge']);
export type ActionRequestKind = z.infer<typeof ActionRequestKind>;
export const ACTION_REQUEST_KIND_LABELS: Record<ActionRequestKind, string> = {
  add_comment: 'Add comment',
  acknowledge: 'Acknowledge',
};

export const ActionRequestStatus = z.enum(['pending', 'approved', 'rejected', 'failed']);
export type ActionRequestStatus = z.infer<typeof ActionRequestStatus>;
export const ACTION_REQUEST_STATUS_LABELS: Record<ActionRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
};

export const Via = z.enum(['app', 'claude']);
export type Via = z.infer<typeof Via>;
export const VIA_LABELS: Record<Via, string> = { app: 'App', claude: 'Claude' };

/** Where a human decided one of Claude's requests: in the web app or on a card in Cowork. */
export const DecisionSurface = z.enum(['app', 'cowork']);
export type DecisionSurface = z.infer<typeof DecisionSurface>;
/** Reads after a name: "Approved by Priya Shah in Cowork". */
export const DECISION_SURFACE_LABELS: Record<DecisionSurface, string> = {
  app: 'in the app',
  cowork: 'in Cowork',
};

export const AlertTab = z.enum(['overview', 'timeline', 'materials', 'data']);
export type AlertTab = z.infer<typeof AlertTab>;
export const ALERT_TAB_LABELS: Record<AlertTab, string> = {
  overview: 'Overview',
  timeline: 'Timeline',
  materials: 'Materials',
  data: 'Data',
};

export const AlertSort = z.enum([
  'createdAt',
  '-createdAt',
  'updatedAt',
  '-updatedAt',
  'severity',
  '-severity',
]);
export type AlertSort = z.infer<typeof AlertSort>;
export const ALERT_SORT_LABELS: Record<AlertSort, string> = {
  createdAt: 'Created (oldest)',
  '-createdAt': 'Created (newest)',
  updatedAt: 'Updated (oldest)',
  '-updatedAt': 'Updated (newest)',
  severity: 'Severity (low first)',
  '-severity': 'Severity (high first)',
};

export const AllowedAction = z.enum([
  'acknowledge',
  'close',
  'reopen',
  'escalate',
  'comment',
  'edit_assignees',
  'add_link',
  'add_attachment',
]);
export type AllowedAction = z.infer<typeof AllowedAction>;
export const ALLOWED_ACTION_LABELS: Record<AllowedAction, string> = {
  acknowledge: 'Acknowledge',
  close: 'Close',
  reopen: 'Reopen',
  escalate: 'Escalate',
  comment: 'Comment',
  edit_assignees: 'Edit assignees',
  add_link: 'Add link',
  add_attachment: 'Add attachment',
};
