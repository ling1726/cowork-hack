import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const VIEWS = ['alert-list', 'alert-card', 'action-request'];
const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url));

rmSync(fileURLToPath(new URL('../dist', import.meta.url)), { recursive: true, force: true });
for (const view of VIEWS) {
  process.env.VIEW = view;
  await build({ configFile, logLevel: 'warn' });
}
console.log(`Built ${VIEWS.length} MCP App views into apps/mcp-ui/dist`);
