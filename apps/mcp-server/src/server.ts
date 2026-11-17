import { serve } from '@hono/node-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import type { AddressInfo } from 'node:net';
import { registerTools, type McpDeps } from './tools.ts';

export type { McpDeps };

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** `host:port` or `[::1]:port` to the lower-case host name without the port. */
function hostnameOf(hostHeader: string): string {
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0] ?? '';
}

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
  /** Host names accepted besides loopback (for example a tunnel hostname). */
  allowedHosts?: string[];
}): Promise<RunningServer> {
  const allowed = new Set([
    ...LOOPBACK_HOSTS,
    ...(opts.allowedHosts ?? []).map((h) => h.toLowerCase()),
  ]);
  const app = new Hono();
  // DNS-rebinding protection: a web page can point its own domain at 127.0.0.1 and talk to this
  // server. Such requests carry the page's domain in Host (and a browser Origin), so only
  // loopback names, plus any explicitly allowed host, are served.
  app.use('*', async (c, next) => {
    const host = c.req.header('Host');
    if (!host || !allowed.has(hostnameOf(host))) return c.json({ error: 'forbidden host' }, 403);
    const origin = c.req.header('Origin');
    if (origin !== undefined) {
      let originHost = '';
      try {
        originHost = hostnameOf(new URL(origin).host);
      } catch {
        // "null" and other opaque origins are not local pages
      }
      if (!allowed.has(originHost)) return c.json({ error: 'forbidden origin' }, 403);
    }
    await next();
  });
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
