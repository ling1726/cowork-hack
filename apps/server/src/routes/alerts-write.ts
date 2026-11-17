import {
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
import { errorResponses } from '../errors.ts';
import { applyCommand, type Command } from '../services/commands.ts';

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

const bodylessRoute = (path: string, summary: string) =>
  createRoute({
    method: 'post',
    path,
    summary,
    tags: ['alerts'],
    request: { params: IdParam },
    responses,
  });

export const commentRoute = bodyRoute(
  'post',
  '/api/alerts/{id}/comments',
  'Add a comment',
  CommentBody,
);
export const acknowledgeRoute = bodylessRoute(
  '/api/alerts/{id}/acknowledge',
  'Acknowledge an alert',
);
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
  // Human-only until Task 9 routes comments and acknowledge through the agent gate.
  const run = (c: Parameters<typeof requireUser>[0], alertId: string, cmd: Command) => {
    forbidAgent(c);
    const userId = requireUser(c);
    return applyCommand(c.get('store'), alertId, cmd, { userId, via: 'app' });
  };

  app.openapi(commentRoute, (c) =>
    c.json(
      run(c, c.req.valid('param').id, { kind: 'add_comment', body: c.req.valid('json').body }),
      200,
    ),
  );
  app.openapi(acknowledgeRoute, (c) =>
    c.json(run(c, c.req.valid('param').id, { kind: 'acknowledge' }), 200),
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
