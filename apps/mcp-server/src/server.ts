import { serve } from '@hono/node-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import type { AddressInfo } from 'node:net';
import { registerTools, type McpDeps } from './tools.ts';

export type { McpDeps };

export function createMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: 'alerts', version: '0.1.0' });
  registerTools(server, deps);
  return server;
}

export interface RunningServer {
  port: number;
  /** Full MCP endpoint URL. */
  url: string;
  close(): Promise<void>;
}

/**
 * Streamable HTTP at `/mcp`, stateless: every request gets its own server and transport, so there
 * are no sessions to lose when the process restarts. JSON responses (no SSE) keep it simple.
 */
export async function startHttp(opts: {
  port: number;
  host?: string;
  deps: McpDeps;
}): Promise<RunningServer> {
  const app = new Hono();
  app.get('/health', (c) => c.json({ ok: true }));
  app.all('/mcp', async (c) => {
    const server = createMcpServer(opts.deps);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      await server.close();
    }
  });

  const host = opts.host ?? '127.0.0.1';
  const http = serve({ fetch: app.fetch, port: opts.port, hostname: host });
  await new Promise<void>((resolve, reject) => {
    http.once('listening', () => resolve());
    http.once('error', reject);
  });
  const port = (http.address() as AddressInfo).port;
  return {
    port,
    url: `http://${host === '::' ? 'localhost' : host}:${port}/mcp`,
    close: () => new Promise<void>((resolve) => http.close(() => resolve())),
  };
}
