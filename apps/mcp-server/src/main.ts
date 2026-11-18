import { createApiClient } from '@app/api-client';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.ts';
import { loadPlaybook } from './playbook.ts';
import { startHttp } from './server.ts';

// Transport: the SDK's WebStandardStreamableHTTPServerTransport (present in @modelcontextprotocol/sdk
// 1.32) inside a small Hono app, so @hono/mcp is not needed.
const env = loadEnv();
const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  getUserId: () => env.actingUserId,
  agentToken: env.agentToken,
});

// Same identity, Cowork token: used only by the app-only approve/reject tools.
const decisionApi = env.coworkToken
  ? createApiClient({
      baseUrl: env.apiBaseUrl,
      getUserId: () => env.actingUserId,
      agentToken: env.coworkToken,
    })
  : undefined;
const uiDir = fileURLToPath(new URL('../../mcp-ui/dist', import.meta.url));
const instructions = loadPlaybook(
  fileURLToPath(new URL('../../../plugin/skills/investigate-alert/SKILL.md', import.meta.url)),
);

const server = await startHttp({
  port: env.port,
  host: env.host,
  allowedHosts: env.allowedHosts,
  ...(instructions ? { instructions } : {}),
  deps: {
    api,
    appBaseUrl: env.appBaseUrl,
    actingUserId: env.actingUserId,
    uiDir,
    ...(decisionApi ? { decisionApi } : {}),
  },
});
console.log(
  `MCP server listening on ${server.url} (acting as ${env.actingUserId}, links to ${env.appBaseUrl})`,
);
