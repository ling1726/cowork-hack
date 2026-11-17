import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { Env } from '../context.ts';
import { buildSeed } from '../seed/index.ts';

const reset = createRoute({
  method: 'post',
  path: '/api/admin/reset',
  tags: ['admin'],
  responses: {
    200: {
      description: 'The store was re-seeded',
      content: {
        'application/json': {
          schema: z.object({ status: z.literal('reset'), alerts: z.number() }),
        },
      },
    },
  },
});

export function registerAdmin(
  app: OpenAPIHono<Env>,
  deps: { now: () => Date; seed: number },
): void {
  app.openapi(reset, (c) => {
    const store = c.get('store');
    store.reset(buildSeed({ now: deps.now(), seed: deps.seed }));
    return c.json({ status: 'reset' as const, alerts: store.alerts.size }, 200);
  });
}
