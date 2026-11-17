import {
  ActionRequestSchema,
  AgentRationale,
  AlertSchema,
  AssigneesBody,
  CloseBody,
  CommentBody,
  EscalateBody,
  LinkBody,
  ReopenBody,
  TimelineEventSchema,
} from '@app/domain';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { forbidAgent, requireUser, type Env } from '../context.ts';
import { submitOrApply } from '../services/agent-gate.ts';
import { errorResponses } from '../errors.ts';
import { applyCommand, type Command } from '../services/commands.ts';
import type { GateCommand, GateResult } from '../services/agent-gate.ts';

export const WriteResultSchema = z.object({ alert: AlertSchema, event: TimelineEventSchema });
const IdParam = z.object({ id: z.string() });

const jsonBody = <S extends z.ZodType>(schema: S) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const responses = {
  200: {
    description: 'The updated alert and the timeline event it produced',
    content: { 'application/json': { schema: WriteResultSchema } },
  },
  ...errorResponses(400, 403, 404, 409),
};

const bodyRoute = <S extends z.ZodType>(
  method: 'post' | 'put',
  path: string,
  summary: string,
  body: S,
) =>
  createRoute({
    method,
    path,
    summary,
    tags: ['alerts'],
    request: { params: IdParam, body: jsonBody(body) },
    responses,
  });

const GateResponses = {
  200: responses[200],
  202: {
    description: 'Claude request queued for approval in the app',
    content: { 'application/json': { schema: z.object({ actionRequest: ActionRequestSchema }) } },
  },
  ...errorResponses(400, 403, 404, 409),
};
const optionalRationale = AgentRationale.shape.rationale.optional();

export const commentRoute = createRoute({
  method: 'post',
  path: '/api/alerts/{id}/comments',
  summary: 'Add a comment (Claude: queued for approval unless the user turned that off)',
  tags: ['alerts'],
  request: {
    params: IdParam,
    body: jsonBody(CommentBody.extend({ rationale: optionalRationale })),
  },
  responses: GateResponses,
});
export const acknowledgeRoute = createRoute({
  method: 'post',
  path: '/api/alerts/{id}/acknowledge',
  summary: 'Acknowledge an alert (Claude: queued for approval unless the user turned that off)',
  tags: ['alerts'],
  request: {
    params: IdParam,
    body: {
      required: false,
      content: { 'application/json': { schema: z.object({ rationale: optionalRationale }) } },
    },
  },
  responses: GateResponses,
});
const closeRoute = bodyRoute('post', '/api/alerts/{id}/close', 'Close an alert', CloseBody);
const reopenRoute = bodyRoute(
  'post',
  '/api/alerts/{id}/reopen',
  'Reopen a closed alert',
  ReopenBody,
);
const escalateRoute = bodyRoute(
  'post',
  '/api/alerts/{id}/escalations',
  'Escalate an alert',
  EscalateBody,
);
const assigneesRoute = bodyRoute(
  'put',
  '/api/alerts/{id}/assignees',
  'Edit assignees',
  AssigneesBody,
);
const linkRoute = bodyRoute('post', '/api/alerts/{id}/links', 'Add a link', LinkBody);

export function registerAlertsWrite(app: OpenAPIHono<Env>): void {
  // Everything except comments and acknowledge is human-only.
  const run = (c: Parameters<typeof requireUser>[0], alertId: string, cmd: Command) => {
    forbidAgent(c);
    const userId = requireUser(c);
    return applyCommand(c.get('store'), alertId, cmd, { userId, via: 'app' });
  };

  const gate = (c: Parameters<typeof requireUser>[0], cmd: GateCommand, rationale?: string) => {
    const userId = requireUser(c);
    const { via } = c.get('ctx');
    return submitOrApply(c.get('store'), c.req.param('id') ?? '', cmd, { userId, via }, rationale);
  };
  const respond = (c: { json: (body: unknown, status: 200 | 202) => Response }, r: GateResult) =>
    r.kind === 'queued'
      ? c.json({ actionRequest: r.actionRequest }, 202)
      : c.json({ alert: r.alert, event: r.event }, 200);

  app.openapi(commentRoute, (c) => {
    const { body, rationale } = c.req.valid('json');
    return respond(c, gate(c, { kind: 'add_comment', body }, rationale)) as never;
  });
  app.openapi(
    acknowledgeRoute,
    (c) => respond(c, gate(c, { kind: 'acknowledge' }, c.req.valid('json')?.rationale)) as never,
  );
  app.openapi(closeRoute, (c) =>
    c.json(run(c, c.req.valid('param').id, { kind: 'close', ...c.req.valid('json') }), 200),
  );
  app.openapi(reopenRoute, (c) =>
    c.json(run(c, c.req.valid('param').id, { kind: 'reopen', ...c.req.valid('json') }), 200),
  );
  app.openapi(escalateRoute, (c) =>
    c.json(run(c, c.req.valid('param').id, { kind: 'escalate', ...c.req.valid('json') }), 200),
  );
  app.openapi(assigneesRoute, (c) =>
    c.json(run(c, c.req.valid('param').id, { kind: 'set_assignees', ...c.req.valid('json') }), 200),
  );
  app.openapi(linkRoute, (c) =>
    c.json(run(c, c.req.valid('param').id, { kind: 'add_link', ...c.req.valid('json') }), 200),
  );
}
