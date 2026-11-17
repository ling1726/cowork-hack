export interface ServerEnv {
  port: number;
  seed: number;
  agentToken: string;
  /** Lets the Cowork cards approve or reject (only). Unset: no Cowork path. */
  coworkToken?: string;
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
  const coworkToken = source.COWORK_TOKEN || undefined;
  if (coworkToken === agentToken) throw new Error('AGENT_TOKEN and COWORK_TOKEN must differ');
  return {
    port: int('PORT', source.PORT, 3001),
    seed: int('SEED', source.SEED, 1042),
    agentToken,
    ...(coworkToken ? { coworkToken } : {}),
  };
}
