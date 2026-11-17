import type { ActionRequest, AlertSummary, TimelineEvent, User } from './schemas.ts';

/** The tool result `_meta` key that carries data only the Cowork views need (never Claude). */
export const VIEW_META_KEY = 'alerts/view';

export const RESOURCE_URIS = {
  alertList: 'ui://alerts/alert-list',
  alertCard: 'ui://alerts/alert-card',
  actionRequest: 'ui://alerts/action-request',
} as const;

export type ActionRequestDetail = ActionRequest & {
  alert: AlertSummary;
  resultEvent?: TimelineEvent;
};

export interface AlertListView {
  users: User[];
}

export interface AlertCardView {
  recentEvents: TimelineEvent[];
  users: User[];
}

export type ActionRequestView =
  | {
      kind: 'request';
      detail: ActionRequestDetail;
      users: User[];
      requestUrl: string;
      canDecide: boolean;
    }
  | { kind: 'applied'; url: string; summary: string };
