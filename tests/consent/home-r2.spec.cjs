const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

// PR #479 only: verify real Chromium rendering without touching backend,
// sessions, subscriber data or production.
for (const width of [360, 390, 768, 1366, 1920]) {
  test('Full Max Premium R2 hero at ' + width + 'px', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 850 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      await page.goto('/');
      await page.getByRole('button', { name: 'Odrzuć wszystko' }).click();
      await expect(page.locator('#gracz-cookie-consent')).toBeHidden();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText('Polskie Centrum Gracza');
      await expect(page.locator('.home-r2-motto')).toHaveText('Graj. Ucz się. Rywalizuj.');
      await expect(page.locator('.home-r2-slogan')).toHaveText('ZOSTAŃ NAJLEPSZYM GRACZEM!');
      await expect(page.locator('.home-hero-premium__lead')).toContainText('prawdziwych pasjonatów gier');
      await expect(page.locator('.home-r2-wordmark span')).toHaveCSS('color', 'rgb(236, 32, 56)');

      const primary = page.locator('.home-hero-premium__primary');
      const secondary = page.locator('.home-hero-premium__secondary');
      await expect(primary).toHaveAttribute('href', '/gry/');
      await expect(secondary).toHaveAttribute('href', '/poradniki/');

      const info = await page.evaluate(() => {
        const selectors = [
          '.home-hero-premium__title', '.home-r2-motto', '.home-r2-slogan',
          '.home-hero-premium__lead', '.home-hero-premium__primary',
          '.home-hero-premium__secondary'
        ];
        const regions = selectors.map(selector => {
          const el = document.querySelector(selector);
          if (!el) throw Error('Missing hero element: ' + selector);
          const r = el.getBoundingClientRect();
          return { selector, x: r.left, right: r.right, top: r.top, width: r.width, height: r.height };
        });
        return {
          viewport: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          regions,
          // Ensure the R2 stylesheet actually loaded, not merely the fallback HTML.
          headlineColor: getComputedStyle(document.querySelector('.home-hero-premium__title')).color
        };
      });
      console.log('R2_VIEWPORT_CHECK ' + JSON.stringify(info));
      expect(info.documentWidth, 'No global horizontal scrolling').toBeLessThanOrEqual(width + 2);
      expect(info.headlineColor).toBe('rgb(255, 255, 255)');
      for (const r of info.regions) {
        expect(r.height, r.selector + ' must have nonzero height').toBeGreaterThan(0);
        expect(r.x, r.selector + ' should not clip on the left').toBeGreaterThanOrEqual(-1);
        expect(r.right, r.selector + ' should fit the viewport').toBeLessThanOrEqual(width + 2);
      }
      const output = path.resolve('test-results', 'home-r2', 'hero-' + width + '.png');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      await page.screenshot({ path: output, animations: 'disabled' });
      // Real navigation stays an anchor rather than a fictitious registration flow.
      await expect(page.locator('.academy-showcase__grid .academy-tile')).toHaveCount(4);
    } finally {
      await context.close();
    }
  });
}
