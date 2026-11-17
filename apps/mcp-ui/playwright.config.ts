import { defineConfig, devices } from '@playwright/test';

const API = 'http://localhost:3001';
const WEB = 'http://localhost:5173';
const MCP = 'http://localhost:3002';
const HOST = 'http://localhost:5174';
const TOKENS = { AGENT_TOKEN: 'test-agent-token', COWORK_TOKEN: 'test-cowork-token' };

// The views end to end: backend + web app + MCP server (serving freshly built views) + the test
// host that stands in for Cowork. One shared in-memory backend, so one test at a time.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: HOST, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @app/server start',
      url: `${API}/api/users`,
      env: { ...TOKENS, PORT: '3001' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @app/web dev',
      url: WEB,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @app/mcp-ui build && pnpm --filter @app/mcp-server start',
      url: `${MCP}/health`,
      env: {
        ...TOKENS,
        MCP_PORT: '3002',
        ACTING_USER_ID: 'U-01',
        API_BASE_URL: API,
        APP_BASE_URL: WEB,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm exec vite --config test-host/vite.config.ts',
      url: HOST,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
