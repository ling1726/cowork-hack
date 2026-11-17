import {
  AlertListQuerySchema,
  AlertSchema,
  AlertSummarySchema,
  AllowedAction,
  ResolutionSchema,
  TimelineEventSchema,
  allowedActions,
} from '@app/domain';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { Env } from '../context.ts';
import { ApiError, errorResponses } from '../errors.ts';
import { queryAlerts, relatedAlerts } from '../services/alert-queries.ts';

export const AlertDetailSchema = AlertSchema.extend({
  allowedActions: z.array(AllowedAction),
  pendingActionRequestIds: z.array(z.string()),
});

const IdParam = z.object({ id: z.string() });

const listAlerts = createRoute({
  method: 'get',
  path: '/api/alerts',
  tags: ['alerts'],
  request: { query: AlertListQuerySchema },
  responses: {
    200: {
      description: 'A page of alert summaries',
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(AlertSummarySchema),
            total: z.number().int(),
            page: z.number().int(),
            pageSize: z.number().int(),
          }),
        },
      },
    },
    ...errorResponses(400),
  },
});

const getAlert = createRoute({
  method: 'get',
  path: '/api/alerts/{id}',
  tags: ['alerts'],
  request: { params: IdParam },
  responses: {
    200: {
      description: 'One alert',
      content: { 'application/json': { schema: AlertDetailSchema } },
    },
    ...errorResponses(404),
  },
});

const getTimeline = createRoute({
  method: 'get',
  path: '/api/alerts/{id}/timeline',
  tags: ['alerts'],
  request: { params: IdParam },
  responses: {
    200: {
      description: 'Timeline events, oldest first',
      content: { 'application/json': { schema: z.array(TimelineEventSchema) } },
    },
    ...errorResponses(404),
  },
});

const getRelated = createRoute({
  method: 'get',
  path: '/api/alerts/{id}/related',
  tags: ['alerts'],
  request: {
    params: IdParam,
    query: z.object({ days: z.coerce.number().int().min(1).max(365).default(90) }),
  },
  responses: {
    200: {
      description: 'Alerts sharing the trader, instrument or rule',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              alert: AlertSummarySchema,
              matchedOn: z.array(z.enum(['trader', 'instrument', 'rule'])),
              resolution: ResolutionSchema.optional(),
            }),
          ),
        },
      },
    },
    ...errorResponses(400, 404),
  },
});

export function registerAlertsRead(app: OpenAPIHono<Env>): void {
  const find = (store: Env['Variables']['store'], id: string) => {
    const alert = store.getAlert(id);
    if (!alert) throw new ApiError(404, 'not_found', `Alert ${id} not found`);
    return alert;
  };

  app.openapi(listAlerts, (c) => c.json(queryAlerts(c.get('store'), c.req.valid('query')), 200));

  app.openapi(getAlert, (c) => {
    const store = c.get('store');
    const alert = find(store, c.req.valid('param').id);
    const pendingActionRequestIds = [...store.actionRequests.values()]
      .filter((r) => r.alertId === alert.id && r.status === 'pending')
      .map((r) => r.id)
      .sort();
    return c.json(
      { ...alert, allowedActions: allowedActions(alert), pendingActionRequestIds },
      200,
    );
  });

  app.openapi(getTimeline, (c) => {
    const store = c.get('store');
    return c.json(store.eventsFor(find(store, c.req.valid('param').id).id), 200);
  });

  app.openapi(getRelated, (c) => {
    const store = c.get('store');
    const alert = find(store, c.req.valid('param').id);
    return c.json(relatedAlerts(store, alert, c.req.valid('query').days), 200);
  });
}
