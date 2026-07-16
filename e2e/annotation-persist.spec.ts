import { test, expect } from '@playwright/test';
import {
  activateAnnotationToolbar,
  annotateElement,
  annotationStorageContains,
  annotationToolbar,
  openDemo,
} from './helpers';

test.describe('annotation toolbar — post + persist', () => {
  test('posts a comment, shows a marker, survives refresh', async ({ page }) => {
    const comment = `Surgical annotate ${Date.now()}`;

    await openDemo(page);
    await annotateElement(page, page.getByTestId('demo-title'), comment);

    await expect(page.locator('[data-annotation-marker]').first()).toBeVisible();
    expect(await annotationStorageContains(page, comment)).toBe(true);

    await page.reload();
    await expect(page.getByTestId('demo-title')).toBeVisible({ timeout: 15_000 });

    // Persistence is the contract — markers only paint while the toolbar is active
    expect(await annotationStorageContains(page, comment)).toBe(true);

    await activateAnnotationToolbar(page);
    await expect(page.locator('[data-annotation-marker]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('landing navigates to demo with toolbar mounted', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /design in the browser/i })).toBeVisible();
    await page.getByRole('link', { name: /open interactive demo/i }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(annotationToolbar(page)).toBeVisible({ timeout: 15_000 });
  });
});
