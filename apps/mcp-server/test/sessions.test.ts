import { createApiClient } from '@app/api-client';
import { serve } from '@hono/node-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AGENT_TOKEN, makeApp } from '../../server/test/helpers.ts';
import { startHttp } from '../src/server.ts';

export const UI_CAPABILITIES = {
  extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } },
};

let mcpUrl: string;
let stopBackend: () => void;
let stopMcp: () => Promise<void>;

beforeAll(async () => {
  const { app } = makeApp();
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  const backendUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  stopBackend = () => server.close();
  const api = createApiClient({
    baseUrl: backendUrl,
    getUserId: () => 'U-01',
    agentToken: AGENT_TOKEN,
  });
  const mcp = await startHttp({
    port: 0,
    deps: { api, appBaseUrl: 'http://localhost:5173', actingUserId: 'U-01' },
  });
  mcpUrl = mcp.url;
  stopMcp = mcp.close;
});

afterAll(async () => {
  await stopMcp();
  stopBackend();
});

const rpc = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(body),
  });

async function connect(capabilities: Record<string, unknown> = {}) {
  const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  await client.connect(transport);
  return { client, transport };
}

describe('sessions', () => {
  it('a client keeps one session across calls', async () => {
    const { client, transport } = await connect();
    const id = transport.sessionId;
    expect(id).toBeTruthy();
    expect((await client.callTool({ name: 'list_users', arguments: {} })).isError).toBeFalsy();
    expect((await client.callTool({ name: 'list_users', arguments: {} })).isError).toBeFalsy();
    expect(transport.sessionId).toBe(id);
    await client.close();
  });

  it('an unknown session id gets 404', async () => {
    const r = await rpc(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { 'mcp-session-id': 'nope', 'mcp-protocol-version': '2025-06-18' },
    );
    expect(r.status).toBe(404);
  });

  it('a non-initialize request without a session gets 400', async () => {
    const r = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(r.status).toBe(400);
  });

  it('DELETE ends the session', async () => {
    const { client, transport } = await connect();
    const id = transport.sessionId!;
    await transport.terminateSession();
    const r = await rpc(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { 'mcp-session-id': id, 'mcp-protocol-version': '2025-06-18' },
    );
    expect(r.status).toBe(404);
    await client.close();
  });

  it('a client that declares MCP Apps support connects and lists the phase 1 tools', async () => {
    const { client } = await connect(UI_CAPABILITIES);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(8);
    await client.close();
  });
});
