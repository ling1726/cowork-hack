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
