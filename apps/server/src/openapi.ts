import { createApp } from './app.ts';
import { buildSeed } from './seed/index.ts';
import { Store } from './store/store.ts';

/** The generated OpenAPI 3.1 document. Deterministic, so it can be committed and diffed. */
export async function openApiDocument(): Promise<unknown> {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const store = new Store(buildSeed({ now, seed: 1042 }), () => now);
  const app = createApp({ store, agentToken: 'openapi-dump', now: () => now, seed: 1042 });
  const res = await app.request('/api/openapi.json');
  return res.json();
}
