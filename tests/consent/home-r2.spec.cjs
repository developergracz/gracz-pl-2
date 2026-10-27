const fs=require('node:fs');
const path=require('node:path');
const {test,expect}=require('@playwright/test');

// Approved owner image, not an experimental redesign: exact section hierarchy,
// featured photographs, five game tiles and working real routes.
for(const width of [360,390,768,1366,1920]){
 test('R4 approved image layout, '+width+'px',async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:850},deviceScaleFactor:1});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   await expect(page.locator('#gracz-cookie-consent')).toBeHidden();
   await expect(page.locator('h1')).toHaveCount(1);
   await expect(page.locator('#hero-title')).toHaveText('Polskie Centrum Gracza');
   await expect(page.locator('.r4-hero-motto')).toHaveText('Graj. Ucz się. Rywalizuj.');
   await expect(page.locator('.r4-hero-claim')).toHaveText('ZOSTAŃ NAJLEPSZYM GRACZEM !');
   await expect(page.locator('.r4-games-grid .r4-game')).toHaveCount(5);
   await expect(page.locator('.r4-shortcuts a')).toHaveCount(5);
   await expect(page.locator('.r4-guides-grid .r4-guide')).toHaveCount(4);
   await expect(page.locator('.r4-updates-grid .r4-update')).toHaveCount(3);
   await expect(page.locator('#spolecznosc')).toContainText('Forum w przygotowaniu');
   await expect(page.locator('#gracz-next')).toContainText('nie jest jeszcze publicznie dostępny');
   for(const [label,href] of [['Warcaby','/gry/warcaby/'],['Gomoku','/gry/gomoku/'],['Tysiąc','/gry/tysiac/'],['Poker treningowy','/gry/poker-treningowy/']]){
    const card=page.locator('.r4-game').filter({has:page.locator('h3', {hasText:label})});
    await expect(card).toHaveAttribute('href',href);
   }
   const form=page.locator('.site-footer form[data-newsletter]');
   await expect(form).toHaveCount(1);
   await expect(form.locator('button[type=submit]')).toBeDisabled();

   for(const asset of ['r4-reference-hero.webp','r4-reference-community.webp','r4-reference-newsletter.webp','r4-game-chess.webp','r4-game-checkers.webp','r4-game-gomoku.webp','r4-game-thousand.webp','r4-game-poker.webp']){
     const response=await page.request.get('/assets/'+asset);
     expect(response.status(),asset).toBe(200);
     expect((await response.body()).length,asset).toBeGreaterThan(1000);
   }
   await page.evaluate(()=>document.fonts.ready);
   const layout=await page.evaluate(()=>{
      const rect=q=>{const e=document.querySelector(q),r=e.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
       hero:rect('.r4-hero'),card:rect('.r4-game'),footer:rect('.footer-news'),
       legal:rect('.footer-bottom'),
       illustration:getComputedStyle(document.querySelector('.r4-hero-art')).backgroundImage,
       css:getComputedStyle(document.querySelector('.r4-games-grid')).gridTemplateColumns,
       header:rect('.site-header')};
   });
   console.log('R4_LAYOUT '+JSON.stringify(layout));
   expect(layout.scrollWidth).toBeLessThanOrEqual(width+2);
   expect(layout.card.width).toBeGreaterThan(90);
   expect(layout.card.left).toBeGreaterThanOrEqual(-1);
   expect(layout.card.right).toBeLessThanOrEqual(width+2);
   expect(layout.hero.height).toBeGreaterThan(300);
   expect(layout.illustration).toContain('r4-reference-hero.webp');
   expect(layout.footer.bottom).toBeLessThanOrEqual(layout.legal.top-2);
   await page.evaluate(()=>{for(const el of document.querySelectorAll('main > section'))el.style.contentVisibility='visible';});
   await page.locator('.footer-news').scrollIntoViewIfNeeded();
   // Sticky header must be captured at the top, not where footer scrolling left it.
   await page.evaluate(()=>scrollTo(0,0));
   await page.waitForTimeout(80);
   const filename=path.resolve('test-results/home-r4/full-'+width+'.png');
   fs.mkdirSync(path.dirname(filename),{recursive:true});
   await page.screenshot({path:filename,fullPage:true,animations:'disabled'});
  }finally{await context.close()}
 });
}
test('Search remains lazy and opens after real click',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
 await page.waitForLoadState('networkidle');
 await expect(page.locator('link[data-gracz-search-style]')).toHaveCount(0);
 await page.locator('.search-btn--desktop').click();
 await expect(page.locator('dialog.gracz-search')).toBeVisible({timeout:15000});
 await expect(page.locator('link[data-gracz-search-style]')).toHaveCount(1);
});

// R4 visual-fidelity regression: no clipped header search and the game card is a real link.
test('R4 desktop header search fits and a whole game card navigates', async ({browser}) => {
  for (const width of [1366,1600,1920]) {
    const context=await browser.newContext({viewport:{width,height:850}});
    try {
      const page=await context.newPage();
      await page.goto('/');
      await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
      const geometry=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};};
        const label=document.querySelector('.r4-search-label');
        return {header:rect('.site-header'),nav:rect('.main-nav'),search:rect('.search-btn--desktop'),
          actions:rect('.header-actions'),label:rect('.r4-search-label'),
          labelVisible:getComputedStyle(label).display!=='none',
          heroHeight:document.querySelector('.r4-hero').getBoundingClientRect().height,
          heroPhotoPosition:getComputedStyle(document.querySelector('.r4-hero-art')).position};
      });
      expect(geometry.actions.r).toBeLessThanOrEqual(width+2);
      expect(geometry.nav.r).toBeLessThanOrEqual(geometry.search.l+3);
      expect(geometry.search.t).toBeGreaterThanOrEqual(geometry.header.t-1);
      expect(geometry.search.b).toBeLessThanOrEqual(geometry.header.b+1);
      if(geometry.labelVisible){
        expect(geometry.label.t).toBeGreaterThanOrEqual(geometry.search.t-1);
        expect(geometry.label.b).toBeLessThanOrEqual(geometry.search.b+1);
        expect(geometry.label.r).toBeLessThanOrEqual(geometry.search.r+1);
      }
      expect(geometry.heroHeight).toBeGreaterThan(385);
      expect(geometry.heroHeight).toBeLessThanOrEqual(465);
      expect(geometry.heroPhotoPosition).toBe('absolute');
      if(width===1600){
        await page.locator('.r4-game').nth(1).click();
        await expect(page).toHaveURL(/\/gry\/warcaby\/$/);
      }
    } finally {await context.close();}
  }
});

test('R4 Newsletter opens its existing Premium dialog, without enabling held signup',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
  await page.locator('.site-header [data-newsletter-open]').click();
  await expect(page.locator('#newsletter-signup-modal')).toBeVisible({timeout:15000});
  await expect(page.locator('.site-footer form[data-newsletter] button[type=submit]')).toBeDisabled();
});
