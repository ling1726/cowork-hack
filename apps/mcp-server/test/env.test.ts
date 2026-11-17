import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.ts';

describe('loadEnv', () => {
  it('applies defaults and requires AGENT_TOKEN', () => {
    expect(loadEnv({ AGENT_TOKEN: 't' })).toEqual({
      port: 3002,
      host: '127.0.0.1',
      apiBaseUrl: 'http://localhost:3001',
      appBaseUrl: 'http://localhost:5173',
      actingUserId: 'U-01',
      agentToken: 't',
      allowedHosts: [],
    });
    expect(() => loadEnv({})).toThrow(/AGENT_TOKEN/);
  });

  it('reads overrides, trims trailing slashes and ignores the API server PORT', () => {
    const env = loadEnv({
      AGENT_TOKEN: 't',
      PORT: '3001',
      MCP_PORT: '4002',
      API_BASE_URL: 'http://api.test/',
      APP_BASE_URL: 'https://demo.example///',
      ACTING_USER_ID: 'U-02',
      HOST: '::',
      ALLOWED_HOSTS: 'demo.tunnel.example, other.example ',
    });
    expect(env).toMatchObject({
      port: 4002,
      host: '::',
      apiBaseUrl: 'http://api.test',
      appBaseUrl: 'https://demo.example',
      actingUserId: 'U-02',
      allowedHosts: ['demo.tunnel.example', 'other.example'],
    });
    expect(() => loadEnv({ AGENT_TOKEN: 't', MCP_PORT: 'abc' })).toThrow(/PORT/);
  });
});
