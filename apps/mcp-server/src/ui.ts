import { unwrap, type ApiClient } from '@app/api-client';
import {
  RESOURCE_URIS,
  VIEW_META_KEY,
  actionRequestUrl,
  alertUrl,
  type ActionRequestDetail,
  type ActionRequestView,
  type AlertCardView,
  type AlertListView,
} from '@app/domain';
import {
  RESOURCE_MIME_TYPE,
  RESOURCE_URI_META_KEY,
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * The Cowork views (MCP Apps). A session offers them only when the client declared MCP Apps
 * support and all three HTML bundles from `apps/mcp-ui/dist` are present; otherwise the session
 * is exactly the phase 1 text surface.
 */

export type ViewName = keyof typeof RESOURCE_URIS;

const FILES: Record<ViewName, string> = {
  alertList: 'alert-list.html',
  alertCard: 'alert-card.html',
  actionRequest: 'action-request.html',
};

const cache = new Map<string, Partial<Record<ViewName, string>>>();

/** Reads the view bundles once per directory. A missing file is logged and skipped. */
export function loadViews(uiDir: string | undefined): Partial<Record<ViewName, string>> {
  if (!uiDir) return {};
  const cached = cache.get(uiDir);
  if (cached) return cached;
  const views: Partial<Record<ViewName, string>> = {};
  for (const [name, file] of Object.entries(FILES) as Array<[ViewName, string]>) {
    try {
      views[name] = readFileSync(join(uiDir, file), 'utf8');
    } catch {
      console.warn(`MCP Apps view ${file} not found in ${uiDir}; run "pnpm build:ui".`);
    }
  }
  cache.set(uiDir, views);
  return views;
}

/** The views when all three are available, else undefined (text-only session). */
export function completeViews(uiDir: string | undefined): Record<ViewName, string> | undefined {
  const views = loadViews(uiDir);
  const all = (Object.keys(FILES) as ViewName[]).every((n) => views[n] !== undefined);
  return all ? (views as Record<ViewName, string>) : undefined;
}

export function registerViews(server: McpServer, views: Record<ViewName, string>): void {
  for (const name of Object.keys(FILES) as ViewName[]) {
    const uri = RESOURCE_URIS[name];
    registerAppResource(server, FILES[name], uri, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
      contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: views[name] }],
    }));
  }
}

/** Tool `_meta` naming the view that renders its result (modern and legacy keys). */
export const toolUiMeta = (uri: string) => ({
  ui: { resourceUri: uri },
  [RESOURCE_URI_META_KEY]: uri,
});

type ViewPayload = AlertListView | AlertCardView | ActionRequestView;

/** Attaches data only the view needs. Claude reads `content` and `structuredContent`, not this. */
export function withView(result: CallToolResult, payload: ViewPayload): CallToolResult {
  return { ...result, _meta: { ...result._meta, [VIEW_META_KEY]: payload } };
}

export interface ViewDeps {
  api: ApiClient;
  appBaseUrl: string;
  canDecide: boolean;
}

export async function requestView(
  deps: ViewDeps,
  detail: ActionRequestDetail,
): Promise<ActionRequestView> {
  const users = unwrap(await deps.api.GET('/api/users'));
  return {
    kind: 'request',
    detail,
    users,
    requestUrl: actionRequestUrl(deps.appBaseUrl, detail.id),
    canDecide: deps.canDecide,
  };
}

/** The same structured result as `get_action_request`, so the view handles both alike. */
export function requestLinks(base: string, request: ActionRequestDetail) {
  return {
    url: alertUrl(base, request.alertId, {
      tab: request.status === 'approved' ? 'timeline' : 'overview',
    }),
    approveUrl: actionRequestUrl(base, request.id),
  };
}

/**
 * Approve / Reject for the request card. `visibility: ["app"]` asks the host to offer them to the
 * view and never to the model; the backend accepts the Cowork token for these two calls only.
 */
export function registerDecisionTools(
  server: McpServer,
  deps: ViewDeps & { decisionApi: ApiClient },
  safe: <A>(h: (args: A) => Promise<CallToolResult>) => (args: A) => Promise<CallToolResult>,
): void {
  const requestId = z.string().min(1).describe('Request id, for example AR-0001');
  const annotations = (title: string) => ({
    title,
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
  const _meta = { ui: { resourceUri: RESOURCE_URIS.actionRequest, visibility: ['app' as const] } };

  const decided = async (request: ActionRequestDetail, verb: 'Approved' | 'Rejected') => {
    const result: CallToolResult = {
      content: [{ type: 'text', text: `${verb} ${request.id} in Cowork.` }],
      structuredContent: { request, ...requestLinks(deps.appBaseUrl, request) },
    };
    return withView(result, await requestView(deps, request));
  };

  registerAppTool(
    server,
    'approve_action_request',
    {
      title: 'Approve request',
      description: 'Approve a pending request from its card in Cowork (the user, not Claude).',
      inputSchema: { requestId },
      annotations: annotations('Approve request'),
      _meta,
    },
    safe(async ({ requestId: id }: { requestId: string }) =>
      decided(
        unwrap(
          await deps.decisionApi.POST('/api/action-requests/{id}/approve', {
            params: { path: { id } },
          }),
        ),
        'Approved',
      ),
    ),
  );

  registerAppTool(
    server,
    'reject_action_request',
    {
      title: 'Reject request',
      description: 'Reject a pending request from its card in Cowork (the user, not Claude).',
      inputSchema: { requestId, reason: z.string().max(1000).optional() },
      annotations: annotations('Reject request'),
      _meta,
    },
    safe(async ({ requestId: id, reason }: { requestId: string; reason?: string }) =>
      decided(
        unwrap(
          await deps.decisionApi.POST('/api/action-requests/{id}/reject', {
            params: { path: { id } },
            body: reason ? { reason } : {},
          }),
        ),
        'Rejected',
      ),
    ),
  );
}
