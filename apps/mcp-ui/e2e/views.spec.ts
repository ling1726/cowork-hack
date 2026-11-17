import { expect, test as base, type Page } from '@playwright/test';

const API = 'http://localhost:3001';
const WEB = 'http://localhost:5173';

const test = base.extend<{ reset: void }>({
  reset: [
    async ({ request }, use) => {
      expect((await request.post(`${API}/api/admin/reset`)).ok()).toBe(true);
      await use();
    },
    { auto: true },
  ],
});

type HostLogEntry = { type: string; value: string };
const hostLog = (page: Page) =>
  page.evaluate(() => (window as unknown as { __hostLog: HostLogEntry[] }).__hostLog);
const show = (page: Page, tool: string, args: Record<string, unknown>, theme = 'light') =>
  page.goto(`/?tool=${tool}&args=${encodeURIComponent(JSON.stringify(args))}&theme=${theme}`);
const view = (page: Page) => page.frameLocator('iframe');

test('the list renders the W1 alerts and Investigate asks Claude', async ({ page }) => {
  await show(page, 'search_alerts', {
    status: ['open'],
    severity: ['high'],
    desk: ['eu-equities'],
  });
  const row = view(page).getByRole('row').filter({ hasText: 'ALT-1042' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Investigate' }).click();
  await expect
    .poll(() => hostLog(page))
    .toContainEqual({
      type: 'message',
      value: 'Investigate ALT-1042',
    });
});

test('the alert card renders ALT-1042 and opens the app', async ({ page }) => {
  await show(page, 'get_alert', { alertId: 'ALT-1042' });
  await expect(view(page).getByRole('heading', { level: 1 })).toContainText(
    'Possible layering in SAP GY',
  );
  await view(page)
    .getByRole('button', { name: /Open in app/ })
    .click();
  await expect
    .poll(() => hostLog(page))
    .toContainEqual({
      type: 'openLink',
      value: `${WEB}/alerts/ALT-1042`,
    });
});

test('approve on the card is recorded as a Cowork decision', async ({ page, context }) => {
  await show(page, 'acknowledge_alert', {
    alertId: 'ALT-1042',
    rationale: 'OTR 34:1 meets the threshold.',
  });
  await view(page).getByRole('button', { name: 'Approve' }).click();
  await expect(view(page).getByTestId('decision')).toHaveText('Approved by Priya Shah in Cowork');
  await expect
    .poll(async () =>
      (await hostLog(page)).some(
        (e) => e.type === 'modelContext' && e.value.startsWith('The user approved request'),
      ),
    )
    .toBe(true);

  const app = await context.newPage();
  await app.goto(`${WEB}/alerts/ALT-1042?tab=timeline`);
  await expect(app.getByTestId('status-badge')).toHaveText('In Progress');
  await expect(app.getByTestId('via-claude').last()).toHaveText(
    'via Claude · approved by Priya Shah in Cowork',
  );
});

test('reject with a reason', async ({ page }) => {
  await show(page, 'add_comment', {
    alertId: 'ALT-1042',
    body: 'Recommend escalation.',
    rationale: 'Pattern matches the rule.',
  });
  await view(page).getByRole('button', { name: 'Reject' }).click();
  await view(page).getByRole('textbox', { name: 'Rejection reason' }).fill('Not yet');
  await view(page).getByRole('button', { name: 'Confirm reject' }).click();
  await expect(view(page).getByTestId('decision')).toHaveText('Rejected by Priya Shah in Cowork');
  await expect(view(page).getByTestId('reject-reason')).toHaveText('Reason: Not yet');
});

test('a decision in the app flips the card', async ({ page, request }) => {
  await show(page, 'acknowledge_alert', { alertId: 'ALT-1042', rationale: 'Start.' });
  await expect(view(page).getByRole('button', { name: 'Approve' })).toBeVisible();
  const approved = await request.post(`${API}/api/action-requests/AR-0001/approve`, {
    headers: { 'X-User-Id': 'U-01' },
  });
  expect(approved.ok()).toBe(true);
  await expect(view(page).getByTestId('decision')).toHaveText('Approved by Priya Shah in the app', {
    timeout: 5000,
  });
});

test('with approval off, the write shows Applied immediately', async ({ page, request }) => {
  const off = await request.put(`${API}/api/users/U-01/settings`, {
    headers: { 'X-User-Id': 'U-01' },
    data: { requireApprovalForAgentActions: false },
  });
  expect(off.ok()).toBe(true);
  await show(page, 'add_comment', { alertId: 'ALT-1042', body: 'Noted.', rationale: 'Log it.' });
  await expect(
    view(page).getByText('Applied immediately (approval is off for this user)'),
  ).toBeVisible();
});

test('a dark host renders the dark theme', async ({ page }) => {
  await show(page, 'get_alert', { alertId: 'ALT-1042' }, 'dark');
  await expect(view(page).getByRole('heading', { level: 1 })).toBeVisible();
  await expect(view(page).locator('html')).toHaveClass(/dark/);
});
