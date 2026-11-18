import type { Page } from '@playwright/test';
import { coworkLink, coworkPrompt } from '@app/domain';
import { expect, test } from './fixtures.ts';

const prompt = (page: Page) => page.getByRole('textbox', { name: 'Prompt' });
const open = (page: Page) => page.getByTestId('open-in-cowork');

test('investigate: dialog prefilled, link matches, nothing opens until clicked', async ({
  page,
}) => {
  await page.goto('/alerts/ALT-1051');
  await page.getByTestId('cowork-investigate').click();
  const expected = coworkPrompt({ kind: 'investigate', alertId: 'ALT-1051' });
  await expect(prompt(page)).toHaveValue(expected);
  await expect(open(page)).toHaveAttribute('href', coworkLink(expected));
  await expect(page.getByText('Nothing is sent until you press Send in Cowork.')).toBeVisible();
});

test('edits flow into the link; blank prompt disables Open', async ({ page }) => {
  await page.goto('/alerts/ALT-1051');
  await page.getByTestId('cowork-investigate').click();
  const edited = 'Focus on the Kestrel timing & the 16:30 entry';
  await prompt(page).fill(edited);
  await expect(open(page)).toHaveAttribute('href', coworkLink(edited));
  await prompt(page).fill('   ');
  await expect(open(page)).not.toHaveAttribute('href', /.*/);
  await expect(open(page)).toHaveAttribute('aria-disabled', 'true');
});

test('reopening the dialog resets to the case prompt', async ({ page }) => {
  await page.goto('/alerts/ALT-1051');
  await page.getByTestId('cowork-investigate').click();
  await prompt(page).fill('edited');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByTestId('cowork-investigate').click();
  await expect(prompt(page)).toHaveValue(
    coworkPrompt({ kind: 'investigate', alertId: 'ALT-1051' }),
  );
});

test('Copy prompt copies the edited text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/alerts/ALT-1051');
  await page.getByTestId('cowork-investigate').click();
  await prompt(page).fill('my own question');
  await page.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('my own question');
});

test('second opinion appears only on a closed alert; pattern names the trader', async ({
  page,
}) => {
  await page.goto('/alerts/ALT-1051');
  await expect(page.getByTestId('cowork-second_opinion')).toHaveCount(0);
  await page.getByTestId('cowork-pattern').click();
  await expect(prompt(page)).toHaveValue(/trader Marcus Hale \(T-0741\)/);
  await page.goto('/alerts/ALT-0987');
  await page.getByTestId('cowork-second_opinion').click();
  await expect(prompt(page)).toHaveValue(
    coworkPrompt({ kind: 'second_opinion', alertId: 'ALT-0987' }),
  );
});
