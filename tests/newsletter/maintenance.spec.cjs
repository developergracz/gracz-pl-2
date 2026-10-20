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
  await expect(page.locator('#nl-action-status')).toContainText('Operacje newslettera są chwilowo niedostępne');
  await expect.poll(() => page.url()).not.toContain('synthetic-bearer');
  await page.evaluate(() => {location.hash='nl-maintenance-notice';});
  await expect(page.locator('#nl-status')).toContainText('chwilowo niedostępny');
  expect(posts).toEqual([]);
});

test('maintenance does not block an existing unsubscribe token', async ({page}) => {
  const calls=[];
  await page.route('https://gracz-contact-api.onrender.com/newsletter/unsubscribe', async route => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,state:'unsubscribed'})});
  });
  await page.goto('/newsletter/#unsubscribe=synthetic-bearer');
  await expect(page.locator('#nl-action-button')).toBeEnabled();
  await page.locator('#nl-action-button').click();
  await expect(page.locator('#nl-action-title')).toHaveText('Subskrypcja wyłączona');
  expect(calls).toEqual([{token:'synthetic-bearer'}]);
});

test('paused contact form does not offer newsletter opt-in', async ({page}) => {
  await page.goto('/');
  await page.evaluate(() => document.querySelector('[data-modal="contact"]').click());
  await expect(page.locator('.contact-form__newsletter')).toBeHidden();
  await expect(page.locator('[data-contact-form] [name="newsletter"]')).toBeDisabled();
});

test('confirmed backend readiness enables newsletter signup, but not by stale /health', async ({page}) => {
  await page.route('https://gracz-contact-api.onrender.com/newsletter/ready', route =>
    route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ready:true,configured:true,intakePaused:false,schemaReady:true})}));
  await page.goto('/newsletter/');
  await expect(page.locator('#nl-submit')).toBeEnabled();
  await expect(page.locator('#nl-consent')).toBeEnabled();
  await expect(page.locator('#nl-request-button')).toBeEnabled();
  await expect(page.locator('#nl-maintenance-notice')).toBeHidden();
  await page.goto('/');
  const form=page.locator('form[data-newsletter]').first();
  await expect(form.locator('button[type="submit"]')).toBeEnabled();
  await expect(form.locator('input[type="email"]')).toBeEnabled();
  await page.evaluate(() => document.querySelector('[data-modal="contact"]').click());
  await expect(page.locator('.contact-form__newsletter')).toBeVisible();
  await expect(page.locator('[data-contact-form] [name="newsletter"]')).toBeEnabled();
});

test('new-only DOI readiness enables subscribe and verified status without reviving legacy tokens', async ({page}) => {
  await page.route('https://gracz-contact-api.onrender.com/newsletter/ready', route =>
    route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ready:true,configured:true,intakePaused:false,schemaReady:true,newOnly:true})}));
  await page.goto('/newsletter/');
  await expect(page.locator('#nl-submit')).toBeEnabled();
  await expect(page.locator('#nl-consent')).toBeEnabled();
  await expect(page.locator('#nl-request-button')).toBeEnabled();
  await expect(page.locator('#nl-status-panel')).toBeVisible();
  await page.goto('/newsletter/#confirm=n1.compromised');
  await expect(page.locator('#nl-action-button')).toBeDisabled();
});

test('new-only readiness permits footer DOI but never contact-form legacy opt-in', async ({page}) => {
  await page.route('https://gracz-contact-api.onrender.com/newsletter/ready', route =>
    route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ready:true,configured:true,intakePaused:false,schemaReady:true,newOnly:true})}));
  await page.goto('/');
  const footer=page.locator('form[data-newsletter]').first();
  await expect(footer.locator('button[type="submit"]')).toBeEnabled();
  await expect(footer.locator('input[name="consent"]')).toBeEnabled();
  await page.evaluate(() => document.querySelector('[data-modal="contact"]').click());
  await expect(page.locator('.contact-form__newsletter')).toBeHidden();
  await expect(page.locator('[data-contact-form] [name="newsletter"]')).toBeDisabled();
});

test('HTTP 200 without schema confirmation still blocks newsletter signup', async ({page}) => {
  await page.route('https://gracz-contact-api.onrender.com/newsletter/ready', route =>
    route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ready:true,configured:true,intakePaused:false,schemaReady:false})}));
  await page.goto('/newsletter/');
  await expect(page.locator('#nl-submit')).toBeDisabled();
  await expect(page.locator('#nl-maintenance-notice')).toBeVisible();
});

test('every shared script reference invalidates the pre-maintenance cache', async () => {
  for(const file of pages){
    expect(readFileSync(path.join(root,file),'utf8'),file).toMatch(/\/assets\/legal-links\.js\?v=r(?:40-new-only-r1|41-active-modal-r1|42-verified-status-r1|43-verified-copy-r1|44-live-duplicate-r1)/);
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

for(const mode of ['confirm','unsubscribe','status']) for(const prefix of ['n1','ns1']) {
  test(`compromised ${prefix} ${mode} never posts, including restored navigation`,async({page})=>{
    const posts=[];
    page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
    await page.goto('/newsletter/#'+mode+'='+prefix+'.synthetic-forged');
    await expect(page.locator('#nl-action-button')).toBeDisabled();
    await expect(page.locator('#nl-action-status')).toContainText('Ten link został unieważniony');
    await expect(page.locator('#nl-action-button')).toBeHidden();
    await expect(page.locator('#nl-action-status')).toBeFocused();
    await expect(page.locator('#nl-action-status')).toContainText('Nie potwierdzono zmiany subskrypcji');
    expect(page.url()).not.toContain('synthetic-forged');
    await page.evaluate(()=>{
      document.querySelector('#nl-action-button').dispatchEvent(new MouseEvent('click'));
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    });
    await page.evaluate(({mode,prefix})=>{location.hash=mode+'='+prefix+'.synthetic-replay';},{mode,prefix});
    await expect(page.locator('#nl-action-button')).toBeDisabled();
    await page.evaluate(()=>document.querySelector('#nl-action-button').dispatchEvent(new MouseEvent('click')));
    expect(posts).toEqual([]);
  });
}


for(const prefix of ['n1','ns1']) for(const mode of ['confirm','unsubscribe','status']) {
  test('revoked '+prefix+' '+mode+' link with leading whitespace never allows action',async({page})=>{
    const outgoing=[];
    page.on('request',request=>{if(request.method()==='POST')outgoing.push(request.url());});
    await page.goto('/newsletter/#'+mode+'=%20'+prefix+'.synthetic-retired');
    await expect(page.locator('#nl-action-title')).toHaveText('Link został unieważniony');
    await expect(page.locator('#nl-action-button')).toBeHidden();
    await expect(page.locator('#nl-action-status')).toContainText('Nie potwierdzono zmiany subskrypcji');
    await expect.poll(()=>page.url()).not.toContain('synthetic-retired');
    expect(outgoing).toHaveLength(0);
  });
}
