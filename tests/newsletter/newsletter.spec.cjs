const { test, expect } = require('@playwright/test');
const API='https://gracz-contact-api.onrender.com';
// Every external request is intercepted. These tests can never send real mail.
async function mock(page, handler = () => ({ok:true,state:'request_received'})) {
  const requests=[];
  await page.route('**/*', async route => {
    const request=route.request(), url=new URL(request.url());
    if(url.origin==='http://127.0.0.1:4174')return route.continue();
    if(url.origin!==API)return route.abort();
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST','access-control-allow-headers':'content-type'}});
    const payload=request.postDataJSON();requests.push({path:url.pathname,payload});
    const response=await handler(url.pathname,payload);
    return route.fulfill({status:response.http||200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)}).catch(()=>{});
  });
  return requests;
}
test('inline validation, keyboard focus, clearing and voluntary status request', async ({page},info) => {
  const requests=await mock(page);
  await page.goto('/newsletter/');
  await page.locator('#nl-submit').click();
  await expect(page.locator('#nl-email')).toBeFocused();
  await expect(page.locator('#nl-email')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#nl-consent')).toHaveAttribute('aria-invalid','true');
  expect(requests).toHaveLength(0);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:info.outputPath('newsletter-validation.png'),fullPage:true});
  await page.locator('#nl-email').fill('player@example.com');
  await expect(page.locator('#nl-email')).not.toHaveAttribute('aria-invalid','true');
  await page.locator('#nl-submit').click();
  await expect(page.locator('#nl-consent')).toBeFocused();
  await page.locator('#nl-consent').press('Space');
  await page.locator('#nl-submit').click();
  await expect(page.locator('#nl-status')).toContainText('przyjęte do obsługi');
  await page.locator('#nl-check-email').fill('owner@example.com');
  await page.locator('#nl-check-email').press('Enter');
  await expect(page.locator('#nl-request-status')).toContainText('nie potwierdza statusu');
  expect(requests.map(r=>r.path)).toEqual(['/newsletter/subscribe','/newsletter/status-request']);
  expect(requests[1].payload).not.toHaveProperty('consent');
  await expect(page.locator('#nl-consent')).not.toBeChecked();
  expect(await page.locator('.nl-shell').evaluate(node=>node.getBoundingClientRect().right<=innerWidth)).toBe(true);
  if(info.project.name==='mobile')expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for (const state of ['active','pending','inactive']) {
  test(`proof click reveals ${state}, token removed before request`, async ({page},info) => {
    const requests=await mock(page,()=>({ok:true,state}));
    await page.goto('/newsletter/#status=secret-proof');
    const csp=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp.split(';').map(value=>value.trim()).find(value=>value.startsWith('script-src '))).toBe("script-src 'self'");
    await expect(page.locator('#nl-action-button')).toHaveText('Sprawdź status');
    expect(page.url()).not.toContain('secret-proof');
    expect(requests).toHaveLength(0);
    expect(await page.evaluate(()=>JSON.stringify(history.state))).not.toContain('secret-proof');
    await page.locator('#nl-action-button').click();
    await expect(page.locator('#nl-action-status')).toContainText({active:'Newsletter aktywny',pending:'Oczekuje na potwierdzenie',inactive:'Newsletter nieaktywny'}[state]);
    await expect(page.locator('#nl-action-status')).toHaveAttribute('aria-live','polite');
    expect(requests).toEqual([{path:'/newsletter/status-check',payload:{token:'secret-proof'}}]);
    await expect(page.locator('#nl-action-title')).toHaveText({active:'Newsletter aktywny',pending:'Oczekuje na potwierdzenie',inactive:'Newsletter nieaktywny'}[state]);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:info.outputPath('newsletter-status-'+state+'.png'),fullPage:true});
    await page.reload();
    await expect(page.locator('#nl-action-panel')).toBeHidden();
  });
}
test('same tab hashes, back/forward, stale completion, and confirm/unsubscribe',async({page})=>{
  let release;const held=new Promise(resolve=>{release=resolve;});
  const requests=await mock(page,async(path)=>{if(path.endsWith('status-check'))await held;return {ok:true,state:'active'};});
  await page.goto('/newsletter/');
  await page.evaluate(()=>{location.hash='status=first-secret';});
  await expect(page.locator('#nl-action-button')).toHaveText('Sprawdź status');
  await page.locator('#nl-action-button').click();
  await expect.poll(()=>requests.length).toBe(1);
  await page.evaluate(()=>{location.hash='confirm=second-secret';});
  await expect(page.locator('#nl-action-button')).toHaveText('Potwierdź zapis');
  release();
  await expect(page.locator('#nl-action-title')).toHaveText('Potwierdź zapis do newslettera');
  await page.locator('#nl-action-button').click();
  await expect(page.locator('#nl-action-status')).toHaveText('Gotowe.');
  await page.evaluate(()=>{location.hash='unsubscribe=third-secret';});
  await expect(page.locator('#nl-action-button')).toHaveText('Wypisz mnie');
  await page.locator('#nl-action-button').click();
  await expect(page.locator('#nl-action-title')).toHaveText('Subskrypcja wyłączona');
  await page.goBack();
  await expect(page.locator('#nl-action-panel')).toBeHidden();
  expect(page.url()).not.toContain('secret');
  await page.goForward();
  await expect(page.locator('#nl-action-panel')).toBeHidden();
  expect(page.url()).not.toContain('secret');
  expect(requests.map(r=>r.path)).toEqual(['/newsletter/status-check','/newsletter/confirm','/newsletter/unsubscribe']);
});
test('replay, invalid links and unavailable use generic errors',async({page})=>{
  const used=new Set();await mock(page,(_path,{token})=>{
    if(token==='unavailable')return {http:503,ok:false,error:{message:'private diagnostic'}};
    if(used.has(token)||token==='invalid')return {http:400,ok:false,error:{message:'private subscriber record'}};
    used.add(token);return {ok:true,state:'inactive'};
  });
  for(const [index,token] of ['once','once','invalid','unavailable'].entries()) {
    await page.goto('/newsletter/#status='+token);
    await page.locator('#nl-action-button').click();
    if(index===0)await expect(page.locator('#nl-action-status')).toContainText('Newsletter nieaktywny');
    else await expect(page.locator('#nl-action-status')).toContainText(token==='unavailable'?'chwilowo niedostępna':'Poproś o nowy bezpieczny link');
    await expect(page.locator('#nl-action-status')).not.toContainText('private');
  }
  await expect(page.locator('#nl-action-status')).toContainText('chwilowo niedostępna');
});
test('bounded timeout is ambiguous, no concurrent duplicate request',async({page})=>{
  await page.clock.install();
  const requests=await mock(page,()=>new Promise(()=>{}));
  await page.goto('/newsletter/');
  await page.locator('#nl-check-email').fill('owner@example.com');
  await page.locator('#nl-request-button').click();
  await page.locator('#nl-status-form').evaluate(form=>{form.dispatchEvent(new Event('submit',{cancelable:true}));});
  await expect.poll(()=>requests.length).toBe(1);
  await page.clock.fastForward(31000);
  await expect(page.locator('#nl-request-status')).toContainText('mogło zostać przyjęte');
  await expect(page.locator('#nl-request-status')).not.toContainText('Spróbuj ponownie');
  expect(requests).toHaveLength(1);
});
test('footer premium validation and modal link share the status flow',async({page},info)=>{
  const requests=await mock(page);
  await page.goto('/');
  const reject=page.getByRole('button', { name: 'Odrzuć wszystko' });
  if(await reject.count())await reject.click();
  const form=page.locator('form[data-newsletter]').first();
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('[name=email]')).toBeFocused();
  await expect(form.locator('[name=email]')).toHaveAttribute('aria-invalid','true');
  expect(requests).toHaveLength(0);
  await form.locator('[name=email]').fill('player@example.com');
  await form.locator('[name=consent]').check();
  await form.locator('button[type="submit"]').click();
  const dialog=page.locator('#newsletter-success-modal');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('nie potwierdza statusu subskrypcji ani dostarczenia');
  await page.screenshot({path:info.outputPath('footer-newsletter-modal.png'),fullPage:false});
  await dialog.locator('a[href="/newsletter/#nl-status-panel"]').click();
  await expect(page.locator('#nl-status-form')).toBeVisible();
});
test('malformed email blocks request and leaving page discards bearer action',async({page})=>{
  const requests=await mock(page);
  await page.goto('/newsletter/');
  await page.locator('#nl-check-email').fill('broken-address');
  await page.locator('#nl-request-button').click();
  await expect(page.locator('#nl-check-email')).toBeFocused();
  await expect(page.locator('#nl-check-email-error')).toContainText('poprawny adres');
  expect(requests).toHaveLength(0);
  await page.goto('/newsletter/#status=leave-secret');
  await expect(page.locator('#nl-action-button')).toBeVisible();
  await page.goto('/polityka-prywatnosci/');
  await page.goBack();
  await expect(page.locator('#nl-action-panel')).toBeHidden();
  expect(page.url()).not.toContain('leave-secret');
  expect(requests).toHaveLength(0);
});
for(const mode of ['confirm','unsubscribe']) {
  test(`${mode} transient failure retries same action token without requesting new DOI`,async({page})=>{
    let attempts=0;const requests=await mock(page,()=>++attempts===1?{http:503,ok:false}:{ok:true,state:mode==='confirm'?'subscribed':'unsubscribed'});
    await page.goto('/newsletter/#'+mode+'=same-action-token');
    await page.locator('#nl-action-button').click();
    await expect(page.locator('#nl-action-button')).toHaveText('Sprawdź wynik ponownie');
    await expect(page.locator('#nl-action-status')).toContainText('tym samym linkiem');
    await page.locator('#nl-action-button').click();
    await expect(page.locator('#nl-action-status')).toHaveText('Gotowe.');
    await expect(page.locator('#nl-action-status')).toHaveAttribute('aria-live','polite');
    expect(requests).toEqual([{path:'/newsletter/'+mode,payload:{token:'same-action-token'}},{path:'/newsletter/'+mode,payload:{token:'same-action-token'}}]);
  });
}
