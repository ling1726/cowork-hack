import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const dialog = (page: Page) => page.getByRole('dialog');

test('acknowledge ALT-1042 → status In Progress, Acknowledge button gone', async ({ page }) => {
  await page.goto('/alerts/ALT-1042');
  await expect(page.getByTestId('status-badge')).toHaveText('Open');
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await dialog(page).getByRole('button', { name: 'Acknowledge' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId('status-badge')).toHaveText('In Progress');
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(0);
  await expect(page.getByTestId('action-close')).toBeVisible();
});

test('W3 app side: escalate ALT-1013 to Daniel Okafor → escalated event, assignee added, status unchanged', async ({
  page,
}) => {
  await page.goto('/alerts/ALT-1013');
  await page.getByRole('button', { name: 'Escalate' }).click();
  const d = dialog(page);
  const submit = d.getByRole('button', { name: 'Escalate' });
  await expect(submit).toBeDisabled();
  await d.getByRole('combobox', { name: 'Escalate to' }).click();
  await page.getByRole('option', { name: 'Daniel Okafor' }).click();
  await expect(submit).toBeDisabled();
  await d
    .getByRole('textbox', { name: 'Reason' })
    .fill('Third alert for this trader in seven weeks.');
  await submit.click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId('status-badge')).toHaveText('In Progress');
  await expect(page.getByTestId('assignees-panel')).toContainText('Daniel Okafor');
  await expect(page.getByTestId('escalation')).toContainText('Third alert for this trader');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(page.getByTestId('timeline-event').last()).toContainText(
    'Escalated to Daniel Okafor',
  );
});

test('an already-escalated user is not offered again', async ({ page }) => {
  await page.goto('/alerts/ALT-1013');
  await page.getByRole('button', { name: 'Escalate' }).click();
  await dialog(page).getByRole('combobox', { name: 'Escalate to' }).click();
  await page.getByRole('option', { name: 'Daniel Okafor' }).click();
  await dialog(page).getByRole('textbox', { name: 'Reason' }).fill('x');
  await dialog(page).getByRole('button', { name: 'Escalate' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Escalate' }).click();
  await dialog(page).getByRole('combobox', { name: 'Escalate to' }).click();
  await expect(page.getByRole('option', { name: 'Sarah Klein' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Daniel Okafor' })).toHaveCount(0);
});

test('close requires outcome and note; closed alert offers Reopen', async ({ page }) => {
  await page.goto('/alerts/ALT-1013');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const d = dialog(page);
  const submit = d.getByRole('button', { name: 'Close alert' });
  await expect(submit).toBeDisabled();
  await d.getByRole('combobox', { name: 'Outcome' }).click();
  await page.getByRole('option', { name: 'True positive' }).click();
  await expect(submit).toBeDisabled();
  await d.getByRole('textbox', { name: 'Note' }).fill('Confirmed wash trading.');
  await submit.click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId('status-badge')).toHaveText('Closed');
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Escalate' })).toHaveCount(0);
  await expect(page.getByTestId('resolution')).toContainText('Confirmed wash trading.');
  await expect(page.getByTestId('resolution')).toContainText('True positive');
});

test('W4 app side: reopen ALT-0987 requires a reason; timeline shows Closed → Open with reason', async ({
  page,
}) => {
  await page.goto('/alerts/ALT-0987');
  await expect(page.getByTestId('status-badge')).toHaveText('Closed');
  await page.getByRole('button', { name: 'Reopen' }).click();
  const submit = dialog(page).getByRole('button', { name: 'Reopen alert' });
  await expect(submit).toBeDisabled();
  await dialog(page)
    .getByRole('textbox', { name: 'Reason' })
    .fill('ALT-1051 shows a second pre-listing trade by the same deal team.');
  await submit.click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId('status-badge')).toHaveText('Open');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  const last = page.getByTestId('timeline-event').last();
  await expect(last).toContainText('Closed → Open');
  await expect(last).toContainText('ALT-1051 shows a second pre-listing trade');
  await expect(page.getByTestId('resolution')).toHaveCount(0);
});

test('header buttons come from allowedActions only', async ({ page }) => {
  await page.goto('/alerts/ALT-0987');
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  for (const name of ['Acknowledge', 'Escalate']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
});

test('a server error is shown in the dialog and the dialog stays open', async ({ page }) => {
  await page.goto('/alerts/ALT-1042');
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  // Someone else acknowledges first; this page is now stale.
  const other = await page.request.post('/api/alerts/ALT-1042/acknowledge', {
    headers: { 'X-User-Id': 'U-02' },
  });
  expect(other.ok()).toBe(true);
  await dialog(page).getByRole('button', { name: 'Acknowledge' }).click();
  await expect(dialog(page)).toContainText('Cannot acknowledge an alert that is in_progress');
  await expect(dialog(page)).toBeVisible();
});

test('edit assignees', async ({ page }) => {
  await page.goto('/alerts/ALT-1042');
  await page.getByRole('button', { name: 'Edit assignees' }).click();
  const d = dialog(page);
  await d.getByRole('combobox', { name: 'Primary' }).click();
  await page.getByRole('option', { name: 'Tom Becker' }).click();
  await d.getByRole('combobox', { name: 'Backup' }).click();
  await page.getByRole('option', { name: 'Daniel Okafor' }).click();
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(dialog(page)).toHaveCount(0);
  const panel = page.getByTestId('assignees-panel');
  await expect(panel).toContainText('Tom Becker');
  await expect(panel).toContainText('Daniel Okafor');
  await expect(panel).not.toContainText('Mei Lin');
});

test('assignees dialog refuses the same person twice', async ({ page }) => {
  await page.goto('/alerts/ALT-1042');
  await page.getByRole('button', { name: 'Edit assignees' }).click();
  const d = dialog(page);
  await d.getByRole('combobox', { name: 'Backup' }).click();
  await page.getByRole('option', { name: 'Priya Shah' }).click();
  await expect(d.getByRole('button', { name: 'Save' })).toBeDisabled();
  await expect(d).toContainText('must be different');
});

test('add link and upload a small file show in materials', async ({ page }) => {
  await page.goto('/alerts/ALT-1042?tab=materials');
  await page.getByRole('button', { name: 'Add link' }).click();
  let d = dialog(page);
  await d.getByRole('textbox', { name: 'Title' }).fill('Venue rules');
  await d.getByRole('textbox', { name: 'URL' }).fill('not a url');
  await expect(d.getByRole('button', { name: 'Add link' })).toBeDisabled();
  await d.getByRole('textbox', { name: 'URL' }).fill('https://example.com/rules');
  await d.getByRole('button', { name: 'Add link' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Venue rules' })).toHaveAttribute(
    'href',
    'https://example.com/rules',
  );

  await page.getByRole('button', { name: 'Upload attachment' }).click();
  d = dialog(page);
  await expect(d.getByRole('button', { name: 'Upload' })).toBeDisabled();
  await d.locator('input[type="file"]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello analyst'),
  });
  await d.getByRole('button', { name: 'Upload' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'notes.txt' })).toBeVisible();
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(page.getByTestId('timeline-event').last()).toContainText('Added an attachment');
});

test('an alert list refreshes after an action (status filter no longer matches)', async ({
  page,
}) => {
  await page.goto('/alerts?status=open&severity=high&desk=eu-equities');
  await expect(page.getByTestId('result-count')).toHaveText('3 alerts');
  await page.getByRole('link', { name: 'ALT-1042' }).click();
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await dialog(page).getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByTestId('status-badge')).toHaveText('In Progress');
  await page.goBack();
  await expect(page.getByTestId('result-count')).toHaveText('2 alerts');
});
