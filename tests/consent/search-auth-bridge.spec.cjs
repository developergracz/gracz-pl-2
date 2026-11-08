const {test,expect}=require('@playwright/test');

test('search gate owns login status and header never navigates to a second auth bridge',async({page})=>{
 const requests=[];
 page.on('request',r=>{if(r.url().includes('/auth/header-sync'))requests.push(r.url());});
 await page.goto('/szukaj/#gate=guest',{waitUntil:'networkidle'});
 const gate=page.locator('#search-access-layer');
 await expect(gate).toBeVisible();
 await expect(page.locator('#search-page-app .gracz-search-page__panel')).toBeVisible();
 await expect(page.locator('header.site-header')).toHaveAttribute('data-session-header','out');
 await expect(page.locator('.search-access-primary')).toHaveText(/Zaloguj się/);
 await expect(page.locator('.search-access-secondary')).toHaveText(/Załóż konto/);
 expect(requests).toHaveLength(0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gracz:search-access-state',{detail:{state:'in'}})));
 await expect(page.locator('header.site-header')).toHaveAttribute('data-session-header','in');
 await expect(page.locator('header .gracz-my-panel')).toBeVisible();
 await expect(page.locator('header .header-actions button').filter({hasText:'Wyloguj się'})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gracz:search-access-state',{detail:{state:'out'}})));
 await expect(page.locator('header.site-header')).toHaveAttribute('data-session-header','out');
 await expect(page.locator('header .header-actions a').filter({hasText:'Zaloguj się'})).toBeVisible();
 expect(requests).toHaveLength(0);
});
