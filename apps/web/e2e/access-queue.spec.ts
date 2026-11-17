import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const BASE = 'http://localhost:5173';
const comment = (body = 'Recommend escalating to the Compliance Lead.') => ({
  body,
  rationale: 'Two of three rule indicators are met.',
});
const ack = () => ({ rationale: 'Starting the investigation.' });
const card = (page: Page) => page.getByTestId('action-request-card');

test('badge shows 1 within 5s after an agent comment is submitted while the page is open', async ({
  page,
  agentRequest,
}) => {
  await page.goto('/alerts');
  await expect(page.getByTestId('queue-badge')).toHaveCount(0);
  await agentRequest('/api/alerts/ALT-1042/comments', comment());
  await expect(page.getByTestId('queue-badge')).toHaveText('1', { timeout: 5_000 });
});

test('the alert banner appears without a reload when Claude submits while the alert is open', async ({
  page,
  agentRequest,
}) => {
  await page.goto('/alerts/ALT-1042');
  await expect(page.getByTestId('pending-requests-banner')).toHaveCount(0);
  await agentRequest('/api/alerts/ALT-1042/acknowledge', ack());
  await expect(page.getByTestId('pending-requests-banner')).toBeVisible({ timeout: 6_000 });
  await expect(page.getByTestId('pending-count')).toHaveText('1');
});

test('/queue lists pending requests with Claude’s rationale and the exact comment text', async ({
  page,
  agentRequest,
}) => {
  await agentRequest('/api/alerts/ALT-1042/comments', comment('Exact words, verbatim.'));
  await agentRequest('/api/alerts/ALT-1047/acknowledge', ack());
  await page.goto('/queue');
  await expect(card(page)).toHaveCount(2);
  await expect(page.getByTestId('rationale').first()).toBeVisible();
  await expect(page.getByTestId('payload-preview')).toHaveText('Exact words, verbatim.');
  await expect(page.getByRole('tab', { name: 'Pending' })).toHaveAttribute('aria-selected', 'true');
});

