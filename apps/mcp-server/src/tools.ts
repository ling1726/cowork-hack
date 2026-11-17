import { ApiRequestError, unwrap, type ApiClient } from '@app/api-client';
import {
  ACTION_REQUEST_KIND_LABELS,
  AlertSort,
  AlertStatus,
  Category,
  Desk,
  Severity,
  actionRequestUrl,
  alertListUrl,
  alertUrl,
  type AlertListSearch,
} from '@app/domain';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  alertText,
  eventText,
  namesOf,
  pendingText,
  summaryLine,
  userLine,
  type Names,
} from './format.ts';

export interface McpDeps {
  api: ApiClient;
  /** Origin of the web app; the single source of every link in tool results. */
  appBaseUrl: string;
  /** The user Claude acts for (also what the API client sends as X-User-Id). */
  actingUserId: string;
}

const ok = (text: string, structuredContent: Record<string, unknown>): CallToolResult => ({
  content: [{ type: 'text', text }],
  structuredContent,
});

const failure = (text: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text }],
});

/** Backend errors become tool errors the model can read and act on, not protocol failures. */
function safe<A>(handler: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await handler(args);
    } catch (e) {
      if (e instanceof ApiRequestError) return failure(`Error (${e.code}): ${e.message}`);
      throw e;
    }
  };
}

const alertId = z.string().min(1).describe('Alert id, for example ALT-1042');
const rationale = z
  .string()
  .min(1)
  .max(1000)
  .describe(
    'One to three sentences on why Claude recommends this. Shown to the user when they approve.',
  );

const SearchInput = {
  status: z.array(AlertStatus).optional().describe('Match any of these statuses'),
  severity: z.array(Severity).optional().describe('Match any of these severities'),
  category: z.array(Category).optional().describe('Match any of these categories'),
  desk: z.array(Desk).optional().describe('Match any of these desks, for example eu-equities'),
  assigneeId: z
    .string()
    .optional()
    .describe('User id who is primary, backup or escalated assignee'),
  traderId: z.string().optional().describe('Trader id, for example T-0412'),
  instrument: z.string().optional().describe('Instrument symbol, for example SAP GY'),
  from: z.iso.date().optional().describe('Created on or after this date (YYYY-MM-DD)'),
  to: z.iso.date().optional().describe('Created on or before this date (YYYY-MM-DD)'),
  updatedFrom: z.iso.datetime().optional().describe('Updated at or after this instant (ISO 8601)'),
  updatedTo: z.iso.datetime().optional().describe('Updated at or before this instant (ISO 8601)'),
  involvedUserId: z
    .string()
    .optional()
    .describe('User is an assignee or acted on the alert timeline (use for shift handovers)'),
  q: z
    .string()
    .optional()
    .describe('Free text over title, summary, description, trader, instrument, rule and comments'),
  sort: AlertSort.optional().describe(
    'Defaults to relevance when q is set, otherwise newest first',
  ),
  limit: z.number().int().min(1).max(25).default(10).describe('How many alerts to return (max 25)'),
};

/** Filters the web app can show; anything else means there is no matching app link. */
const APP_FILTERS = [
  'status',
  'severity',
  'category',
  'desk',
  'assigneeId',
  'traderId',
  'instrument',
  'from',
  'to',
  'q',
  'sort',
] as const;
const NOT_IN_APP = ['updatedFrom', 'updatedTo', 'involvedUserId'] as const;

