const {test, expect} = require('@playwright/test');
const {readFileSync, readdirSync} = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../maintenance-site');
const pages = readdirSync(root, {recursive:true}).filter(p => p.endsWith('.html') && readFileSync(path.join(root,p),'utf8').includes('legal-links.js'));

test.beforeEach(async ({page}) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4174' ? route.continue() : route.abort());
});

test('maintenance persists after input, navigation and restored pages', async ({page}) => {
  const posts=[];
  page.on('request', r => {if(r.method()==='POST')posts.push(r.url());});
  await page.goto('/newsletter/');
  await expect(page.locator('#nl-form input[name="email"]')).toBeDisabled();
  await page.evaluate(() => {
    document.querySelector('#nl-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
  });
  await expect(page.locator('#nl-status')).toContainText('chwilowo niedostępny');
  await page.evaluate(() => {location.hash='unsubscribe=synthetic-bearer';});
  await expect(page.locator('#nl-action-button')).toBeEnabled();
  await expect(page.locator('#nl-action-status')).toContainText('Istniejący link pozostaje dostępny');
  await expect.poll(() => page.url()).not.toContain('synthetic-bearer');
  await page.evaluate(() => {location.hash='nl-maintenance-notice';});
  await expect(page.locator('#nl-status')).toContainText('chwilowo niedostępny');
  expect(posts).toEqual([]);
});

test('maintenance does not block an existing unsubscribe token', async ({page}) => {
  const calls=[];
  await page.route('https://gracz-contact-api.onrender.com/newsletter/unsubscribe', async route => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,state:'inactive'})});
  });
  await page.goto('/newsletter/#unsubscribe=synthetic-bearer');
  await expect(page.locator('#nl-action-button')).toBeEnabled();
  await page.locator('#nl-action-button').click();
  await expect(page.locator('#nl-action-title')).toHaveText('Subskrypcja wyłączona');
  expect(calls).toEqual([{token:'synthetic-bearer'}]);
});

test('paused contact form does not offer newsletter opt-in', async ({page}) => {
  await page.goto('/');
  await page.locator('[data-modal="contact"]').first().click();
  await expect(page.locator('.contact-form__newsletter')).toBeHidden();
  await expect(page.locator('[data-contact-form] [name="newsletter"]')).toBeDisabled();
});

test('every shared script reference invalidates the pre-maintenance cache', async () => {
  for(const file of pages){
    expect(readFileSync(path.join(root,file),'utf8'),file).toContain('/assets/legal-links.js?v=r38-maintenance-r2');
  }
});

for(const width of [390,768,1440]) test(`all footer surfaces fit maintenance text at ${width}px`,async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width,height:1000});
  const posts=[];
  page.on('request', r => {if(r.method()==='POST')posts.push(r.url());});
  for(const file of pages){
    await page.goto('/'+file);
    const reject=page.getByRole('button',{name:'Odrzuć wszystko'});
    if(await reject.isVisible())await reject.click();
    for(const form of await page.locator('form[data-newsletter]').all()){
      await expect(form.locator('button[type="submit"]'),file).toBeDisabled();
      const link=form.locator('[data-footer-newsletter-status] a');
      await expect(link,file).toBeVisible();
      await form.evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
      await expect(link,file).toBeVisible();
      await link.focus();
      await expect(link).toBeFocused();
      const geometry=await form.evaluate(f=>{
        const status=f.querySelector('[data-footer-newsletter-status]').getBoundingClientRect();
        const footer=f.closest('footer');
        const legal=footer?.querySelector('.footer-bottom, .footer-legal');
        return {right:status.right,left:status.left,bottom:status.bottom,legalTop:legal?.getBoundingClientRect().top};
      });
      expect(geometry.left,file).toBeGreaterThanOrEqual(0);
      expect(geometry.right,file).toBeLessThanOrEqual(width);
      if(geometry.legalTop)expect(geometry.bottom,file).toBeLessThanOrEqual(geometry.legalTop);
    }
  }
  expect(posts).toEqual([]);
});
