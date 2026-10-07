const { test, expect } = require('@playwright/test');

const MEASUREMENT_ID = 'G-1TJMKDNQR8';
const STORAGE_KEY = 'gracz_cookie_consent_v1';

async function installControlledGaRoutes(page, counters) {
  await page.route('https://www.googletagmanager.com/gtag/js**', async route => {
    counters.loader += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: [
        'window.__gccGoogleLoaderStub = true;',
        'window.__gccGtagCalls = [];',
        'window.gtag = function () {',
        '  var args = Array.prototype.slice.call(arguments);',
        '  window.__gccGtagCalls.push(args);',
        "  if (args[0] === 'config' && args[1] === 'G-1TJMKDNQR8' && args[2] && args[2].send_page_view === true) {",
        "    fetch('https://www.google-analytics.com/g/collect?v=2&tid=G-1TJMKDNQR8&en=page_view', { method: 'POST', keepalive: true }).catch(function () {});",
        '  }',
        '};'
      ].join('\n')
    });
  });

  await page.route('https://www.google-analytics.com/g/collect**', async route => {
    counters.collect += 1;
    counters.collectUrls.push(route.request().url());
    await route.fulfill({ status: 204, body: '' });
  });
}

async function savedChoice(page) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).value : null;
  }, STORAGE_KEY);
}

test('GA is denied before consent, remains blocked after reject, persists accept, and stops after withdrawal', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const counters = { loader: 0, collect: 0, collectUrls: [] };
  await installControlledGaRoutes(page, counters);

  await page.goto('/');
  await expect(page.locator('#gracz-cookie-consent')).toBeVisible();

  await page.waitForTimeout(700);
  expect(counters.loader).toBe(0);
  expect(counters.collect).toBe(0);
  expect(await page.evaluate(() => window.dataLayer.some(entry => {
    const args = Array.from(entry);
    return args[0] === 'consent' &&
      args[1] === 'default' &&
      args[2] &&
      args[2].analytics_storage === 'denied';
  }))).toBe(true);

  await page.getByRole('button', { name: 'Odrzuć wszystko' }).click();
  await expect.poll(() => savedChoice(page)).toBe('denied');
  await page.waitForTimeout(250);
  expect(counters.loader).toBe(0);
  expect(counters.collect).toBe(0);

  await page.reload();
  await page.waitForTimeout(700);
  expect(counters.loader).toBe(0);
  expect(counters.collect).toBe(0);
  expect(await savedChoice(page)).toBe('denied');

  await page.getByRole('button', { name: 'Ustawienia cookies' }).click();
  await page.getByRole('button', { name: 'Akceptuj analitykę' }).click();
  await expect.poll(() => counters.loader).toBe(1);
  await expect.poll(() => counters.collect).toBe(1);
  expect(await savedChoice(page)).toBe('analytics');
  expect(counters.collectUrls[0]).toContain('tid=' + MEASUREMENT_ID);
  expect(counters.collectUrls[0]).toContain('en=page_view');

  await page.reload();
  await expect.poll(() => counters.loader).toBe(2);
  await expect.poll(() => counters.collect).toBe(2);
  expect(await savedChoice(page)).toBe('analytics');

  await page.getByRole('button', { name: 'Ustawienia cookies' }).click();
  const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
  await page.getByRole('button', { name: 'Odrzuć wszystko' }).click();
  await navigation;
  await page.waitForLoadState('domcontentloaded');

  await expect.poll(() => savedChoice(page)).toBe('denied');
  await page.waitForTimeout(700);
  expect(counters.loader).toBe(2);
  expect(counters.collect).toBe(2);
  expect(await page.evaluate(id => window['ga-disable-' + id], MEASUREMENT_ID)).toBe(true);

  await context.close();
});

test('Reject and accept choices have equal visual prominence', async ({ page }) => {
  await page.goto('/');
  const reject = page.getByRole('button', { name: 'Odrzuć wszystko' });
  const accept = page.getByRole('button', { name: 'Akceptuj analitykę' });
  await expect(reject).toBeVisible();
  await expect(accept).toBeVisible();

  const style = locator => locator.evaluate(el => {
    const s = getComputedStyle(el);
    return {
      backgroundImage: s.backgroundImage,
      backgroundColor: s.backgroundColor,
      borderTopColor: s.borderTopColor,
      borderTopWidth: s.borderTopWidth,
      color: s.color,
      fontWeight: s.fontWeight,
      minHeight: s.minHeight,
      opacity: s.opacity
    };
  });

  const [rejectStyle, acceptStyle, rejectBox, acceptBox] = await Promise.all([
    style(reject), style(accept), reject.boundingBox(), accept.boundingBox()
  ]);
  expect(rejectStyle).toEqual(acceptStyle);
  expect(rejectBox).not.toBeNull();
  expect(acceptBox).not.toBeNull();
  expect(Math.abs(rejectBox.width - acceptBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(rejectBox.height - acceptBox.height)).toBeLessThanOrEqual(1);
});
