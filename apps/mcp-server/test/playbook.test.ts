import { createApiClient } from '@app/api-client';
import { serve } from '@hono/node-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AGENT_TOKEN, makeApp } from '../../server/test/helpers.ts';
import { loadPlaybook } from '../src/playbook.ts';
import { startHttp } from '../src/server.ts';

const SKILL = fileURLToPath(
  new URL('../../../plugin/skills/investigate-alert/SKILL.md', import.meta.url),
);

let backendUrl: string;
const stops: Array<() => unknown> = [];

beforeAll(async () => {
  const { app } = makeApp();
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  backendUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  stops.push(() => server.close());
});

afterAll(async () => {
  for (const stop of stops.reverse()) await stop();
});

async function plainClient(instructions?: string) {
  const api = createApiClient({
    baseUrl: backendUrl,
    getUserId: () => 'U-01',
    agentToken: AGENT_TOKEN,
  });
  const mcp = await startHttp({
    port: 0,
    deps: { api, appBaseUrl: 'http://localhost:5173', actingUserId: 'U-01' },
    ...(instructions !== undefined ? { instructions } : {}),
  });
  stops.push(mcp.close);
  const client = new Client({ name: 'plain', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcp.url)));
  stops.push(() => client.close());
  return client;
}

describe('playbook', () => {
  it('loadPlaybook strips the front matter', () => {
    const body = loadPlaybook(SKILL)!;
    expect(body.startsWith('# Investigate an alert')).toBe(true);
    expect(body).not.toContain('name: investigate-alert');
  });

  it('loadPlaybook returns undefined for a missing file', () => {
    expect(loadPlaybook('/nope/SKILL.md')).toBeUndefined();
  });

  it('instructions carry the playbook body without front matter', async () => {
    const client = await plainClient(loadPlaybook(SKILL));
    expect(client.getInstructions()?.startsWith('# Investigate an alert')).toBe(true);
  });

  it('without instructions the server still starts', async () => {
    const client = await plainClient();
    expect(client.getInstructions()).toBeUndefined();
    expect((await client.listTools()).tools).toHaveLength(8);
  });
});
