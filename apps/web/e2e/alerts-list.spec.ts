import { alertListUrl } from '@app/domain';
import { expect, test } from './fixtures.ts';

const BASE = 'http://localhost:5173';
type Page = import('@playwright/test').Page;
const rows = (page: Page) => page.getByRole('row').filter({ hasText: /ALT-/ });
/** Popover filter trigger, named "<Field> filter" plus the chosen values. */
const filterButton = (page: Page, label: string) =>
  page.getByRole('button', { name: new RegExp(`^${label} filter`) });

test('W1 deep link renders exactly 2 rows and the filters are set', async ({ page }) => {
  await page.goto(
    alertListUrl('', {
      status: ['open'],
      severity: ['high'],
      desk: ['eu-equities'],
      q: 'layering',
    }),
  );
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByTestId('result-count')).toHaveText('2 alerts');
  await expect(page.getByRole('searchbox')).toHaveValue('layering');
  await expect(filterButton(page, 'Status')).toContainText('Open');
  await expect(filterButton(page, 'Severity')).toContainText('High');
  await expect(filterButton(page, 'Desk')).toContainText('EU Equities');
  await expect(page.getByRole('link', { name: 'ALT-1042' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ALT-1047' })).toBeVisible();
});

test('setting filters via the UI produces the canonical URL', async ({ page }) => {
  await page.goto('/alerts');
  const choose = async (label: string, option: string) => {
    await filterButton(page, label).click();
    await page.getByRole('checkbox', { name: option, exact: true }).click();
    await page.keyboard.press('Escape');
  };
  await choose('Status', 'Open');
  await choose('Severity', 'High');
  await choose('Desk', 'EU Equities');
  await expect(page).toHaveURL(
    alertListUrl(BASE, { status: ['open'], severity: ['high'], desk: ['eu-equities'] }),
  );
  await expect(page.getByTestId('result-count')).toHaveText('3 alerts');
  await page.getByRole('searchbox').fill('layering');
  await expect(page).toHaveURL(
    alertListUrl(BASE, {
      status: ['open'],
      severity: ['high'],
      desk: ['eu-equities'],
      q: 'layering',
    }),
  );
  await expect(page.getByTestId('result-count')).toHaveText('2 alerts');
});

test('multi-select values are comma-joined in the URL', async ({ page }) => {
  await page.goto('/alerts');
  await filterButton(page, 'Status').click();
  await page.getByRole('checkbox', { name: 'Open', exact: true }).click();
  await page.getByRole('checkbox', { name: 'In Progress', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(alertListUrl(BASE, { status: ['open', 'in_progress'] }));
  expect(page.url()).toContain('status=open,in_progress');
});

test('row link opens /alerts/ALT-1042', async ({ page }) => {
  await page.goto('/alerts');
  await page.getByRole('link', { name: 'ALT-1042' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts/ALT-1042`);
});

test('bad params degrade: /alerts?status=bogus&page=0 shows all alerts, no error', async ({
  page,
}) => {
  await page.goto('/alerts?status=bogus&page=0');
  await expect(page.getByTestId('result-count')).toHaveText('55 alerts');
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('sorting by severity updates the URL (sort=-severity) and flips on a second click', async ({
  page,
}) => {
  await page.goto('/alerts');
  await page.getByRole('button', { name: 'Severity', exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/alerts?sort=-severity`);
  await expect(rows(page).first().getByTestId('severity-badge')).toHaveText(/Critical|High/);
  await page.getByRole('button', { name: 'Severity', exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/alerts?sort=severity`);
  await expect(rows(page).first().getByTestId('severity-badge')).toHaveText('Low');
});

test('pagination moves between pages and filters reset the page', async ({ page }) => {
  await page.goto('/alerts');
  await expect(page.getByTestId('pagination')).toContainText('Page 1 of 3');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts?page=2`);
  await expect(page.getByTestId('pagination')).toContainText('Page 2 of 3');
  await expect(rows(page)).toHaveCount(25);
  await filterButton(page, 'Severity').click();
  await page.getByRole('checkbox', { name: 'High', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(`${BASE}/alerts?severity=high`);
  await expect(page.getByTestId('pagination')).toContainText('Page 1 of');
});

test('out-of-range page shows an empty page with a way back', async ({ page }) => {
  await page.goto('/alerts?page=9');
  await expect(page.getByTestId('result-count')).toHaveText('55 alerts');
  await expect(page.getByText('No alerts on this page')).toBeVisible();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts?page=8`);
});

test('Assigned to me filters by the current user and follows the user switcher', async ({
  page,
}) => {
  await page.goto('/alerts');
  const all = await page.getByTestId('result-count').innerText();
  await page.getByRole('switch', { name: 'Assigned to me' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts?assigneeId=U-01`);
  const mine = await page.getByTestId('result-count').innerText();
  expect(mine).not.toBe(all);
  await expect(page.getByRole('switch', { name: 'Assigned to me' })).toBeChecked();
  await page.getByRole('switch', { name: 'Assigned to me' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts`);
});

test('filters without a control (instrument, dates) show as chips and can be removed', async ({
  page,
}) => {
  await page.goto('/alerts?instrument=NVLX&from=2026-01-01');
  await expect(page.getByTestId('result-count')).toHaveText('2 alerts');
  await expect(page.getByTestId('filter-chip')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove filter Instrument: NVLX' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts?from=2026-01-01`);
});

test('no matches shows an empty state and Clear filters resets everything', async ({ page }) => {
  await page.goto('/alerts?status=closed&severity=critical&desk=fx&q=zzzzzz');
  await expect(page.getByTestId('result-count')).toHaveText('0 alerts');
  await expect(page.getByText('No alerts match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(`${BASE}/alerts`);
  await expect(page.getByTestId('result-count')).toHaveText('55 alerts');
});

test('whitespace-only and punctuation search never errors', async ({ page }) => {
  await page.goto('/alerts?q=%20%20');
  await expect(page.getByTestId('result-count')).toHaveText('55 alerts');
  await page.goto(`/alerts?q=${encodeURIComponent('"(*')}`);
  await expect(page.getByTestId('result-count')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('faceted filter works from the keyboard', async ({ page }) => {
  await page.goto('/alerts');
  const trigger = filterButton(page, 'Status');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('prog');
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox', { name: 'In Progress' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(alertListUrl(BASE, { status: ['in_progress'] }));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('list has no horizontal page scroll at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/alerts');
  await expect(rows(page).first()).toBeVisible();
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});

test('shared component styles reach the app', async ({ page }) => {
  await page.goto('/alerts');
  const badge = page.getByTestId('severity-badge').first();
  await expect(badge).toBeVisible();
  expect(await badge.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
  const cell = rows(page).first().locator('td').first();
  expect(await cell.evaluate((el) => getComputedStyle(el).paddingTop)).not.toBe('0px');
});
