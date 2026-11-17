import { alertUrl } from '@app/domain';
import { expect, test } from './fixtures.ts';

const BASE = 'http://localhost:5173';

test('alertUrl(…, {tab:"data", dataTab:"orders"}) opens the Data tab on the orders table', async ({
  page,
}) => {
  await page.goto(alertUrl('', 'ALT-1042', { tab: 'data', dataTab: 'orders' }));
  await expect(page.getByRole('tab', { name: 'Data', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('data-row')).toHaveCount(68);
  await expect(page.getByRole('columnheader', { name: 'Cancel latency (ms)' })).toBeVisible();
});

test('data tab picker is bound to ?dataTab and defaults to the first tab', async ({ page }) => {
  await page.goto('/alerts/ALT-1042?tab=data');
  await expect(page.getByRole('tab', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Executions' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts/ALT-1042?tab=data&dataTab=executions`);
  await expect(page.getByTestId('data-row')).toHaveCount(2);
  await page.goto('/alerts/ALT-1042?tab=data&dataTab=nope');
  await expect(page.getByRole('tab', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true');
});

test('highlights show OTR 34:1 and Fast cancels 72%', async ({ page }) => {
  await page.goto('/alerts/ALT-1042');
  const strip = page.getByTestId('highlights');
  await expect(strip).toContainText('Order-to-trade ratio');
  await expect(strip).toContainText('34:1');
  await expect(strip).toContainText('Fast cancels');
  await expect(strip).toContainText('72%');
});

test('header shows the alert, its rule and the assignees', async ({ page }) => {
  await page.goto('/alerts/ALT-1042');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Possible layering in SAP GY',
  );
  await expect(page.getByTestId('status-badge')).toHaveText('Open');
  await expect(page.getByTestId('severity-badge')).toHaveText('High');
  const assignees = page.getByTestId('assignees-panel');
  await expect(assignees).toContainText('Priya Shah');
  await expect(assignees).toContainText('Mei Lin');
  await expect(page.getByText('Order-to-trade ratio', { exact: false }).first()).toBeVisible();
  // The overview lists the rule's indicators and thresholds.
  await expect(page.getByTestId('rule-indicators')).toContainText('> 20:1');
  // Markdown in the description is rendered, not shown raw.
  await expect(page.getByText('**layering**')).toHaveCount(0);
});

test('tabs are bound to ?tab and the default tab stays out of the URL', async ({ page }) => {
  await page.goto('/alerts/ALT-1042');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts/ALT-1042?tab=timeline`);
  await page.getByRole('tab', { name: 'Materials' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts/ALT-1042?tab=materials`);
  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts/ALT-1042`);
  await page.goto('/alerts/ALT-1042?tab=bogus');
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('posting a comment appears in the timeline with my name', async ({ page }) => {
  await page.goto('/alerts/ALT-1042?tab=timeline');
  // Count only once the timeline has loaded, or `before` can be 0.
  await expect(page.getByTestId('timeline-event').first()).toBeVisible();
  const before = await page.getByTestId('timeline-event').count();
  await page.getByRole('textbox', { name: 'Add a comment' }).fill('Escalating to compliance.');
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByTestId('timeline-event')).toHaveCount(before + 1);
  const last = page.getByTestId('timeline-event').last();
  await expect(last).toContainText('Priya Shah');
  await expect(last).toContainText('Escalating to compliance.');
  await expect(page.getByRole('textbox', { name: 'Add a comment' })).toHaveValue('');
});

test('post comment is disabled until there is text', async ({ page }) => {
  await page.goto('/alerts/ALT-1042?tab=timeline');
  await expect(page.getByRole('button', { name: 'Post comment' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Add a comment' }).fill('   ');
  await expect(page.getByRole('button', { name: 'Post comment' })).toBeDisabled();
});

test('a comment made as another user carries that name', async ({ page }) => {
  await page.goto('/alerts/ALT-1042?tab=timeline');
  await page.getByTestId('current-user').click();
  await page.getByRole('option', { name: /Tom Becker/ }).click();
  await page.getByRole('textbox', { name: 'Add a comment' }).fill('Second opinion.');
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByTestId('timeline-event').last()).toContainText('Tom Becker');
});

test('materials lists order-blotter.csv and it downloads', async ({ page }) => {
  await page.goto('/alerts/ALT-1042?tab=materials');
  await expect(page.getByRole('link', { name: /Layering surveillance runbook/ })).toHaveAttribute(
    'target',
    '_blank',
  );
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /order-blotter\.csv/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('order-blotter.csv');
});

test('/alerts/ALT-9999 shows not found with a link back', async ({ page }) => {
  await page.goto('/alerts/ALT-9999');
  await expect(page.getByText('Alert not found')).toBeVisible();
  await page.getByRole('link', { name: 'Back to alerts' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts`);
});

test('a closed alert shows its resolution', async ({ page }) => {
  await page.goto('/alerts/ALT-0987');
  await expect(page.getByTestId('status-badge')).toHaveText('Closed');
  await expect(page.getByTestId('resolution')).toContainText(
    'Name added to restricted list after trade; timing benign',
  );
  await expect(page.getByTestId('resolution')).toContainText('Mei Lin');
});

test('details panel lists trader, instrument and rule', async ({ page }) => {
  await page.goto('/alerts/ALT-1042');
  const panel = page.getByTestId('details-panel');
  await expect(panel).toContainText('T-0412');
  await expect(panel).toContainText('SAP GY');
  await expect(panel).toContainText('Layering');
  await expect(panel).toContainText('EU Equities');
});

test('detail page has no horizontal page scroll at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/alerts/ALT-1042?tab=data');
  await expect(page.getByTestId('data-table')).toBeVisible();
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});
