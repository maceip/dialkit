import { expect, type Locator, type Page } from '@playwright/test';

export const PROJECT_KEY = 'dialkit-example';

export function annotationToolbar(page: Page): Locator {
  return page.getByTestId('dialkit-annotation-toolbar');
}

/** Hide DialKit popover chrome so it doesn't cover the page (display none, not Escape). */
export async function tuckDialPanels(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('.dialkit-root .dialkit-panel').forEach((el) => {
      (el as HTMLElement).style.setProperty('display', 'none');
    });
  });
}

export async function openDemo(page: Page): Promise<void> {
  await page.goto('./demo');
  await expect(page.getByTestId('demo-title')).toBeVisible({ timeout: 15_000 });
  await expect(annotationToolbar(page)).toBeVisible({ timeout: 15_000 });
  await tuckDialPanels(page);
}

/** Expand the Solid rail if it's in its collapsed (grip + chevron) state. */
export async function expandRail(page: Page): Promise<void> {
  const toolbar = annotationToolbar(page);
  if ((await toolbar.getAttribute('data-collapsed')) !== 'true') return;
  await page.getByTestId('dialkit-rail-toggle').click();
  await expect(toolbar).toHaveAttribute('data-collapsed', 'false', { timeout: 5_000 });
}

/** Activate annotate mode — Solid vertical tool or React Agentation toolbar. */
export async function activateAnnotationToolbar(page: Page): Promise<void> {
  await tuckDialPanels(page);
  const toolbar = annotationToolbar(page);
  await expect(toolbar).toBeVisible();
  await expandRail(page);

  const solidAnnotate = page.getByTestId('dialkit-tool-annotate');
  if (await solidAnnotate.count()) {
    const active = await solidAnnotate.getAttribute('data-active');
    if (active === 'true') return;
    await solidAnnotate.click();
    await expect(solidAnnotate).toHaveAttribute('data-active', 'true', { timeout: 5_000 });
    return;
  }

  const expanded = await toolbar.evaluate((el) => Boolean(el.querySelector('[class*="expanded"]')));
  if (expanded) return;

  const toggle = toolbar.locator('[role="button"], [class*="toggleContent"]').first();
  await toggle.click({ force: true });

  await expect
    .poll(async () => toolbar.evaluate((el) => Boolean(el.querySelector('[class*="expanded"]'))), {
      timeout: 10_000,
    })
    .toBe(true);
}

export async function annotateElement(
  page: Page,
  target: Locator,
  comment: string,
): Promise<void> {
  await activateAnnotationToolbar(page);
  // Solid rail pins on right-click (left-clicks stay live for the page);
  // the vendored React Agentation toolbar keeps its left-click model.
  const isSolidRail = (await page.getByTestId('dialkit-tool-annotate').count()) > 0;
  await target.click({ force: true, button: isSolidRail ? 'right' : 'left' });

  const popup = page.locator('[data-annotation-popup]');
  await expect(popup).toBeVisible({ timeout: 10_000 });

  await popup.locator('textarea').fill(comment);
  await popup.getByRole('button', { name: /^Add$/i }).click();

  await expect(page.locator('[data-annotation-marker]').first()).toBeVisible({ timeout: 10_000 });
}

export async function annotationStorageContains(page: Page, needle: string): Promise<boolean> {
  return page.evaluate(({ projectKey, needle: n }) => {
    const prefix = `dialkit:annotations:v1:${projectKey}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (raw?.includes(n)) return true;
    }
    return false;
  }, { projectKey: PROJECT_KEY, needle });
}

export async function openContextAction(
  page: Page,
  target: Locator,
  action: 'css' | 'dial' | 'move',
): Promise<void> {
  await tuckDialPanels(page);

  // Dispatch a real contextmenu at the element so the host listener runs.
  await target.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 8,
      clientY: rect.top + 8,
      button: 2,
    }));
  });

  const menu = page.locator('.dialkit-dev-context-menu');
  await expect(menu).toBeVisible({ timeout: 5_000 });

  // Click action via DOM so nothing intercepts
  await menu.locator(`[data-action="${action}"]`).evaluate((btn) => {
    (btn as HTMLButtonElement).click();
  });
}
