import { createApiClient } from '@app/api-client';
import { loadEnv } from './env.ts';
import { startHttp } from './server.ts';

// Transport: the SDK's WebStandardStreamableHTTPServerTransport (present in @modelcontextprotocol/sdk
// 1.32) inside a small Hono app, so @hono/mcp is not needed.
const env = loadEnv();
const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  getUserId: () => env.actingUserId,
  agentToken: env.agentToken,
});

const server = await startHttp({
  port: env.port,
  host: env.host,
  deps: { api, appBaseUrl: env.appBaseUrl, actingUserId: env.actingUserId },
});
console.log(
  `MCP server listening on ${server.url} (acting as ${env.actingUserId}, links to ${env.appBaseUrl})`,
);
