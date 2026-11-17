import type { OpenAPIHono } from '@hono/zod-openapi';
import { createApp } from '../src/app.ts';
import type { Env } from '../src/context.ts';
import { buildSeed } from '../src/seed/index.ts';
import { Store } from '../src/store/store.ts';

export const T0 = new Date('2026-11-17T09:00:00.000Z');
export const AGENT_TOKEN = 'test-agent-token';
export const COWORK_TOKEN = 'test-cowork-token';

/** A mutable clock so tests can advance time. */
export interface Clock {
  now: Date;
}

export function makeApp(start: Date = T0): { app: OpenAPIHono<Env>; store: Store; clock: Clock } {
  const clock: Clock = { now: start };
  const now = () => clock.now;
  const store = new Store(buildSeed({ now: start, seed: 1042 }), now);
  const app = createApp({
    store,
    agentToken: AGENT_TOKEN,
    coworkToken: COWORK_TOKEN,
    now,
    seed: 1042,
  });
  return { app, store, clock };
}

export const asUser = (id: string): Record<string, string> => ({ 'X-User-Id': id });
export const asAgent = (id: string): Record<string, string> => ({
  'X-User-Id': id,
  Authorization: `Bearer ${AGENT_TOKEN}`,
});

/** The demo user acting through a Cowork card (approve/reject only). */
export const asCowork = (id: string): Record<string, string> => ({
  'X-User-Id': id,
  Authorization: `Bearer ${COWORK_TOKEN}`,
});

export async function call(
  app: OpenAPIHono<Env>,
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  return app.request(path, { method, headers, ...(body !== undefined ? { body } : {}) });
}
