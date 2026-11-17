import { z } from 'zod';
import {
  ActionRequestStatus,
  AlertStatus,
  Category,
  Desk,
  ResolutionOutcome,
  Severity,
  UserRole,
  Via,
} from './enums.ts';

const iso = z.iso.datetime();

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: UserRole,
  desk: Desk.optional(),
  initials: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const IndicatorSchema = z.object({
  id: z.string(),
  description: z.string(),
  threshold: z.string(),
});
export type Indicator = z.infer<typeof IndicatorSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  regulation: z.string(),
  indicators: z.array(IndicatorSchema),
});
export type Rule = z.infer<typeof RuleSchema>;

export const TraderSchema = z.object({ id: z.string(), name: z.string() });
export type Trader = z.infer<typeof TraderSchema>;

export const InstrumentSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  assetClass: z.string(),
});
export type Instrument = z.infer<typeof InstrumentSchema>;

export const EscalationSchema = z.object({
  userId: z.string(),
  at: iso,
  byUserId: z.string(),
  reason: z.string(),
});
export type Escalation = z.infer<typeof EscalationSchema>;

export const AssigneesSchema = z.object({
  primaryId: z.string(),
  backupId: z.string(),
  escalatedTo: z.array(EscalationSchema),
});
export type Assignees = z.infer<typeof AssigneesSchema>;

export const HighlightSchema = z.object({
  label: z.string(),
  value: z.string(),
  tone: z.enum(['neutral', 'warning', 'danger']).optional(),
});
export type Highlight = z.infer<typeof HighlightSchema>;

export const DataTabColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['string', 'number', 'datetime', 'currency']),
});
export const DataTabSchema = z.object({
  id: z.string(),
  title: z.string(),
  columns: z.array(DataTabColumnSchema),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
});
export type DataTab = z.infer<typeof DataTabSchema>;

export const AlertLinkSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  addedBy: z.string(),
  addedAt: iso,
});
export type AlertLink = z.infer<typeof AlertLinkSchema>;

export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedBy: z.string(),
  uploadedAt: iso,
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const ResolutionSchema = z.object({
  outcome: ResolutionOutcome,
  note: z.string(),
  closedBy: z.string(),
  closedAt: iso,
});
export type Resolution = z.infer<typeof ResolutionSchema>;

export const AlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  status: AlertStatus,
  severity: Severity,
  category: Category,
  rule: RuleSchema,
  desk: Desk,
  trader: TraderSchema,
  instrument: InstrumentSchema,
  assignees: AssigneesSchema,
  highlights: z.array(HighlightSchema),
  dataTabs: z.array(DataTabSchema),
  links: z.array(AlertLinkSchema),
  attachments: z.array(AttachmentSchema),
  resolution: ResolutionSchema.optional(),
  createdAt: iso,
  updatedAt: iso,
});
export type Alert = z.infer<typeof AlertSchema>;

export const AlertSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: AlertStatus,
  severity: Severity,
  category: Category,
  desk: Desk,
  trader: TraderSchema,
  instrument: InstrumentSchema,
  rule: z.object({ id: z.string(), name: z.string() }),
  assignees: AssigneesSchema,
  createdAt: iso,
  updatedAt: iso,
});
export type AlertSummary = z.infer<typeof AlertSummarySchema>;

const eventBase = z.object({
  id: z.string(),
  alertId: z.string(),
  at: iso,
  actorId: z.string(),
  via: Via,
  actionRequestId: z.string().optional(),
  approvedBy: z.string().optional(),
});

export const TimelineEventSchema = z.discriminatedUnion('type', [
  eventBase.extend({ type: z.literal('created') }),
  eventBase.extend({ type: z.literal('comment'), body: z.string() }),
  eventBase.extend({
    type: z.literal('status_changed'),
    from: AlertStatus,
    to: AlertStatus,
    reason: z.string().optional(),
  }),
  eventBase.extend({ type: z.literal('escalated'), toUserId: z.string(), reason: z.string() }),
  eventBase.extend({
    type: z.literal('assignees_changed'),
    primaryId: z.string(),
    backupId: z.string(),
  }),
  eventBase.extend({ type: z.literal('link_added'), linkId: z.string() }),
  eventBase.extend({ type: z.literal('attachment_added'), attachmentId: z.string() }),
  eventBase.extend({
    type: z.literal('action_requested'),
    requestId: z.string(),
    kind: z.enum(['add_comment', 'acknowledge']),
  }),
  eventBase.extend({
    type: z.literal('action_rejected'),
    requestId: z.string(),
    reason: z.string().optional(),
  }),
]);
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

const actionRequestBase = z.object({
  id: z.string(),
  alertId: z.string(),
  onBehalfOf: z.string(),
  via: z.literal('claude'),
  rationale: z.string(),
  status: ActionRequestStatus,
  createdAt: iso,
  decidedAt: iso.optional(),
  decidedBy: z.string().optional(),
  rejectReason: z.string().optional(),
  failure: z.object({ code: z.string(), message: z.string() }).optional(),
  resultEventId: z.string().optional(),
});

export const ActionRequestSchema = z.discriminatedUnion('kind', [
  actionRequestBase.extend({
    kind: z.literal('add_comment'),
    payload: z.object({ body: z.string() }),
  }),
  actionRequestBase.extend({ kind: z.literal('acknowledge'), payload: z.object({}) }),
]);
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const UserSettingsSchema = z.object({ requireApprovalForAgentActions: z.boolean() });
export type UserSettings = z.infer<typeof UserSettingsSchema>;

// Command bodies
export const CommentBody = z.object({ body: z.string().min(1).max(5000) });
export type CommentBody = z.infer<typeof CommentBody>;
export const CloseBody = z.object({
  outcome: ResolutionOutcome,
  note: z.string().min(1).max(2000),
});
export type CloseBody = z.infer<typeof CloseBody>;
export const ReopenBody = z.object({ reason: z.string().min(1).max(2000) });
export type ReopenBody = z.infer<typeof ReopenBody>;
export const EscalateBody = z.object({
  toUserId: z.string().min(1),
  reason: z.string().min(1).max(2000),
});
export type EscalateBody = z.infer<typeof EscalateBody>;
export const AssigneesBody = z
  .object({ primaryId: z.string().min(1), backupId: z.string().min(1) })
  .refine((v) => v.primaryId !== v.backupId, {
    message: 'primaryId and backupId must differ',
    path: ['backupId'],
  });
export type AssigneesBody = z.infer<typeof AssigneesBody>;
export const LinkBody = z.object({
  title: z.string().min(1).max(200),
  url: z.url({ protocol: /^https?$/ }),
});
export type LinkBody = z.infer<typeof LinkBody>;
export const AgentRationale = z.object({ rationale: z.string().min(1).max(1000) });
export type AgentRationale = z.infer<typeof AgentRationale>;
