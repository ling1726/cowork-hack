import {
  ACTION_REQUEST_KIND_LABELS,
  ACTION_REQUEST_STATUS_LABELS,
  ALERT_SORT_LABELS,
  ALERT_STATUS_LABELS,
  ALERT_TAB_LABELS,
  CATEGORY_LABELS,
  DESK_LABELS,
  RESOLUTION_OUTCOME_LABELS,
  SEVERITY_LABELS,
  USER_ROLE_LABELS,
} from '@app/domain';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { Env } from '../context.ts';

const Option = z.object({ value: z.string(), label: z.string() });
const MetaSchema = z.object({
  statuses: z.array(Option),
  severities: z.array(Option),
  categories: z.array(Option),
  desks: z.array(Option),
  roles: z.array(Option),
  outcomes: z.array(Option),
  actionRequestKinds: z.array(Option),
  actionRequestStatuses: z.array(Option),
  tabs: z.array(Option),
  sorts: z.array(Option),
  rules: z.array(z.object({ id: z.string(), name: z.string() })),
  traders: z.array(z.object({ id: z.string(), name: z.string() })),
});

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const getMeta = createRoute({
  method: 'get',
  path: '/api/meta',
  tags: ['meta'],
  responses: {
    200: {
      description: 'Enum values and filter options',
      content: { 'application/json': { schema: MetaSchema } },
    },
  },
});

export function registerMeta(app: OpenAPIHono<Env>): void {
  app.openapi(getMeta, (c) => {
    const rules = new Map<string, string>();
    const traders = new Map<string, string>();
    for (const a of c.get('store').alerts.values()) {
      rules.set(a.rule.id, a.rule.name);
      traders.set(a.trader.id, a.trader.name);
    }
    const sorted = (m: Map<string, string>) =>
      [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, name]) => ({ id, name }));
    return c.json(
      {
        statuses: options(ALERT_STATUS_LABELS),
        severities: options(SEVERITY_LABELS),
        categories: options(CATEGORY_LABELS),
        desks: options(DESK_LABELS),
        roles: options(USER_ROLE_LABELS),
        outcomes: options(RESOLUTION_OUTCOME_LABELS),
        actionRequestKinds: options(ACTION_REQUEST_KIND_LABELS),
        actionRequestStatuses: options(ACTION_REQUEST_STATUS_LABELS),
        tabs: options(ALERT_TAB_LABELS),
        sorts: options(ALERT_SORT_LABELS),
        rules: sorted(rules),
        traders: sorted(traders),
      },
      200,
    );
  });
}