/** `opts.ui`: the client renders MCP Apps (wired up in ui.ts). */
export function registerTools(server: McpServer, deps: McpDeps, _opts: { ui: boolean }): void {
  const { api, appBaseUrl: base } = deps;

  const users = async () => unwrap(await api.GET('/api/users'));
  const names = async (): Promise<Names> => namesOf(await users());
  const timelineUrl = (id: string) => alertUrl(base, id, { tab: 'timeline' });

  server.registerTool(
    'search_alerts',
    {
      title: 'Search alerts',
      description:
        'Find alerts with structured filters and free text. Returns the top matches, the total, and a link that opens the same search in the app.',
      inputSchema: SearchInput,
      annotations: { title: 'Search alerts', readOnlyHint: true, openWorldHint: false },
    },
    safe(async (input) => {
      const { limit, ...filters } = input;
      const result = unwrap(
        await api.GET('/api/alerts', {
          params: { query: { ...filters, page: 1, pageSize: limit } },
        }),
      );
      const items = result.items.map((a) => ({ ...a, url: alertUrl(base, a.id) }));
      const appSearch: Record<string, unknown> = {};
      for (const key of APP_FILTERS) if (filters[key] !== undefined) appSearch[key] = filters[key];
      const representable = NOT_IN_APP.every((k) => filters[k] === undefined);
      const listUrl = representable ? alertListUrl(base, appSearch as AlertListSearch) : undefined;

      const lines = [
        `Found ${result.total} alert${result.total === 1 ? '' : 's'}${result.total > items.length ? ` (showing the first ${items.length})` : ''}.`,
        ...items.map((a, i) => `${i + 1}. ${summaryLine(a, a.url)}`),
        listUrl
          ? `Open this search in the app: ${listUrl}`
          : 'The app cannot show this exact search (it filters on activity or update time), so link the individual alerts.',
      ];
      return ok(lines.join('\n'), {
        items,
        total: result.total,
        ...(listUrl ? { listUrl } : {}),
      });
    }),
  );

  server.registerTool(
    'get_alert',
    {
      title: 'Get alert',
      description:
        'Full alert: summary, rule indicators and thresholds, highlights, data tabs, assignees and which actions are allowed.',
      inputSchema: { alertId },
      annotations: { title: 'Get alert', readOnlyHint: true, openWorldHint: false },
    },
    safe(async ({ alertId: id }) => {
      const alert = unwrap(await api.GET('/api/alerts/{id}', { params: { path: { id } } }));
      const url = alertUrl(base, id);
      const tabUrls = {
        overview: url,
        timeline: alertUrl(base, id, { tab: 'timeline' }),
        materials: alertUrl(base, id, { tab: 'materials' }),
        data: alertUrl(base, id, { tab: 'data' }),
      };
      return ok(alertText(alert, url, tabUrls, await names()), { alert, url, tabUrls });
    }),
  );

  server.registerTool(
    'get_alert_timeline',
    {
      title: 'Get alert timeline',
      description:
        'Everything that happened on an alert, oldest first, with who did it and whether Claude was involved.',
      inputSchema: { alertId },
      annotations: { title: 'Get alert timeline', readOnlyHint: true, openWorldHint: false },
    },
    safe(async ({ alertId: id }) => {
      const [events, name] = await Promise.all([
        api.GET('/api/alerts/{id}/timeline', { params: { path: { id } } }).then(unwrap),
        names(),
      ]);
      const url = timelineUrl(id);
      const resolved = events.map((e) => ({
        ...e,
        actorName: name(e.actorId),
        ...(e.approvedBy ? { approvedByName: name(e.approvedBy) } : {}),
      }));
      return ok(
        [
          `Timeline for ${id}:`,
          ...events.map((e) => eventText(e, name)),
          `Open in the app: ${url}`,
        ].join('\n'),
        {
          alertId: id,
          url,
          events: resolved,
        },
      );
    }),
  );

  server.registerTool(
    'find_related_alerts',
    {
      title: 'Find related alerts',
      description:
        'Other alerts that share the trader, instrument or rule, with how they matched and how they were resolved.',
      inputSchema: {
        alertId,
        days: z.number().int().min(1).max(365).default(90).describe('Look back this many days'),
      },
      annotations: { title: 'Find related alerts', readOnlyHint: true, openWorldHint: false },
    },
    safe(async ({ alertId: id, days }) => {
      const [related, name] = await Promise.all([
        api
          .GET('/api/alerts/{id}/related', { params: { path: { id }, query: { days } } })
          .then(unwrap),
        names(),
      ]);
      const items = related.map((r) => ({ ...r, url: alertUrl(base, r.alert.id) }));
      const lines = items.map(
        (r, i) =>
          `${i + 1}. ${summaryLine(r.alert, r.url)} — matched on ${r.matchedOn.join(', ')}` +
          (r.resolution
            ? `; closed ${r.resolution.outcome} by ${name(r.resolution.closedBy)}: "${r.resolution.note}"`
            : ''),
      );
      return ok(
        [
          `${items.length} related alert${items.length === 1 ? '' : 's'} for ${id} in the last ${days} days.`,
          ...lines,
        ].join('\n'),
        { alertId: id, days, related: items },
      );
    }),
  );

  server.registerTool(
    'list_users',
    {
      title: 'List users',
      description:
        'The people on the surveillance team and their roles, for choosing escalation targets.',
      annotations: { title: 'List users', readOnlyHint: true, openWorldHint: false },
    },
    safe(async () => {
      const all = await users();
      return ok(all.map((u) => userLine(u, u.id === deps.actingUserId)).join('\n'), {
        users: all,
        actingUserId: deps.actingUserId,
      });
    }),
  );

  const writeResult = async (
    data: { actionRequest: { id: string; onBehalfOf: string } } | { event: unknown },
    id: string,
    applied: string,
  ): Promise<CallToolResult> => {
    if ('actionRequest' in data) {
      const approveUrl = actionRequestUrl(base, data.actionRequest.id);
      const name = (await names())(data.actionRequest.onBehalfOf);
      return ok(pendingText(name, approveUrl), {
        status: 'pending_approval',
        requestId: data.actionRequest.id,
        approveUrl,
      });
    }
    const url = timelineUrl(id);
    return ok(
      `${applied} (applied immediately because approval is switched off for this user). ${url}`,
      {
        status: 'applied',
        event: data.event,
        url,
      },
    );
  };

  server.registerTool(
    'add_comment',
    {
      title: 'Add a comment',
      description:
        'Ask to post a comment on an alert. The comment is queued and only appears after the user approves it in the app.',
      inputSchema: {
        alertId,
        body: z.string().min(1).max(5000).describe('The comment text'),
        rationale,
      },
      annotations: {
        title: 'Add a comment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    safe(async ({ alertId: id, body, rationale: why }) =>
      writeResult(
        unwrap(
          await api.POST('/api/alerts/{id}/comments', {
            params: { path: { id } },
            body: { body, rationale: why },
          }),
        ),
        id,
        `Comment added to ${id}`,
      ),
    ),
  );

  server.registerTool(
    'acknowledge_alert',
    {
      title: 'Acknowledge an alert',
      description:
        'Ask to take an open alert into In Progress. The request is queued and only takes effect after the user approves it in the app.',
      inputSchema: { alertId, rationale },
      annotations: {
        title: 'Acknowledge an alert',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    safe(async ({ alertId: id, rationale: why }) =>
      writeResult(
        unwrap(
          await api.POST('/api/alerts/{id}/acknowledge', {
            params: { path: { id } },
            body: { rationale: why },
          }),
        ),
        id,
        `${id} acknowledged and is now In Progress`,
      ),
    ),
  );

  server.registerTool(
    'get_action_request',
    {
      title: 'Get action request',
      description:
        'Status of a request Claude submitted: pending, approved (with the resulting event), rejected (with the reason) or failed (with the cause).',
      inputSchema: { requestId: z.string().min(1).describe('Request id, for example AR-0001') },
      annotations: { title: 'Get action request', readOnlyHint: true, openWorldHint: false },
    },
    safe(async ({ requestId }) => {
      const [request, name] = await Promise.all([
        api.GET('/api/action-requests/{id}', { params: { path: { id: requestId } } }).then(unwrap),
        names(),
      ]);
      const approveUrl = actionRequestUrl(base, requestId);
      const url = alertUrl(base, request.alertId, {
        tab: request.status === 'approved' ? 'timeline' : 'overview',
      });
      const label = `Request ${request.id} (${ACTION_REQUEST_KIND_LABELS[request.kind]} on ${request.alertId})`;
      const lines: string[] = [];
      switch (request.status) {
        case 'pending':
          lines.push(`${label} is pending. ${pendingText(name(request.onBehalfOf), approveUrl)}`);
          break;
        case 'approved':
          lines.push(
            `${label} was approved by ${name(request.decidedBy ?? request.onBehalfOf)}. See ${url}`,
          );
          break;
        case 'rejected':
          lines.push(
            `${label} was rejected by ${name(request.decidedBy ?? request.onBehalfOf)}${request.rejectReason ? `. Reason: ${request.rejectReason}` : ' (no reason given)'}.`,
          );
          break;
        case 'failed':
          lines.push(
            `${label} could not be applied: ${request.failure?.message ?? 'unknown reason'}.`,
          );
          break;
      }
      return ok(lines.join('\n'), { request, url, approveUrl });
    }),
  );
}
