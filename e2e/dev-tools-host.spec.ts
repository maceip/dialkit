import { test, expect } from '@playwright/test';
import { openContextAction, openDemo, tuckDialPanels } from './helpers';

test.describe('slim tool host — CSS / dial / move', () => {
  test('right-click opens Edit styles panel', async ({ page }) => {
    await openDemo(page);
    await openContextAction(page, page.getByTestId('demo-title'), 'css');

    await expect
      .poll(async () => page.locator('.dialkit-dev-css-panel').evaluate((el) => !(el as HTMLElement).hidden))
      .toBe(true);
    await expect(page.locator('.dialkit-dev-css-panel')).toContainText(/Style editor/i);
  });

  test('right-click Open dial panel registers an element dial', async ({ page }) => {
    await openDemo(page);
    await openContextAction(page, page.getByTestId('demo-title'), 'dial');

    // Restore dial panel visibility after tuck, then assert a new panel appeared
    await page.evaluate(() => {
      document.querySelectorAll('.dialkit-root .dialkit-panel').forEach((el) => {
        (el as HTMLElement).style.removeProperty('display');
      });
    });

    // Element dial panels expose CSS-linked controls (translate / font size / etc.)
    await expect
      .poll(async () => page.locator('.dialkit-root').innerText())
      .toMatch(/Translate X|Font Size|Border Radius|Opacity/i);
  });

  test('Move tool translates the target element', async ({ page }) => {
    await openDemo(page);
    const title = page.getByTestId('demo-title');

    await openContextAction(page, title, 'move');
    // Do not Escape — Move waits for the next mousedown

    const box = await title.boundingBox();
    expect(box).toBeTruthy();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 30, { steps: 10 });
    await page.mouse.up();

    const after = await title.evaluate((el) => ({
      inline: (el as HTMLElement).style.transform,
      transform: getComputedStyle(el).transform,
    }));

    expect(
      after.inline.includes('translate') || (after.transform !== 'none' && after.transform.includes('matrix')),
    ).toBe(true);
  });
});
