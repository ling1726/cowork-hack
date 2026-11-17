export interface McpEnv {
  port: number;
  host: string;
  apiBaseUrl: string;
  appBaseUrl: string;
  actingUserId: string;
  agentToken: string;
  /** Extra Host names to accept besides loopback, e.g. a tunnel's hostname. */
  allowedHosts: string[];
}

function port(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 3002;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535)
    throw new Error(`PORT must be a port number, got "${raw}"`);
  return n;
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export function loadEnv(source: Record<string, string | undefined> = process.env): McpEnv {
  const agentToken = source.AGENT_TOKEN;
  if (!agentToken) throw new Error('AGENT_TOKEN is required (see .env.example)');
  return {
    // MCP_PORT, so a shared PORT in .env cannot collide with the API server's.
    port: port(source.MCP_PORT),
    // Loopback only by default: this server acts as the demo user. Set HOST=:: to listen everywhere.
    host: source.HOST || '127.0.0.1',
    apiBaseUrl: trimSlash(source.API_BASE_URL || 'http://localhost:3001'),
    appBaseUrl: trimSlash(source.APP_BASE_URL || 'http://localhost:5173'),
    actingUserId: source.ACTING_USER_ID || 'U-01',
    agentToken,
    allowedHosts: (source.ALLOWED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
  };
}
