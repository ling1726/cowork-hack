import { defineConfig, devices } from '@playwright/test';

const API = 'http://localhost:3001';
const WEB = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  // All tests share one in-memory backend, so they run one at a time. Each starts with a reset.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: WEB, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @app/server start',
      url: `${API}/api/users`,
      env: { AGENT_TOKEN: 'test-agent-token', COWORK_TOKEN: 'test-cowork-token', PORT: '3001' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec vite --port 5173 --strictPort',
      url: WEB,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
