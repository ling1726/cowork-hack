import { expect, test as base } from '@playwright/test';

export const AGENT_TOKEN = 'test-agent-token';

type AgentRequest = (path: string, body?: unknown) => Promise<unknown>;

export const test = base.extend<{ resetBackend: void; agentRequest: AgentRequest }>({
  // Every test starts from the deterministic seed.
  resetBackend: [
    async ({ request }, use) => {
      const res = await request.post('/api/admin/reset');
      expect(res.ok()).toBe(true);
      await use();
    },
    { auto: true },
  ],
  // Calls the API the way Claude does: agent token, acting as U-01.
  agentRequest: async ({ request }, use) => {
    await use(async (path, body) => {
      const res = await request.post(path, {
        headers: { Authorization: `Bearer ${AGENT_TOKEN}`, 'X-User-Id': 'U-01' },
        ...(body !== undefined ? { data: body } : {}),
      });
      return res.json();
    });
  },
});

export { expect };
