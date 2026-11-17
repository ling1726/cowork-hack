import {
  ActionRequestSchema,
  ActionRequestStatus,
  AlertSummarySchema,
  TimelineEventSchema,
  csvEnumArray,
} from '@app/domain';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { forbidAgent, requireUser, type Env } from '../context.ts';
import { ApiError, errorResponses } from '../errors.ts';
import { approveRequest, rejectRequest, requestDetail } from '../services/agent-gate.ts';

export const ActionRequestDetailSchema = z.intersection(
  ActionRequestSchema,
  z.object({ alert: AlertSummarySchema, resultEvent: TimelineEventSchema.optional() }),
);

const IdParam = z.object({ id: z.string() });
const detailResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ActionRequestDetailSchema } },
});

const listRoute = createRoute({
  method: 'get',
  path: '/api/action-requests',
  tags: ['action-requests'],
  request: {
    query: z.object({
      status: csvEnumArray(ActionRequestStatus),
      alertId: z.string().optional(),
      onBehalfOf: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Action requests, newest first',
      content: { 'application/json': { schema: z.array(ActionRequestSchema) } },
    },
    ...errorResponses(400),
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/api/action-requests/{id}',
  tags: ['action-requests'],
  request: { params: IdParam },
  responses: { 200: detailResponse('One action request'), ...errorResponses(404) },
});

const approveRoute = createRoute({
  method: 'post',
  path: '/api/action-requests/{id}/approve',
  tags: ['action-requests'],
  summary: 'Approve a pending request (humans only)',
  request: { params: IdParam },
  responses: {
    200: detailResponse('The request after approval, or failed if it no longer applies'),
    ...errorResponses(400, 403, 404, 409),
  },
});

const rejectRoute = createRoute({
  method: 'post',
  path: '/api/action-requests/{id}/reject',
  tags: ['action-requests'],
  summary: 'Reject a pending request (humans only)',
  request: {
    params: IdParam,
    body: {
      required: false,
      content: {
        'application/json': { schema: z.object({ reason: z.string().max(1000).optional() }) },
      },
    },
  },
  responses: { 200: detailResponse('The rejected request'), ...errorResponses(400, 403, 404, 409) },
});

export function registerActionRequests(app: OpenAPIHono<Env>): void {
  app.openapi(listRoute, (c) => {
    const { status, alertId, onBehalfOf } = c.req.valid('query');
    const items = [...c.get('store').actionRequests.values()]
      .filter(
        (r) =>
          (!status || status.includes(r.status)) &&
          (!alertId || r.alertId === alertId) &&
          (!onBehalfOf || r.onBehalfOf === onBehalfOf),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return c.json(items, 200);
  });

  app.openapi(getRoute, (c) => {
    const store = c.get('store');
    const { id } = c.req.valid('param');
    const request = store.actionRequests.get(id);
    if (!request) throw new ApiError(404, 'not_found', `Action request ${id} not found`);
    return c.json(requestDetail(store, request), 200);
  });

  app.openapi(approveRoute, (c) => {
    forbidAgent(c);
    const caller = requireUser(c);
    return c.json(approveRequest(c.get('store'), c.req.valid('param').id, caller), 200);
  });

  app.openapi(rejectRoute, (c) => {
    forbidAgent(c);
    const caller = requireUser(c);
    const reason = c.req.valid('json')?.reason;
    return c.json(rejectRequest(c.get('store'), c.req.valid('param').id, caller, reason), 200);
  });
}
