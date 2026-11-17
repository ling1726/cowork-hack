import { expect, test } from './fixtures.ts';

const cards = (page: import('@playwright/test').Page) => page.getByTestId('stat-card');

test('stat cards show the four overview numbers in order', async ({ page }) => {
  await page.goto('/alerts');
  await expect(cards(page)).toHaveCount(4);
  const labels = ['Open', 'High & critical', 'Assigned to me', 'Awaiting you'];
  for (const [i, label] of labels.entries()) {
    await expect(cards(page).nth(i)).toContainText(label);
    await expect(cards(page).nth(i)).toHaveText(/\d/);
  }
});

test('each alert card count matches the list its link opens', async ({ page }) => {
  for (const [i, label] of ['Open', 'High & critical', 'Assigned to me'].entries()) {
    await page.goto('/alerts');
    const card = cards(page).nth(i);
    await expect(card).toHaveText(/\d/);
    const count = (await card.innerText()).match(/\d+/)?.[0];
    await card.getByRole('link', { name: label }).click();
    await expect(page.getByTestId('result-count')).toHaveText(
      `${count} ${count === '1' ? 'alert' : 'alerts'}`,
    );
  }
});

test('Awaiting you opens the queue and counts new Claude requests', async ({
  page,
  agentRequest,
}) => {
  await page.goto('/alerts');
  const awaiting = cards(page).nth(3);
  await expect(awaiting).toContainText('0');
  await agentRequest('/api/alerts/ALT-1042/comments', {
    body: 'Two of three indicators met.',
    rationale: 'Worth noting.',
  });
  await expect(awaiting).toContainText('1', { timeout: 5000 });
  await awaiting.getByRole('link', { name: 'Awaiting you' }).click();
  await expect(page).toHaveURL(/\/queue$/);
});