test('approve from /queue/AR-0001 → comment in timeline with "via Claude" and "approved by Priya Shah"', async ({
  page,
  agentRequest,
}) => {
  await agentRequest('/api/alerts/ALT-1042/comments', comment('Please escalate.'));
  await page.goto('/queue/AR-0001');
  await expect(page.getByTestId('rationale')).toHaveText('Two of three rule indicators are met.');
  await expect(page.getByTestId('payload-preview')).toHaveText('Please escalate.');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('request-status')).toHaveText('Approved');
  await page.getByRole('link', { name: 'View alert' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts/ALT-1042`);
  await page.getByRole('tab', { name: 'Timeline' }).click();
  const last = page.getByTestId('timeline-event').last();
  await expect(last).toContainText('Please escalate.');
  await expect(last).toContainText('Priya Shah');
  await expect(last.getByTestId('via-claude')).toHaveText('via Claude · approved by Priya Shah');
  await expect(page.getByTestId('queue-badge')).toHaveCount(0);
});

test('approve from the alert banner for a queued acknowledge → status In Progress', async ({
  page,
  agentRequest,
}) => {
  await agentRequest('/api/alerts/ALT-1042/acknowledge', ack());
  await page.goto('/alerts/ALT-1042');
  const banner = page.getByTestId('pending-requests-banner');
  await expect(banner).toBeVisible();
  await expect(page.getByTestId('status-badge')).toHaveText('Open');
  await banner.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('status-badge')).toHaveText('In Progress');
  await expect(page.getByTestId('pending-requests-banner')).toHaveCount(0);
});

test('reject with reason → request rejected; timeline shows the rejection', async ({
  page,
  agentRequest,
}) => {
  await agentRequest('/api/alerts/ALT-1042/comments', comment('Not this one.'));
  await page.goto('/queue/AR-0001');
  await page.getByRole('button', { name: 'Reject' }).click();
  await page
    .getByRole('textbox', { name: 'Rejection reason' })
    .fill('Premature; wait for the data review.');
  await page.getByRole('button', { name: 'Confirm reject' }).click();
  await expect(page.getByTestId('request-status')).toHaveText('Rejected');
  await expect(page.getByTestId('reject-reason')).toContainText(
    'Premature; wait for the data review.',
  );
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await page.goto('/alerts/ALT-1042?tab=timeline');
  const last = page.getByTestId('timeline-event').last();
  await expect(last).toContainText('Rejected request AR-0001');
  await expect(last).toContainText('Premature; wait for the data review.');
  await expect(page.getByText('Not this one.')).toHaveCount(0);
});

test('stale approve: human acknowledges first, then approve shows the failure', async ({
  page,
  agentRequest,
}) => {
  await agentRequest('/api/alerts/ALT-1042/acknowledge', ack());
  const human = await page.request.post('/api/alerts/ALT-1042/acknowledge', {
    headers: { 'X-User-Id': 'U-01' },
  });
  expect(human.ok()).toBe(true);
  await page.goto('/queue/AR-0001');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByTestId('request-status')).toHaveText('Failed');
  await expect(page.getByTestId('failure')).toContainText(
    'Cannot acknowledge an alert that is in_progress',
  );
});

test('/queue/AR-9999 shows not found', async ({ page }) => {
  await page.goto('/queue/AR-9999');
  await expect(page.getByText('Request not found')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the queue' }).click();
  await expect(page).toHaveURL(`${BASE}/queue`);
});

test('decided requests are listed under their status tab', async ({ page, agentRequest }) => {
  await agentRequest('/api/alerts/ALT-1042/comments', comment('One'));
  await agentRequest('/api/alerts/ALT-1047/comments', comment('Two'));
  await page.goto('/queue');
  await card(page).first().getByRole('button', { name: 'Approve' }).click();
  await expect(card(page)).toHaveCount(1);
  await page.getByRole('tab', { name: 'Approved' }).click();
  await expect(page).toHaveURL(`${BASE}/queue?status=approved`);
  await expect(card(page)).toHaveCount(1);
  await expect(page.getByTestId('request-status')).toHaveText('Approved');
  await page.getByRole('tab', { name: 'Pending' }).click();
  await expect(page).toHaveURL(`${BASE}/queue`);
});

test('the queue only shows requests made for the current user', async ({ page, agentRequest }) => {
  await agentRequest('/api/alerts/ALT-1042/comments', comment());
  await page.goto('/queue');
  await expect(card(page)).toHaveCount(1);
  await page.getByTestId('current-user').click();
  await page.getByRole('option', { name: /Tom Becker/ }).click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByText('No requests here')).toBeVisible();
  await expect(page.getByTestId('queue-badge')).toHaveCount(0);
});

test('someone else cannot decide a request (no buttons, and a note says who can)', async ({
  page,
  agentRequest,
}) => {
  await agentRequest('/api/alerts/ALT-1042/comments', comment());
  await page.goto('/queue/AR-0001');
  await page.getByTestId('current-user').click();
  await page.getByRole('option', { name: /Tom Becker/ }).click();
  await expect(page.getByTestId('rationale')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByText('Only Priya Shah can decide this request')).toBeVisible();
});

test('turning the setting off makes the next agent comment apply directly (via Claude, no approval)', async ({
  page,
  agentRequest,
}) => {
  await page.goto('/alerts/ALT-1042?tab=timeline');
  await page.getByRole('button', { name: 'Settings' }).click();
  const toggle = page.getByRole('switch', { name: "Require approval for Claude's actions" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.getByRole('button', { name: 'Close' }).click();

  const applied = (await agentRequest('/api/alerts/ALT-1042/comments', comment('Direct.'))) as {
    event?: { via: string; approvedBy?: string };
    actionRequest?: unknown;
  };
  expect(applied.actionRequest).toBeUndefined();
  expect(applied.event).toMatchObject({ via: 'claude' });
  await page.reload();
  const last = page.getByTestId('timeline-event').last();
  await expect(last).toContainText('Direct.');
  await expect(last.getByTestId('via-claude')).toHaveText('via Claude');
  await expect(page.getByTestId('queue-badge')).toHaveCount(0);

  // The setting is stored on the server, so it survives a reload.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(
    page.getByRole('switch', { name: "Require approval for Claude's actions" }),
  ).not.toBeChecked();
});
