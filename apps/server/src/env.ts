export interface ServerEnv {
  port: number;
  seed: number;
  agentToken: string;
}

function int(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  return n;
}

export function loadEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const agentToken = source.AGENT_TOKEN;
  if (!agentToken) throw new Error('AGENT_TOKEN is required (see .env.example)');
  return {
    port: int('PORT', source.PORT, 3001),
    seed: int('SEED', source.SEED, 1042),
    agentToken,
  };
}
