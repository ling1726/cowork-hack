import { expect, test } from './fixtures.ts';

test('/ redirects to /alerts and header shows Priya Shah', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/alerts$/);
  await expect(page.getByTestId('current-user')).toHaveText(/Priya Shah/);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'Alerts' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Queue' })).toBeVisible();
});

test('switching user to Tom Becker persists across reload', async ({ page }) => {
  await page.goto('/alerts');
  await page.getByTestId('current-user').click();
  await page.getByRole('option', { name: /Tom Becker/ }).click();
  await expect(page.getByTestId('current-user')).toHaveText(/Tom Becker/);
  await page.reload();
  await expect(page.getByTestId('current-user')).toHaveText(/Tom Becker/);
});

test('stale persisted user falls back to U-01', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'alerts-demo-ui',
      JSON.stringify({ state: { currentUserId: 'U-99' }, version: 0 }),
    ),
  );
  await page.goto('/alerts');
  await expect(page.getByTestId('current-user')).toHaveText(/Priya Shah/);
});

test('never sends an unknown user id to the API', async ({ page }) => {
  const userHeaders: Array<string | undefined> = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/') && !r.url().endsWith('/api/users')) {
      userHeaders.push(r.headers()['x-user-id']);
    }
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'alerts-demo-ui',
      JSON.stringify({ state: { currentUserId: 'U-99' }, version: 0 }),
    ),
  );
  await page.goto('/alerts');
  await expect(page.getByTestId('current-user')).toHaveText(/Priya Shah/);
  expect(userHeaders).not.toContain('U-99');
});

test('theme toggle switches to dark and persists', async ({ page }) => {
  await page.goto('/alerts');
  await expect(page.locator('[data-theme="light"]')).toBeVisible();
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('[data-theme="dark"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-theme="dark"]')).toBeVisible();
});

test('unknown routes show a not-found page with a way back', async ({ page }) => {
  await page.goto('/nope');
  await expect(page.getByText('Page not found')).toBeVisible();
  await page.getByRole('link', { name: 'Back to alerts' }).click();
  await expect(page).toHaveURL(/\/alerts$/);
});

test('dark mode flips page and table colours', async ({ page }) => {
  await page.goto('/alerts');
  const row = page.getByTestId('alert-row').first();
  await expect(row).toBeVisible();
  const colours = async () => ({
    body: await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    row: await row.evaluate((el) => getComputedStyle(el).color),
  });
  const light = await colours();
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  const dark = await colours();
  expect(dark.body).not.toBe(light.body);
  expect(dark.row).not.toBe(light.row);
});

test('user switcher works from the keyboard', async ({ page }) => {
  await page.goto('/alerts');
  const trigger = page.getByTestId('current-user');
  await expect(trigger).toHaveText(/Priya Shah/);
  await trigger.focus();
  await page.keyboard.press('Enter');
  const tom = page.getByRole('option', { name: /Tom Becker/ });
  await expect(tom).toBeVisible();
  for (
    let i = 0;
    i < 8 && !(await tom.evaluate((el) => el.hasAttribute('data-highlighted')));
    i++
  ) {
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveText(/Tom Becker/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: /Tom Becker/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('sidebar collapses to a sheet on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/alerts');
  await expect(page.getByTestId('alert-row').first()).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await nav.getByRole('link', { name: 'Queue' }).click();
  await expect(page).toHaveURL(/\/queue$/);
});
