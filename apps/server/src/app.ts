import { OpenAPIHono } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { contextMiddleware, type Env } from './context.ts';
import { ApiError, errorBody } from './errors.ts';
import { registerActionRequests } from './routes/action-requests.ts';
import { registerAdmin } from './routes/admin.ts';
import { registerAlertsRead } from './routes/alerts-read.ts';
import { registerAlertsWrite } from './routes/alerts-write.ts';
import { registerAttachments } from './routes/attachments.ts';
import { registerMeta } from './routes/meta.ts';
import { registerSettings } from './routes/settings.ts';
import { registerUsers } from './routes/users.ts';
import type { Store } from './store/store.ts';

export interface AppOptions {
  store: Store;
  agentToken: string;
  now?: () => Date;
  seed?: number;
}

export function createApp(opts: AppOptions): OpenAPIHono<Env> {
  const now = opts.now ?? (() => new Date());
  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorBody('validation_error', 'Request validation failed', result.error.issues),
          400,
        );
      }
    },
  });

  app.use('/api/*', contextMiddleware(opts.store, opts.agentToken));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        errorBody(err.code, err.message, err.details),
        err.status as ContentfulStatusCode,
      );
    }
    console.error(err);
    return c.json(errorBody('internal_error', 'Unexpected server error'), 500);
  });
  app.notFound((c) =>
    c.json(errorBody('not_found', `No route for ${c.req.method} ${c.req.path}`), 404),
  );

  registerUsers(app);
  registerMeta(app);
  registerAlertsRead(app);
  registerAlertsWrite(app);
  registerAttachments(app);
  registerActionRequests(app);
  registerSettings(app);
  registerAdmin(app, { now, seed: opts.seed ?? 1042 });

  app.doc31('/api/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Alerts case management API', version: '0.1.0' },
  });
  return app;
}
