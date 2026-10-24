const {test, expect} = require('@playwright/test');
const {readFileSync} = require('node:fs');
const path = require('node:path');

test('gracz.pl/paneladmin opens the existing OWNER login without tracking parameters', async ({page}) => {
  const target = 'https://gracz-contact-api.onrender.com/owner/newsletter/login/visual';
  await page.route('**/*', route => {
    const url = route.request().url();
    if(url === target) return route.fulfill({
      status: 200, contentType: 'text/html',
      body: '<!doctype html><html lang="pl"><body>Logowanie właściciela</body></html>'
    });
    if(new URL(url).origin === 'http://127.0.0.1:4174') return route.continue();
    return route.abort();
  });
  await page.goto('/paneladmin/?utm_source=chatgpt.com', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveURL(target);
  expect(new URL(page.url()).search).toBe('');
  const html = readFileSync(path.resolve(__dirname, '../../maintenance-site/paneladmin/index.html'), 'utf8');
  expect(html).toContain('noindex,nofollow,noarchive');
  expect(html).toContain('form-action \'none\'');
  expect(html).toContain('rel="noreferrer noopener"');
});
