import type { ActionRequestDetail, AlertSummary, User } from '@app/domain';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { vi } from 'vitest';
import type { ViewBridge } from '../bridge.ts';

export const APP = 'http://localhost:5173';

export const users: User[] = [
  { id: 'U-01', name: 'Priya Shah', role: 'analyst', desk: 'eu-equities', initials: 'PS' },
  { id: 'U-02', name: 'Tom Becker', role: 'analyst', desk: 'eu-equities', initials: 'TB' },
];

export const summary: AlertSummary = {
  id: 'ALT-1042',
  title: 'Possible layering in SAP GY',
  status: 'open',
  severity: 'high',
  category: 'spoofing_layering',
  desk: 'eu-equities',
  trader: { id: 'T-0412', name: 'James Whitfield' },
  instrument: { symbol: 'SAP GY', name: 'SAP SE', assetClass: 'equity' },
  rule: { id: 'R-LAY-01', name: 'Layering' },
  assignees: { primaryId: 'U-01', backupId: 'U-02', escalatedTo: [] },
  createdAt: '2026-11-17T08:00:00.000Z',
  updatedAt: '2026-11-17T08:30:00.000Z',
};

export const second: AlertSummary = {
  ...summary,
  id: 'ALT-1050',
  title: 'Second alert',
  severity: 'critical',
  createdAt: '2026-11-16T08:00:00.000Z',
};

export const pendingDetail: ActionRequestDetail = {
  id: 'AR-0001',
  alertId: 'ALT-1042',
  onBehalfOf: 'U-01',
  via: 'claude',
  rationale: 'OTR 34:1 meets the threshold.',
  status: 'pending',
  createdAt: '2026-11-17T09:00:00.000Z',
  kind: 'acknowledge',
  payload: {},
  alert: summary,
};

export const decidedDetail = (
  status: 'approved' | 'rejected',
  decidedIn: 'app' | 'cowork',
  extra: Partial<ActionRequestDetail> = {},
): ActionRequestDetail =>
  ({
    ...pendingDetail,
    status,
    decidedIn,
    decidedBy: 'U-01',
    decidedAt: '2026-11-17T09:05:00.000Z',
    ...extra,
  }) as ActionRequestDetail;

export function requestResult(detail: ActionRequestDetail, canDecide = true): CallToolResult {
  return {
    content: [{ type: 'text', text: `Request ${detail.id}` }],
    structuredContent: { request: detail },
    _meta: {
      'alerts/view': {
        kind: 'request',
        detail,
        users,
        requestUrl: `${APP}/queue/${detail.id}`,
        canDecide,
      },
    },
  };
}

export function fakeBridge(overrides: Partial<ViewBridge> = {}) {
  return {
    callTool: vi.fn<ViewBridge['callTool']>(async () => ({ content: [] })),
    openLink: vi.fn<ViewBridge['openLink']>(async () => {}),
    sendMessage: vi.fn<ViewBridge['sendMessage']>(async () => true),
    updateModelContext: vi.fn<ViewBridge['updateModelContext']>(async () => {}),
    ...overrides,
  };
}
