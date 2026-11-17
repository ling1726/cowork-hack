import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadEnv } from './env.ts';
import { buildSeed } from './seed/index.ts';
import { Store } from './store/store.ts';

const env = loadEnv();
const now = () => new Date();
const store = new Store(buildSeed({ now: now(), seed: env.seed }), now);
const app = createApp({
  store,
  agentToken: env.agentToken,
  ...(env.coworkToken ? { coworkToken: env.coworkToken } : {}),
  now,
  seed: env.seed,
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`Alerts API listening on http://localhost:${info.port}/api`);
});
