import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`https://maceip.github.io/tamayo/?cb=${Date.now()}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const probe = () =>
  page.evaluate(() => ({
    popup: !!document.querySelector('[data-annotation-popup]'),
    markers: document.querySelectorAll('[data-annotation-marker]').length,
    pendingOutline: !!document.querySelector('.dk-ann-outline, [class*="outline" i][class*="dk-ann" i]'),
    tray: !!document.querySelector('.dk-ann-annotate-tray'),
  }));

console.log('before click:', JSON.stringify(await probe()));
await page.click('[data-testid="dialkit-tool-annotate"]');
await page.waitForTimeout(600);
console.log('after tool click:', JSON.stringify(await probe()));

// now click a page element (the hero h1) to see what left-click does in annotate mode
await page.click('h1', { position: { x: 10, y: 10 } });
await page.waitForTimeout(600);
console.log('after page click:', JSON.stringify(await probe()));
await page.screenshot({ path: '/tmp/annotate-repro.png' });
await browser.close();
