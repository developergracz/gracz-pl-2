const {test, expect} = require('@playwright/test');
const {readFileSync} = require('node:fs');
const path = require('node:path');

test('gracz.pl/paneladmin shows the OWNER form and posts to newsletter, without another login', async ({page}) => {
  const target = 'https://gracz-contact-api.onrender.com/owner/newsletter/login/paneladmin-form';
  await page.route('**/*', route => {
    const url = route.request().url();
    if(url === target && route.request().method() === 'POST') return route.fulfill({
      status: 200, contentType: 'text/html',
      body: '<!doctype html><html lang="pl"><body><h1>Panel administracyjny Newslettera</h1></body></html>'
    });
    if(new URL(url).origin === 'http://127.0.0.1:4174') return route.continue();
    return route.abort();
  });
  await page.goto('/paneladmin/?utm_source=chatgpt.com', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveURL(/\/paneladmin\/\?utm_source=chatgpt\.com$/);
  await expect(page.getByRole('heading',{name:/Panel Admin gracz.pl/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Zaloguj się/})).toBeEnabled();
  await page.locator('#admin-username').fill('syntheticowner');
  await page.locator('#admin-password').fill('test-only-password-123');
  await page.locator('#toggle-admin-password').click();
  await expect(page.locator('#admin-password')).toHaveAttribute('type','text');
  await page.locator('#toggle-admin-password').click();
  await expect(page.locator('#admin-password')).toHaveAttribute('type','password');
  await page.getByRole('button',{name:/Zaloguj się/}).click();
  await expect(page).toHaveURL(target);
  await expect(page.getByRole('heading',{name:'Panel administracyjny Newslettera'})).toBeVisible();
  const html = readFileSync(path.resolve(__dirname, '../../maintenance-site/paneladmin/index.html'), 'utf8');
  expect(html).toContain('noindex,nofollow,noarchive');
  expect(html).not.toContain('http-equiv="refresh"');
  expect(html).toContain("form-action 'self' https://gracz-contact-api.onrender.com");
  expect(html).toContain('id="login-failed"');
});
