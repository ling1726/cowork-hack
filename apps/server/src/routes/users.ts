import { UserSchema } from '@app/domain';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { Env } from '../context.ts';

const listUsers = createRoute({
  method: 'get',
  path: '/api/users',
  tags: ['users'],
  responses: {
    200: {
      description: 'All users',
      content: { 'application/json': { schema: z.array(UserSchema) } },
    },
  },
});

export function registerUsers(app: OpenAPIHono<Env>): void {
  app.openapi(listUsers, (c) => c.json([...c.get('store').users.values()], 200));
}
