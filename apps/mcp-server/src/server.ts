import { serve } from '@hono/node-server';
import { getUiCapability } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
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

export interface McpServerOptions {
  /** The client declared MCP Apps support at initialise: offer the Cowork views. */
  ui: boolean;
}

export function createMcpServer(deps: McpDeps, opts: McpServerOptions): McpServer {
  const server = new McpServer({ name: 'alerts', version: '0.1.0' });
  registerTools(server, deps, opts);
  return server;
}

/** Sessions idle this long are closed (the demo runs for minutes; clients re-initialise). */
const SESSION_IDLE_MS = 60 * 60_000;

const jsonRpcError = (code: number, message: string) => ({
  jsonrpc: '2.0' as const,
  error: { code, message },
  id: null,
});

export interface RunningServer {
  port: number;
  /** Full MCP endpoint URL. */
  url: string;
  close(): Promise<void>;
}

/**
 * Streamable HTTP at `/mcp` with in-memory sessions (one McpServer per client). After a restart
 * an old session id gets 404 and the client re-initialises. JSON responses (no SSE) keep it simple.
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
  // Stateful sessions: the client's capabilities arrive only with `initialize`, and they decide
  // whether this session offers the Cowork views and decision tools (see createMcpServer).
  interface Session {
    server: McpServer;
    transport: WebStandardStreamableHTTPServerTransport;
    lastUsed: number;
  }
  const sessions = new Map<string, Session>();
  const closeSession = async (id: string) => {
    const session = sessions.get(id);
    if (!session) return;
    sessions.delete(id);
    await session.server.close();
  };
  const sweep = setInterval(() => {
    const cutoff = Date.now() - SESSION_IDLE_MS;
    for (const [id, s] of sessions) if (s.lastUsed < cutoff) void closeSession(id);
  }, 60_000);
  sweep.unref();

  app.all('/mcp', async (c) => {
    const sessionId = c.req.header('mcp-session-id');
    if (sessionId !== undefined) {
      const session = sessions.get(sessionId);
      if (!session) return c.json(jsonRpcError(-32001, 'Session not found'), 404);
      session.lastUsed = Date.now();
      return session.transport.handleRequest(c.req.raw);
    }

    if (c.req.method !== 'POST') {
      return c.json(jsonRpcError(-32000, 'Bad Request: no session'), 400);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(jsonRpcError(-32700, 'Parse error'), 400);
    }
    if (!isInitializeRequest(body)) {
      return c.json(jsonRpcError(-32000, 'Bad Request: no session'), 400);
    }

    const ui = getUiCapability(body.params.capabilities) !== undefined;
    const server = createMcpServer(opts.deps, { ui });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport, lastUsed: Date.now() });
      },
      onsessionclosed: (id) => {
        void closeSession(id);
      },
    });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw, { parsedBody: body });
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
    close: async () => {
      clearInterval(sweep);
      await Promise.all([...sessions.keys()].map((id) => closeSession(id)));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
