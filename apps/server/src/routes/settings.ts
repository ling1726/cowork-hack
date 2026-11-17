import { UserSettingsSchema } from '@app/domain';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { forbidAgent, requireUser, type Env } from '../context.ts';
import { ApiError, errorResponses } from '../errors.ts';

const IdParam = z.object({ id: z.string() });
const settingsResponse = {
  description: 'The user settings',
  content: { 'application/json': { schema: UserSettingsSchema } },
};

const getRoute = createRoute({
  method: 'get',
  path: '/api/users/{id}/settings',
  tags: ['users'],
  request: { params: IdParam },
  responses: { 200: settingsResponse, ...errorResponses(404) },
});

const putRoute = createRoute({
  method: 'put',
  path: '/api/users/{id}/settings',
  tags: ['users'],
  summary: 'Change settings (humans only, own settings only)',
  request: {
    params: IdParam,
    body: { required: true, content: { 'application/json': { schema: UserSettingsSchema } } },
  },
  responses: { 200: settingsResponse, ...errorResponses(400, 403, 404) },
});

export function registerSettings(app: OpenAPIHono<Env>): void {
  app.openapi(getRoute, (c) => {
    const store = c.get('store');
    const { id } = c.req.valid('param');
    if (!store.users.has(id)) throw new ApiError(404, 'not_found', `User ${id} not found`);
    return c.json(store.settingsFor(id), 200);
  });

  app.openapi(putRoute, (c) => {
    forbidAgent(c);
    const caller = requireUser(c);
    const store = c.get('store');
    const { id } = c.req.valid('param');
    if (!store.users.has(id)) throw new ApiError(404, 'not_found', `User ${id} not found`);
    if (caller !== id)
      throw new ApiError(403, 'not_owner', 'You can only change your own settings');
    const settings = c.req.valid('json');
    store.settings.set(id, settings);
    return c.json(settings, 200);
  });
}
