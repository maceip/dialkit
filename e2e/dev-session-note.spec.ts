import { test, expect } from '@playwright/test';

async function waitForDemo(page: import('@playwright/test').Page) {
  await page.goto('/demo');
  await expect(page.locator('.dialkit-feedback-textarea')).toBeVisible({ timeout: 15_000 });
}

test('writes a dev session note and finds it after reload', async ({ page }) => {
  const noteText = `Persisted agent note ${Date.now()}`;

  await waitForDemo(page);

  const textarea = page.locator('.dialkit-feedback-textarea');
  await textarea.fill(noteText);
  await page.locator('.dialkit-feedback-inner [data-save]').click();

  const notes = page.locator('.dialkit-feedback-notes');
  await expect(notes).toContainText(noteText);

  await page.reload();
  await expect(page.locator('.dialkit-feedback-textarea')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.dialkit-feedback-notes')).toContainText(noteText);
});

test('landing page links to the interactive demo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /design in the browser/i })).toBeVisible();
  await page.getByRole('link', { name: /open interactive demo/i }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator('.dialkit-feedback-textarea')).toBeVisible({ timeout: 15_000 });
});
