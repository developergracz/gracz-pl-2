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
   await expect(page.locator('.r4-hero-motto')).toHaveText('Graj, ucz się, rywalizuj.');
   await expect(page.locator('.r4-hero-claim')).toHaveText('ZOSTAŃ NAJLEPSZYM GRACZEM !');
   await expect(page.locator('.r4-games-grid .r4-game')).toHaveCount(5);
   await expect(page.locator('.r4-shortcuts a')).toHaveCount(5);
   await expect(page.locator('.r4-guides-grid .r4-guide')).toHaveCount(3);
   await expect(page.locator('.r4-updates-grid .r4-update')).toHaveCount(3);
   await expect(page.locator('#spolecznosc')).toContainText('Forum w przygotowaniu');
   await expect(page.locator('#gracz-next')).toContainText('System kont użytkowników jest jeszcze przygotowywany');
   for(const [label,href,academy] of [
    ['Szachy online','https://gracz-contact-api.onrender.com/konto/szachy/','Akademia szachów'],
    ['Warcaby','https://gracz-contact-api.onrender.com/konto/warcaby/','Akademia warcabów'],
    ['Gomoku','https://gracz-contact-api.onrender.com/konto/gomoku/','Akademia gomoku']]){
    const card=page.locator('#nasze-gry .r4-game').filter({has:page.locator('h3',{hasText:label})});
    await expect(card.locator('a.r4-game-play')).toHaveAttribute('href',href);
    await expect(card.locator('a.r4-game-academy')).toContainText(academy);
   }
   for(const label of ['Tysiąc','Poker treningowy']){
    const card=page.locator('#nasze-gry .r4-game').filter({has:page.locator('h3',{hasText:label})});
    await expect(card.locator('button.r4-game-coming')).toBeDisabled();
    await expect(card.locator('button.r4-game-coming')).toHaveText('Wkrótce');
    await expect(card.locator('a.r4-game-academy')).toHaveAttribute('href',/^\/gry\//);
   }
   const form=page.locator('.site-footer form[data-newsletter]');
   await expect(form).toHaveCount(1);
   await expect(form.locator('button[type=submit]')).toBeDisabled();

   for(const asset of ['r4-reference-hero.webp','r4-reference-community.webp','r4-reference-newsletter.webp','home-board-chess.svg','home-board-checkers.svg','home-board-gomoku.svg','home-board-thousand.svg','home-board-poker.svg','r4-game-thousand.webp','r4-game-poker.webp']){
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
   if(width>680 && width<1181){
     // Tablets show the same fixed console below the copy, not a second decorative artwork.
     await expect(page.locator('.r4-owner-picture')).toBeVisible();
     await expect(page.locator('.r4-hero-art')).toBeHidden();
     expect(await page.locator('.r4-owner-image').evaluate(img=>img.currentSrc)).toContain('gracz-hero-gomoku-mobile-preview-r1.webp');
   }
    if(width<=680){
      await expect(page.locator('.r4-owner-picture')).toBeVisible();
      await expect(page.locator('.r4-owner-image')).toHaveAttribute('fetchpriority','high');
       await expect(page.locator('.r4-owner-image')).toHaveAttribute('src','/assets/gracz-hero-gomoku-mobile-preview-r1.webp');
      await expect.poll(()=>page.locator('.r4-owner-image').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
    }
   expect(layout.footer.bottom,'Newsletter must not overlap legal footer').toBeLessThanOrEqual(layout.legal.top+2);
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
test('Header loupe opens the actual search page behind the guest gate',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
 await page.waitForLoadState('networkidle');
 await expect(page.locator('link[data-gracz-search-style]')).toHaveCount(0);
 await expect(page.locator('.search-btn--desktop')).toHaveAttribute('href','/szukaj/');
 await page.locator('.search-btn--desktop').click();
 await expect(page).toHaveURL(new URL('/szukaj/',page.url()).toString(),{timeout:15000});
 await expect(page.locator('#search-page-app input')).toBeVisible({timeout:15000});
 await expect(page.locator('#search-page-app')).toHaveAttribute('inert','');
 await expect(page.locator('#search-access-layer')).toBeVisible();
 await expect(page.getByRole('dialog',{name:/Nasza wyszukiwarka jest dostępna/})).toBeVisible();
 await expect(page.locator('.search-access-primary')).toHaveAttribute('href','https://gracz-contact-api.onrender.com/konto/?widok=login');
 await expect(page.locator('.search-access-secondary')).toHaveAttribute('href','https://gracz-contact-api.onrender.com/konto/');
 await expect(page.locator('dialog.gracz-search')).toHaveCount(0);
});

test('Search guest gate is responsive and the background stays visible',async({browser})=>{
 fs.mkdirSync(path.resolve('test-results/home-r4'),{recursive:true});
 for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
  const ctx=await browser.newContext({viewport});
  try{
   const page=await ctx.newPage();
   await page.goto('/szukaj/#gate=guest');
   await expect(page.locator('#search-access-layer')).toBeVisible();
   const g=await page.evaluate(()=>{
    const modal=document.querySelector('.search-access-panel').getBoundingClientRect();
    const bg=document.querySelector('#search-page-app').getBoundingClientRect();
    return {left:modal.left,right:modal.right,top:modal.top,bottom:modal.bottom,backgroundWidth:bg.width,viewportWidth:innerWidth};
   });
   expect(g.left).toBeGreaterThanOrEqual(0);
   expect(g.right).toBeLessThanOrEqual(viewport.width+1);
   expect(g.backgroundWidth).toBeGreaterThan(viewport.width*.60);
   expect(await page.locator('#search-page-app').getAttribute('inert')).toBe('');
   await page.screenshot({path:'test-results/home-r4/search-guest-'+viewport.width+'.png',animations:'disabled'});
  }finally{await ctx.close();}
 }
});

test('Verified one-time ticket removes only the guest gate',async({page})=>{
 await page.addInitScript(()=>{
  const actualFetch=window.fetch.bind(window);
  window.fetch=function(url,options){
   if(String(url).endsWith('/auth/search-ticket'))return Promise.resolve(
    new Response(JSON.stringify({ok:true,allowed:true}),{status:200,headers:{'content-type':'application/json'}})
   );
   return actualFetch(url,options);
  };
 });
 await page.goto('/szukaj/#gate='+('a'.repeat(48)));
 await expect(page.locator('#search-access-layer')).toHaveCount(0);
 await expect(page.locator('#search-page-app')).not.toHaveAttribute('inert');
 await expect(page.locator('#search-page-app input')).toBeVisible();
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
      expect(Math.abs(geometry.heroHeight - Math.min(width,1500) * 724 / 2172)).toBeLessThan(3);
      expect(geometry.heroPhotoPosition).toBe('absolute');
      if(width===1600){
        const game=page.locator('.r4-game').nth(1);
        await expect(game.locator('a.r4-game-play')).toHaveAttribute('href','https://gracz-contact-api.onrender.com/konto/warcaby/');
        await expect(game.locator('a.r4-game-academy')).toHaveAttribute('href','/gry/warcaby/zasady/');
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

// The approved artwork must decode cleanly at its explicit 2x SVG render size,
// not just be present as a CSS string or a 200 response.
test('R4 sharpened hero is valid, local, and decoded by Chrome',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const im=new Image();im.src='/assets/r4-reference-hero-crisp.svg';await im.decode();
  return {width:im.naturalWidth,height:im.naturalHeight};
 });
 expect(result).toEqual({width:1002,height:474});
 const response=await page.request.get('/assets/r4-reference-hero-crisp.svg');
 expect(response.status()).toBe(200);
 const svg=await response.text();
 expect(svg).toContain('feConvolveMatrix');
 expect(svg).not.toContain('<script');
});


test('Owner Premium: approved artwork, visible HTML copy and accessible CTAs',async({browser})=>{
 for(const width of [1181,1366,1649,1920]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const exact=page.locator('.r4-owner-image');
   await expect(exact).toBeVisible();
   await exact.evaluate(el=>el.decode());
   const dims=await exact.evaluate(el=>({
    naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight,
    src:el.currentSrc,
    imageRect:el.getBoundingClientRect().toJSON(),
    heroRect:document.querySelector('.r4-hero').getBoundingClientRect().toJSON(),
    game:document.querySelector('.r4-owner-hotspot--games').getBoundingClientRect().toJSON(),
    guides:document.querySelector('.r4-owner-hotspot--guides').getBoundingClientRect().toJSON(),
    copyVisible:getComputedStyle(document.querySelector('.r4-hero-copy')).clipPath,
    overflow:document.documentElement.scrollWidth
   }));
   expect(dims.naturalWidth).toBe(2172);
   expect(dims.naturalHeight).toBe(724);
   expect(dims.src).toContain('gracz-hero-gomoku-approved-r1.webp');
   expect(Math.abs(dims.heroRect.height/dims.heroRect.width-724/2172)).toBeLessThan(.01);
   expect(Math.abs(dims.imageRect.height/dims.imageRect.width-724/2172)).toBeLessThan(.02);
   expect(dims.heroRect.height).toBeGreaterThan(380);
   expect(dims.copyVisible).toBe('none');
   await expect(page.locator('.r4-hero-actions > a[href="/gry/"]')).toBeVisible();
   await expect(page.locator('.r4-hero-actions > a[href="/poradniki/"]')).toBeVisible();
   expect(dims.overflow).toBeLessThanOrEqual(width+2);
   await expect(page.locator('.r4-owner-hotspot--games')).toBeHidden();
   await expect(page.locator('.r4-owner-hotspot--guides')).toBeHidden();
   if(width===1366) {
     await page.locator('.r4-hero-actions > a[href="/gry/"]').click();
     await expect(page).toHaveURL(/\/gry\/$/);
   }
  }finally{await context.close()}
 }
});
test('Owner hero preserves responsive HTML copy and ordinary links on mobile',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{
  const page=await context.newPage();
  await page.goto('/');
  await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
  await expect(page.locator('.r4-owner-picture')).toBeVisible();
   await expect(page.locator('.r4-owner-image')).toBeVisible();
  await expect(page.locator('.r4-hero-copy')).toBeVisible();
  await expect(page.locator('.r4-hero-actions > a[href="/gry/"]')).toBeVisible();
  await expect(page.locator('.r4-hero-actions > a[href="/poradniki/"]')).toBeVisible();
 }finally{await context.close()}
});

test('Owner R5 compact desktop hierarchy and full community banner', async({browser})=>{
 for(const width of [1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const m=await page.evaluate(()=>{
    const rect=(s)=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    return {hero:rect('.r4-hero'),community:rect('.r4-community'),cVisual:rect('.r4-community-art'),
     guides:rect('.r4-guides'),guide:rect('.r4-guide'),blog:rect('.r4-updates'),
     blogCard:rect('.r4-update'),phone:rect('.r4-phone'),phoneDisplay:getComputedStyle(document.querySelector('.r4-phone')).display,next:rect('.r4-next'),
     image:getComputedStyle(document.querySelector('.r4-guide-photo')).position,
     columns:getComputedStyle(document.querySelector('.r4-guides-grid')).gridTemplateColumns.split(' ').length,
     scrollWidth:document.documentElement.scrollWidth};
   });
   expect(m.scrollWidth).toBeLessThanOrEqual(width+2);
   expect(Math.abs(m.hero.h-m.hero.w*724/2172)).toBeLessThan(3);
   expect(Math.abs(m.cVisual.x-(m.community.x+m.community.w*.22))).toBeLessThan(3);
   expect(m.cVisual.right).toBeLessThanOrEqual(m.community.right+2);
   expect(Math.abs(m.cVisual.h-m.community.h)).toBeLessThan(3);
   expect(m.guide.h).toBeGreaterThan(400);
   expect(m.guide.h).toBeLessThanOrEqual(512);
   expect(m.image).toBe('absolute');
   expect(m.columns).toBe(3);
   expect(m.phoneDisplay).toBe('none');
   expect(m.blogCard.w).toBeGreaterThan(200);
   await expect(page.locator('.r4-community-tags span')).toHaveCount(2);
   await expect(page.locator('.r4-phone-community')).toContainText('Forum w przygotowaniu');
   await expect(page.locator('.r4-guide[href="/gry/warcaby/zasady/"]')).toBeVisible();
  }finally{await context.close();}
 }
});
test('Owner R5 mobile keeps 2-column Academy and never overflows viewport',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{
  const page=await context.newPage();await page.goto('/');
  await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
  const v=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,
   columns:getComputedStyle(document.querySelector('.r4-guides-grid')).gridTemplateColumns.split(' ').length,
   phone:getComputedStyle(document.querySelector('.r4-phone')).display
  }));
  expect(v.scroll).toBeLessThanOrEqual(392);
  expect(v.columns).toBe(1);
  expect(v.phone).toBe('none');
 }finally{await context.close();}
});

test("R16 desktop footer keeps logo aligned and approved full artwork within container — Full Max Premium 2026",async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('#newsletter-home.footer-news--fullmax-r1');
   const image=section.locator('.footer-news-fullmax-scene img');
   const form=section.locator('form[data-newsletter]');
   await section.scrollIntoViewIfNeeded();
   await expect(section).toBeVisible();
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:15000}).toBe(true);
   await expect(section.locator('#f-news')).toContainText('Bądź na bieżąco');
   await expect(form.locator('input[type=email]')).toBeVisible();
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   const notice=form.locator('.footer-newsletter-status');
   await expect(notice).toContainText('Zapisy do newslettera są tymczasowo niedostępne');
   const state=await section.evaluate(el=>{
    const a=el.getBoundingClientRect();
    const b=el.querySelector('img').getBoundingClientRect();
    const form=el.querySelector('form').getBoundingClientRect();
    return {section:{left:a.left,right:a.right,width:a.width},image:{width:b.width},form:{left:form.left,right:form.right},scroll:document.documentElement.scrollWidth};
   });
   expect(state.scroll).toBeLessThanOrEqual(width+2);
   expect(state.section.left).toBeGreaterThanOrEqual(-2);
   expect(state.section.right).toBeLessThanOrEqual(width+2);
   expect(state.image.width).toBeGreaterThan(100);
   expect(state.form.left).toBeGreaterThanOrEqual(state.section.left-2);
   expect(state.form.right).toBeLessThanOrEqual(state.section.right+2);
  }finally{await context.close();}
 }
});
test('R5 mobile footer retains original brand without duplicate link or overflow',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{
  const page=await context.newPage();await page.goto('/');
  await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
  const state=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,
   addedLogo:getComputedStyle(document.querySelector('.footer-signature-logo')).display,
   baseLogo:getComputedStyle(document.querySelector('.site-footer .footer-brand')).display,
   phone:getComputedStyle(document.querySelector('.r4-phone')).display
  }));
  expect(state.scroll).toBeLessThanOrEqual(392);
  expect(state.addedLogo).toBe('none');
  expect(state.baseLogo).not.toBe('none');
  expect(state.phone).toBe('none');
 }finally{await context.close();}
});


test('Full Max Premium community artwork decodes, stays responsive and opens forum info',async({browser})=>{
 for(const width of [390,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:880}});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('#spolecznosc');
   const image=section.locator('img.r4-community-art');
   await expect(section.getByRole('heading',{name:'Społeczność GRACZ.PL'})).toBeVisible();
   await image.scrollIntoViewIfNeeded();
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
   const info=await image.evaluate(async img=>{
    await img.decode();
    const rect=img.getBoundingClientRect();
    return {w:img.naturalWidth,h:img.naturalHeight,displayW:rect.width,src:img.currentSrc,
      fit:getComputedStyle(img).objectFit,overflow:document.documentElement.scrollWidth};
   });
   expect(info.w).toBe(1383);
   expect(info.h).toBe(631);
   expect(info.displayW).toBeGreaterThan(250);
   expect(info.fit).toBe('contain');
   expect(info.src).toContain('gracz-community-owner-accepted-20261028.avif');
   expect(info.overflow).toBeLessThanOrEqual(width+2);
   const button=section.getByRole('button',{name:'Dołącz do rozmowy'});
   await expect(button).toBeVisible();
   await button.click();
   await expect(page.getByRole('dialog')).toBeVisible();
   await expect(page.locator('#modal-title')).toContainText('Forum gracz.pl jest w trakcie budowy');
  }finally{await context.close()}
 }
});

test('Owner R6 blog entries, preview alignment and newsletter behavior match approved lower layout',async({browser})=>{
 for(const width of [390,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const cards=page.locator('#aktualnosci .r4-update');
   await expect(cards).toHaveCount(3);
   await expect(cards.nth(0)).toContainText('Turnieje szachowe');
   await expect(cards.nth(1)).toContainText('Analiza partii szachowych krok po kroku');
   await expect(cards.nth(2)).toContainText('Tysiąc — zasady, taktyka');
   await expect(page.locator('#gracz-next')).toContainText('System kont użytkowników jest jeszcze przygotowywany');
   const geo=await page.evaluate(()=>{
    const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    return {scroll:document.documentElement.scrollWidth,blog:rect('.r4-updates'),
      cards:rect('.r4-updates-grid'),phone:rect('.r4-phone'),next:rect('.r4-next'),
      news:rect('.site-footer .footer-news'),
      phoneDisplay:getComputedStyle(document.querySelector('.r4-phone')).display};
   });
   expect(geo.scroll).toBeLessThanOrEqual(width+2);
   if(width>1180){
    expect(geo.phoneDisplay).toBe('none');
    expect(geo.cards.right).toBeLessThanOrEqual(geo.blog.right+2);
    expect(geo.blog.bottom).toBeLessThanOrEqual(geo.next.top+2);
    expect(Math.abs(geo.news.width-width),'Full Max newsletter spans the entire desktop width').toBeLessThanOrEqual(3);
    expect(Math.abs((geo.news.left+geo.news.right)/2-width/2)).toBeLessThanOrEqual(30);
   }else{
    expect(geo.phoneDisplay).toBe('none');
   }
   const form=page.locator('.site-footer form[data-newsletter]');
   await expect(form).toHaveCount(1);
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   const signup=page.locator('#gracz-next a.r4-btn-gold[href="https://gracz-contact-api.onrender.com/konto/"]');
   await expect(signup).toBeVisible();
   // Account navigation must still work without the homepage JavaScript.
   await page.route('https://gracz-contact-api.onrender.com/konto/',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Konto gracz.pl</title><h1>Załóż konto w gracz.pl</h1>'}));
   await signup.click();
   await expect(page).toHaveURL('https://gracz-contact-api.onrender.com/konto/');
   // Destination URL is the contract; the live account page is served by a separate Render service.
  }finally{await context.close();}
 }
});

test("R16 displays exact accepted full newsletter artwork with a genuine aligned form — Full Max Premium 2026",async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('#newsletter-home.footer-news--fullmax-r1');
   const image=section.locator('.footer-news-fullmax-scene img');
   const form=section.locator('form[data-newsletter]');
   await section.scrollIntoViewIfNeeded();
   await expect(section).toBeVisible();
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:15000}).toBe(true);
   await expect(section.locator('#f-news')).toContainText('Bądź na bieżąco');
   await expect(form.locator('input[type=email]')).toBeVisible();
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   const notice=form.locator('.footer-newsletter-status');
   await expect(notice).toContainText('Zapisy do newslettera są tymczasowo niedostępne');
   const state=await section.evaluate(el=>{
    const a=el.getBoundingClientRect();
    const b=el.querySelector('img').getBoundingClientRect();
    const form=el.querySelector('form').getBoundingClientRect();
    return {section:{left:a.left,right:a.right,width:a.width},image:{width:b.width},form:{left:form.left,right:form.right},scroll:document.documentElement.scrollWidth};
   });
   expect(state.scroll).toBeLessThanOrEqual(width+2);
   expect(state.section.left).toBeGreaterThanOrEqual(-2);
   expect(state.section.right).toBeLessThanOrEqual(width+2);
   expect(state.image.width).toBeGreaterThan(100);
   expect(state.form.left).toBeGreaterThanOrEqual(state.section.left-2);
   expect(state.form.right).toBeLessThanOrEqual(state.section.right+2);
  }finally{await context.close();}
 }
});
test("R29 newsletter artwork fits complete desktop viewport without cropping — Full Max Premium 2026",async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('#newsletter-home.footer-news--fullmax-r1');
   const image=section.locator('.footer-news-fullmax-scene img');
   const form=section.locator('form[data-newsletter]');
   await section.scrollIntoViewIfNeeded();
   await expect(section).toBeVisible();
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:15000}).toBe(true);
   await expect(section.locator('#f-news')).toContainText('Bądź na bieżąco');
   await expect(form.locator('input[type=email]')).toBeVisible();
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   const notice=form.locator('.footer-newsletter-status');
   await expect(notice).toContainText('Zapisy do newslettera są tymczasowo niedostępne');
   const state=await section.evaluate(el=>{
    const a=el.getBoundingClientRect();
    const b=el.querySelector('img').getBoundingClientRect();
    const form=el.querySelector('form').getBoundingClientRect();
    return {section:{left:a.left,right:a.right,width:a.width},image:{width:b.width},form:{left:form.left,right:form.right},scroll:document.documentElement.scrollWidth};
   });
   expect(state.scroll).toBeLessThanOrEqual(width+2);
   expect(state.section.left).toBeGreaterThanOrEqual(-2);
   expect(state.section.right).toBeLessThanOrEqual(width+2);
   expect(state.image.width).toBeGreaterThan(100);
   expect(state.form.left).toBeGreaterThanOrEqual(state.section.left-2);
   expect(state.form.right).toBeLessThanOrEqual(state.section.right+2);
  }finally{await context.close();}
 }
});
test("R21 actual newsletter is full-width on phones and loads real images — Full Max Premium 2026",async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('#newsletter-home.footer-news--fullmax-r1');
   const image=section.locator('.footer-news-fullmax-scene img');
   const form=section.locator('form[data-newsletter]');
   await section.scrollIntoViewIfNeeded();
   await expect(section).toBeVisible();
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:15000}).toBe(true);
   await expect(section.locator('#f-news')).toContainText('Bądź na bieżąco');
   await expect(form.locator('input[type=email]')).toBeVisible();
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   const notice=form.locator('.footer-newsletter-status');
   await expect(notice).toContainText('Zapisy do newslettera są tymczasowo niedostępne');
   const state=await section.evaluate(el=>{
    const a=el.getBoundingClientRect();
    const b=el.querySelector('img').getBoundingClientRect();
    const form=el.querySelector('form').getBoundingClientRect();
    return {section:{left:a.left,right:a.right,width:a.width},image:{width:b.width},form:{left:form.left,right:form.right},scroll:document.documentElement.scrollWidth};
   });
   expect(state.scroll).toBeLessThanOrEqual(width+2);
   expect(state.section.left).toBeGreaterThanOrEqual(-2);
   expect(state.section.right).toBeLessThanOrEqual(width+2);
   expect(state.image.width).toBeGreaterThan(100);
   expect(state.form.left).toBeGreaterThanOrEqual(state.section.left-2);
   expect(state.form.right).toBeLessThanOrEqual(state.section.right+2);
  }finally{await context.close();}
 }
});
test("R29 approved newsletter image stays fully visible and centered — Full Max Premium 2026",async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('#newsletter-home.footer-news--fullmax-r1');
   const image=section.locator('.footer-news-fullmax-scene img');
   const form=section.locator('form[data-newsletter]');
   await section.scrollIntoViewIfNeeded();
   await expect(section).toBeVisible();
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:15000}).toBe(true);
   await expect(section.locator('#f-news')).toContainText('Bądź na bieżąco');
   await expect(form.locator('input[type=email]')).toBeVisible();
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   const notice=form.locator('.footer-newsletter-status');
   await expect(notice).toContainText('Zapisy do newslettera są tymczasowo niedostępne');
   const state=await section.evaluate(el=>{
    const a=el.getBoundingClientRect();
    const b=el.querySelector('img').getBoundingClientRect();
    const form=el.querySelector('form').getBoundingClientRect();
    return {section:{left:a.left,right:a.right,width:a.width},image:{width:b.width},form:{left:form.left,right:form.right},scroll:document.documentElement.scrollWidth};
   });
   expect(state.scroll).toBeLessThanOrEqual(width+2);
   expect(state.section.left).toBeGreaterThanOrEqual(-2);
   expect(state.section.right).toBeLessThanOrEqual(width+2);
   expect(state.image.width).toBeGreaterThan(100);
   expect(state.form.left).toBeGreaterThanOrEqual(state.section.left-2);
   expect(state.form.right).toBeLessThanOrEqual(state.section.right+2);
  }finally{await context.close();}
 }
});
test('Approved six-card images are unique and all local assets resolve',async({browser})=>{
 const cards=[
 ['#poradniki-academy .r4-approved-guide-chess','academy-chess-premium-r1.webp'],
 ['#poradniki-academy .r4-approved-guide-checkers','academy-checkers-premium-r1.webp'],
 ['#poradniki-academy .r4-approved-guide-poker','academy-poker-premium-r1.webp'],
 ['#aktualnosci .r4-approved-blog-tournament','gracz-news-tournament-premium-r1.webp'],
 ['#aktualnosci .r4-approved-blog-analysis','gracz-news-analysis-premium-r1.webp'],
 ['#aktualnosci .r4-approved-blog-thousand','gracz-news-thousand-premium-r1.webp']
 ];
 for(const width of [390,768,1366]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const backgrounds=[];
   for(const [selector,filename] of cards){
    const tile=page.locator(selector);
    await expect(tile).toHaveCount(1);
    const bg=await tile.evaluate(el=>getComputedStyle(el).backgroundImage);
    expect(bg).toContain(filename);backgrounds.push(bg);
    const response=await page.request.get('/assets/'+filename);
    expect(response.status(),filename).toBe(200);
    expect((await response.body()).length,filename).toBeGreaterThan(2000);
   }
   expect(new Set(backgrounds).size).toBe(6);
   await expect(page.locator('#poradniki-academy .r4-guide[href="/gry/poker-treningowy/"]')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await context.close();}
 }
});

test('Approved gallery photo framing, legibility and viewport stability',async({browser})=>{
 for(const width of [390,1366,1920]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await ctx.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const positions=[
    ['.r4-approved-guide-chess','0%'],['.r4-approved-guide-checkers','0%'],
    ['.r4-approved-guide-poker','0%'],['.r4-approved-blog-tournament','0%'],
    ['.r4-approved-blog-analysis','45%'],['.r4-approved-blog-thousand','94%']
   ];
   for(const [selector,y] of positions){
    const tile=page.locator(selector);await expect(tile).toHaveCount(1);
    const s=await tile.evaluate(el=>({photo:getComputedStyle(el).backgroundImage,position:getComputedStyle(el).backgroundPosition,contrast:getComputedStyle(el).filter}));
    expect(s.photo).toContain(selector.includes('blog-thousand')?'gracz-news-thousand-premium-r1.webp':selector.includes('blog-analysis')?'gracz-news-analysis-premium-r1.webp':selector.includes('blog-')?'gracz-news-tournament-premium-r1.webp':'academy-'+selector.split('-').pop()+'-premium-r1.webp');
    expect(s.position).toContain(selector.includes('blog-')?'50%':y);
    expect(s.contrast).toBe('none');
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await ctx.close();}
 }
});

test('Academy premium graphics stay static, readable and only in Poradniki i Academy',async({browser})=>{
 const files=['academy-chess-premium-r1.webp','academy-checkers-premium-r1.webp','academy-poker-premium-r1.webp'];
 for(const file of files){
  const bytes=fs.readFileSync(path.join(__dirname,'../../maintenance-site/assets',file));
  expect(bytes.subarray(0,4).toString(),file).toBe('RIFF');
  expect(bytes.subarray(8,12).toString(),file).toBe('WEBP');
  expect(bytes.includes(Buffer.from('ANIM')),file+' must not be animated').toBe(false);
 }
 const guides=[
  ['/poradniki/','SZACHY','10 zasad skutecznego rozwoju w szachach'],
  ['/gry/warcaby/zasady/','WARCABY','Strategie w warcabach — od podstaw do zaawansowanych taktyk'],
  ['/gry/poker-treningowy/','POKER','Jak czytać przeciwników w pokerze?']
 ];
 for(const width of [390,1366]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const users=await page.evaluate(()=>[...document.querySelectorAll('body *')]
    .filter(el=>/academy-(chess|checkers|poker)-premium-r1\.webp/.test(getComputedStyle(el).backgroundImage))
    .map(el=>({inAcademy:!!el.closest('#poradniki-academy'),inGames:!!el.closest('#nasze-gry'),cls:el.className})));
   expect(users).toHaveLength(3);
   for(const u of users){expect(u.inAcademy,u.cls).toBe(true);expect(u.inGames,u.cls).toBe(false);}
   const cards=page.locator('#poradniki-academy .r4-guide');
   await expect(cards).toHaveCount(3);
   for(const [i,[href,label,title]] of guides.entries()){
    const card=cards.nth(i);
    await expect(card).toHaveAttribute('href',href);
    await expect(card.locator('.r4-guide-body small')).toHaveText(label);
    await expect(card.locator('.r4-guide-body strong')).toHaveText(title);
    const s=await card.evaluate(a=>{const p=getComputedStyle(a.querySelector('.r4-guide-photo'));
     return {anim:p.animationName,filter:p.filter,transform:p.transform}});
    expect(s).toEqual({anim:'none',filter:'none',transform:'none'});
   }
  }finally{await context.close();}
 }
});

test('Owner Full Max Premium gallery uses large responsive cards and circular links',async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   await expect(page.locator('#poradniki-academy .r4-guide')).toHaveCount(3);
   await expect(page.locator('#aktualnosci .r4-update')).toHaveCount(3);
   await expect(page.locator('.r4-premium-card-arrow')).toHaveCount(6);
   await expect(page.locator('#poradniki-academy .r4-premium-section-link')).toHaveAttribute('href','/poradniki/');
   await expect(page.locator('#aktualnosci .r4-premium-section-link')).toHaveAttribute('href','/poradniki/');
   await expect(page.locator('#aktualnosci .r4-phone')).toBeHidden();
   const d=await page.evaluate(()=>{
    const rect=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {h:r.height,bottom:r.bottom}};
    const cols=sel=>getComputedStyle(document.querySelector(sel)).gridTemplateColumns.split(' ').length;
    return {scroll:document.documentElement.scrollWidth,guide:rect('#poradniki-academy .r4-guide'),blog:rect('#aktualnosci .r4-update'),section:rect('#aktualnosci'),guides:cols('#poradniki-academy .r4-guides-grid'),blogs:cols('#aktualnosci .r4-updates-grid'),phone:getComputedStyle(document.querySelector('#aktualnosci .r4-phone')).display};
   });
   const n=width<=680?1:width<=1180?2:3;
   const blogCols=width<=680?2:width<=960?3:5;
   expect(d.guides).toBe(n);expect(d.blogs).toBe(blogCols);
   expect(d.guide.h).toBeGreaterThanOrEqual(width<=680?350:400);
   expect(d.blog.h).toBeGreaterThanOrEqual(370);
   expect(d.blog.bottom).toBeLessThanOrEqual(d.section.bottom+2);
   expect(d.phone).toBe('none');expect(d.scroll).toBeLessThanOrEqual(width+2);
  }finally{await context.close();}
 }
});

test('Owner-approved sharp Blog photos and Full Max Premium arrows render correctly',async({browser})=>{
 for(const width of [390,1366]){
  const context=await browser.newContext({viewport:{width,height:850}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const cards=page.locator('#aktualnosci .r4-update');
   await expect(cards).toHaveCount(3);
   const expected=[
     'gracz-news-tournament-premium-r1.webp',
     'gracz-news-analysis-premium-r1.webp',
     'gracz-news-thousand-premium-r1.webp'
   ];
   for(let i=0;i<3;i++){
     const card=cards.nth(i),photo=card.locator('.r4-update-photo');
     const arrow=card.locator('.r4-premium-card-arrow');
     await expect(arrow).toBeVisible();
     expect(await arrow.evaluate(el=>getComputedStyle(el).boxShadow)).not.toBe('none');
     expect(await photo.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain(expected[i]);
     expect(await photo.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
     const response=await page.request.get('/assets/'+expected[i]);
     expect(response.status(),expected[i]).toBe(200);
     const bytes=(await response.body()).length;expect(bytes).toBeGreaterThan(i===0?25000:10000);if(i>0)expect(bytes).toBeLessThan(65000);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await context.close();}
 }
});

test('Approved Tysiac illustration loads without duplicated text',async({browser})=>{
 for(const width of [390,1366]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await ctx.newPage();await page.goto('/');
   const card=page.locator('#aktualnosci .r4-update').nth(2);
   const photo=card.locator('img.r4-approved-blog-thousand');
   await expect(photo).toHaveAttribute('src','/assets/gracz-news-thousand-premium-r1.webp');
   await expect(photo).toHaveAttribute('alt','');
   await expect(photo).toHaveAttribute('loading','lazy');
   await photo.scrollIntoViewIfNeeded();
   await expect.poll(async()=>photo.evaluate(el=>el.naturalWidth)).toBe(720);
   await expect(photo).toHaveCSS('object-fit','cover');
   await expect(card.locator('.r4-update-body strong')).toHaveText('Tysiąc — zasady, taktyka i najważniejsze wskazówki');
   const response=await page.request.get('/assets/gracz-news-thousand-premium-r1.webp');
   expect(response.status()).toBe(200);
   expect((await response.body()).length).toBeGreaterThan(10000);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await ctx.close();}
 }
});

// The two approved static illustrations load as real files; card text remains HTML.
test('Two illustrated Academy news scenes load as native images without duplicate card copy',async({browser})=>{
 for(const width of [390,1366]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await ctx.newPage();await page.goto('/');
   for(const [selector,filename] of [
    ['.r4-approved-blog-analysis','gracz-news-analysis-premium-r1.webp'],
    ['.r4-approved-blog-thousand','gracz-news-thousand-premium-r1.webp']
   ]){
    const photo=page.locator('#aktualnosci img'+selector);
    await expect(photo).toHaveCount(1);
    await expect(photo).toHaveAttribute('src','/assets/'+filename);
    await expect(photo).toHaveAttribute('alt','');
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(async()=>photo.evaluate(el=>el.naturalWidth)).toBe(720);
    await expect(photo).toHaveCSS('object-fit','cover');
   }
   await expect(page.locator('#aktualnosci .r4-update-body')).toHaveCount(3);
   await expect(page.locator('#aktualnosci .r4-premium-card-arrow')).toHaveCount(3);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await ctx.close();}
 }
});


test('Premium Academy and Blog circular CTA arrows remain centered at mobile and desktop widths',async({browser})=>{
 for(const width of [390,768,1366]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await ctx.newPage();await page.goto('/');
   const arrows=page.locator('#poradniki-academy .r4-premium-card-arrow, #aktualnosci .r4-premium-card-arrow');
   await expect(arrows).toHaveCount(6);
   for(const arrow of await arrows.all()){
    const m=await arrow.evaluate(el=>{
     const css=getComputedStyle(el),box=el.getBoundingClientRect();
     const range=document.createRange();range.selectNodeContents(el);
     const glyph=range.getBoundingClientRect();
     return {display:css.display,justify:css.justifyContent,align:css.alignItems,
       padding:css.padding,gap:css.gap,width:box.width,height:box.height,
       deltaX:Math.abs((glyph.left+glyph.width/2)-(box.left+box.width/2)),
       deltaY:Math.abs((glyph.top+glyph.height/2)-(box.top+box.height/2))};
    });
    expect(m.display).toBe('flex');expect(m.justify).toBe('center');expect(m.align).toBe('center');
    expect(m.padding).toBe('0px');expect(m.gap).toBe('0px');
    expect(Math.abs(m.width-m.height)).toBeLessThanOrEqual(1);
    expect(m.deltaX).toBeLessThanOrEqual(3);expect(m.deltaY).toBeLessThanOrEqual(3);
   }
  }finally{await ctx.close();}
 }
});


test('Gracz.pl board thumbnails load and display in all three premium game cards',async({browser})=>{
 for(const width of [390,1366]){
  const ctx=await browser.newContext({viewport:{width,height:850}});
  try{
   const page=await ctx.newPage();await page.goto('/');
   for(const [klass,file] of [['r4-img-chess','home-board-chess.svg'],['r4-img-checkers','home-board-checkers.svg'],['r4-img-gomoku','home-board-gomoku.svg']]){
    const photo=page.locator('#nasze-gry .r4-game-image.'+klass);
    await expect(photo).toHaveCount(1);
    await expect.poll(async()=>photo.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('/assets/'+file);
    const response=await page.request.get('/assets/'+file);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
    expect((await response.body()).length).toBeGreaterThan(5000);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await ctx.close();}
 }
});

// HERO R3: one fixed console; only the board, console details and the game CTA change every 5 s.
test('HERO R3 rotates Gomoku, Warcaby and coming soon in one fixed console',async({browser})=>{
 const steps=[
  ['gomoku','Zagraj w gomoku','https://gracz-contact-api.onrender.com/konto/gomoku/'],
  ['warcaby','Zagraj w warcaby','https://gracz-contact-api.onrender.com/konto/warcaby/'],
  ['soon','Poznaj kolejne gry','/gry/'],
  ['gomoku','Zagraj w gomoku','https://gracz-contact-api.onrender.com/konto/gomoku/']];
 for(const width of [390,768,1366,1920]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await page.clock.install();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const hero=page.locator('.r4-hero');
   for(const selector of ['#hero-title','.r4-hero-motto','.r4-hero-claim','.r4-hero-description'])
     await expect(page.locator(selector)).toBeVisible();
   await expect(page.locator('.r4-hero-actions svg')).toHaveCount(0);
   await expect(page.locator('.r4-hero-live-actions')).toHaveCount(0);
   await expect(page.locator('#r4-hero-checkers-board .r4-sq')).toHaveCount(64);
   await expect(page.locator('#r4-hero-checkers-board .r4-sq--dark .r4-man--white')).toHaveCount(12);
   await expect(page.locator('#r4-hero-checkers-board .r4-sq--dark .r4-man--black')).toHaveCount(12);
   const stage=await page.locator('.r4-console-stage').boundingBox();
   for(const [i,[slide,label,href]] of steps.entries()){
    if(i)await page.clock.runFor(5000);
    await expect(hero).toHaveAttribute('data-hero-slide',slide);
    const active=page.locator('.r4-game-cta-stack > a').filter({visible:true});
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText(label);
    await expect(active).toHaveAttribute('href',href);
    // Only the current game's panes are shown; Gomoku is the artwork itself.
    await expect.poll(()=>page.evaluate(()=>[...new Set([...document.querySelectorAll('.r4-pane')]
      .filter(e=>getComputedStyle(e).visibility==='visible').map(e=>e.dataset.pane))].join('|'))).toBe(slide==='gomoku'?'':slide);
    expect(await page.locator('.r4-console-stage').boundingBox()).toEqual(stage);
    const layout=await page.evaluate(()=>{
     const boxes=[...document.querySelectorAll('.r4-hero-actions > a, .r4-game-cta-stack')].map(e=>e.getBoundingClientRect());
     const overlap=boxes.some((a,i)=>boxes.some((b,j)=>j>i&&a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1));
     const clipped=[...document.querySelectorAll('.r4-hero-actions .r4-btn')].some(e=>e.scrollWidth>e.clientWidth+1);
     return {overlap,clipped,scrollWidth:document.documentElement.scrollWidth};
    });
    expect(layout.overlap).toBe(false);
    expect(layout.clipped).toBe(false);
    expect(layout.scrollWidth).toBeLessThanOrEqual(width+2);
   }
  }finally{await context.close()}
 }
});

test('Five premium game cards: linked live games and disabled upcoming games remain compact',async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   const cards=page.locator('#nasze-gry .r4-game-premium');
   await expect(cards).toHaveCount(5);
   await expect(cards.locator('a.r4-game-play')).toHaveCount(3);
   await expect(cards.locator('button.r4-game-coming:disabled')).toHaveCount(2);
   await expect(cards.locator('a.r4-game-academy')).toHaveCount(5);
   const measured=await page.evaluate(()=>({
    sw:document.documentElement.scrollWidth,
    cards:[...document.querySelectorAll('#nasze-gry .r4-game-premium')].map(e=>{
     const r=e.getBoundingClientRect();return {h:r.height,l:r.left,r:r.right};
    }),
    images:[...document.querySelectorAll('#nasze-gry .r4-game-premium .r4-game-image')].map(e=>getComputedStyle(e).backgroundImage)
   }));
   expect(measured.sw).toBeLessThanOrEqual(width+2);
   expect(measured.cards.every(c=>c.l>=-1&&c.r<=width+2&&c.h>235)).toBe(true);
   expect(measured.images[3]).toContain('home-board-thousand.svg');
   expect(measured.images[4]).toContain('home-board-poker.svg');
   if(width>=1366)expect(Math.max(...measured.cards.map(c=>c.h))).toBeLessThan(415);
  }finally{await context.close();}
 }
});

// Decodes a PNG screenshot in a blank page and walks inward from every edge of the
// preview over a pure magenta test backdrop: each row and column must reach the solid
// gold frame before meeting any turquoise-tinted pixel (blue above red). Anti-aliased
// gold blended with magenta keeps red >= blue, so it is allowed on the way in.
async function previewEdgeScan(context,png){
 const page=await context.newPage();
 try{
  return await page.evaluate(async b64=>{
   const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
   const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
   const g=c.getContext('2d');g.drawImage(img,0,0);
   const {data,width:w,height:h}=g.getImageData(0,0,c.width,c.height);
   const px=(x,y)=>{const k=(y*w+x)*4;return [data[k],data[k+1],data[k+2]];};
   const magenta=([r,g,b])=>r>=250&&b>=250&&g<=5;
   const bad=[];let edges=0;
   const walk=(x,y,dx,dy)=>{
    for(;x>=0&&y>=0&&x<w&&y<h;x+=dx,y+=dy){
     const [r,g,b]=px(x,y);
     if(r>=250&&b>=250&&g<=5)continue;
     if(r>=120&&g>=100&&r-b>=20){edges++;return;}
     if(b-r>2){bad.push([x,y,r,g,b]);return;}
    }
    bad.push([x,y,'no gold frame']);
   };
   for(let y=0;y<h;y++){walk(0,y,1,0);walk(w-1,y,-1,0);}
   for(let x=0;x<w;x++){walk(x,0,0,1);walk(x,h-1,0,-1);}
   return {w,h,edges,badCount:bad.length,bad:bad.slice(0,8),
    corners:[px(0,0),px(w-1,0),px(0,h-1),px(w-1,h-1)].every(magenta)};
  },png.toString('base64'));
 }finally{await page.close();}
}

test('Chess console hover preview shows the Owner image enlarged, in view and without shifting cards',async({browser})=>{
 fs.mkdirSync(path.resolve('test-results/home-r4'),{recursive:true});
 for(const [width,height,dpr] of [[1366,768,1],[1920,1080,2],[1024,768,1]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const card=page.locator('#nasze-gry .r4-game-chess');
   const thumb=card.locator('.r4-img-chess');
   const preview=card.locator('.r4-game-preview');
   const image=preview.locator('img');
   await expect(image).toHaveAttribute('src','/assets/home-chess-console-preview.webp');
   await expect(image).toHaveAttribute('alt',/Szachy online/);
   await expect(card.locator('a.r4-game-play')).toHaveAttribute('href','https://gracz-contact-api.onrender.com/konto/szachy/');
   await expect(card.locator('a.r4-game-academy')).toHaveAttribute('href','/poradniki/');
   await expect(preview.locator('a,button,[tabindex]')).toHaveCount(0);
   await expect(preview).toBeHidden();
   await thumb.scrollIntoViewIfNeeded();
   const cards=()=>page.locator('#nasze-gry .r4-game-premium').evaluateAll(els=>els.map(e=>{
    const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(Math.round).join(',');}).join('|'));
   const before=await cards();
   await thumb.hover();
   await expect(preview).toBeVisible();
   await expect.poll(()=>preview.evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
   await expect.poll(()=>image.evaluate(i=>i.complete?i.naturalWidth:0)).toBeGreaterThan(0);
   const m=await page.evaluate(()=>{
    const p=document.querySelector('#nasze-gry .r4-game-chess .r4-game-preview'),i=p.querySelector('img');
    const r=p.getBoundingClientRect(),ir=i.getBoundingClientRect(),s=getComputedStyle(p);
    return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,
     gaps:[ir.left-r.left,ir.top-r.top,r.right-ir.right,r.bottom-ir.bottom],
     boxRatio:ir.width/ir.height,natural:[i.naturalWidth,i.naturalHeight],
     pad:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],
     border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],
     bg:s.backgroundColor,bgImage:s.backgroundImage,shadow:s.boxShadow,outline:s.outlineStyle,
     overflow:s.overflow,radius:[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius],
     pe:s.pointerEvents,sw:document.documentElement.scrollWidth};
   });
   expect(m.w).toBeGreaterThanOrEqual(500);
   expect(m.w).toBeLessThanOrEqual(600);
   expect(m.l).toBeGreaterThanOrEqual(0);
   expect(m.r).toBeLessThanOrEqual(width);
   expect(m.t).toBeGreaterThanOrEqual(0);
   expect(m.b).toBeLessThanOrEqual(height);
   // Owner image cropped exactly to the outer gold frame; proportions preserved.
   expect(m.natural).toEqual([588,329]);
   expect(Math.abs(m.boxRatio-588/329)).toBeLessThan(0.01);
   // The image fills the popup: no padding, frame, backdrop, shadow or empty margins.
   for(const gap of m.gaps)expect(Math.abs(gap)).toBeLessThan(0.6);
   expect(m.pad).toEqual(['0px','0px','0px','0px']);
   expect(m.border).toEqual(['0px','0px','0px','0px']);
   expect(m.bg).toBe('rgba(0, 0, 0, 0)');
   expect(m.bgImage).toBe('none');
   expect(m.shadow).toBe('none');
   expect(m.outline).toBe('none');
   expect(m.overflow).toBe('hidden');
   for(const radius of m.radius)expect(parseFloat(radius)).toBeGreaterThan(0);
   expect(m.pe).toBe('none');
   expect(m.sw).toBeLessThanOrEqual(width);
   expect(await cards()).toBe(before);
   await page.screenshot({path:'test-results/home-r4/chess-hover-preview-'+width+'.png',animations:'disabled',
    clip:{x:Math.max(0,m.l-24),y:Math.max(0,m.t-24),width:Math.min(width,m.r+24)-Math.max(0,m.l-24),height:Math.min(height,m.b+24)-Math.max(0,m.t-24)}});
   // PASS criterion: paint everything around the image magenta (test-only), then no
   // turquoise backdrop may appear between the popup edge and the outer gold frame.
   await preview.evaluate(p=>{
    p.style.setProperty('background','#f0f','important');
    p.style.setProperty('box-shadow','0 0 0 48px #f0f','important');
   });
   const shot=await page.screenshot({clip:{x:m.l,y:m.t,width:m.w,height:m.h},animations:'disabled'});
   await preview.evaluate(p=>{p.style.removeProperty('background');p.style.removeProperty('box-shadow');});
   const scan=await previewEdgeScan(context,shot);
   expect(scan.w).toBeGreaterThanOrEqual(Math.floor(m.w*dpr)-1);
   expect(scan.corners).toBe(true);
   expect(scan.edges).toBe(2*(scan.w+scan.h));
   expect(scan.bad,'turquoise or non-gold pixels outside the gold frame').toEqual([]);
   await page.mouse.move(width-4,height-4);
   await expect(preview).toBeHidden();
   await card.locator('a.r4-game-play').scrollIntoViewIfNeeded();
   const play=await card.locator('a.r4-game-play').boundingBox();
   expect(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.closest('a')?.className,[play.x+play.width/2,play.y+play.height/2])).toBe('r4-game-play');
  }finally{await context.close();}
 }
});

test('Chess console hover preview stays off on touch devices without overflow',async({browser})=>{
 for(const [width,height] of [[390,844],[1024,768]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const card=page.locator('#nasze-gry .r4-game-chess');
   await card.locator('.r4-img-chess').tap();
   await expect(card.locator('.r4-game-preview')).toBeHidden();
   await expect(card.locator('a.r4-game-play')).toBeVisible();
   await expect(card.locator('a.r4-game-academy')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await context.close();}
 }
});


test('Blog tiles match Nasze gry compact width without clipped copy',async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const g=await page.evaluate(()=>({gameWidth:document.querySelector('#nasze-gry .r4-game').getBoundingClientRect().width,
    cards:[...document.querySelectorAll('#aktualnosci .r4-update')].map(card=>{
      const im=card.querySelector('.r4-update-photo').getBoundingClientRect();
      const body=card.querySelector('.r4-update-body');
      const r=card.getBoundingClientRect();
      return {width:r.width,right:r.right,imageHeight:im.height,imageBottom:im.bottom,
       textTop:body.getBoundingClientRect().top,bodyHeight:body.clientHeight,textScroll:body.scrollHeight};
    }),scrollWidth:document.documentElement.scrollWidth}));
   console.log('NEWS_TILE_DIMENSIONS',width,JSON.stringify(g));
   expect(g.cards).toHaveLength(3);
   for(const card of g.cards){
    expect(Math.abs(card.width-g.gameWidth)).toBeLessThan(2);
    expect(card.imageHeight).toBeGreaterThan(100);
    expect(card.imageHeight).toBeLessThanOrEqual(191);
    expect(card.imageBottom).toBeLessThanOrEqual(card.textTop+2);
    expect(card.textScroll).toBeLessThanOrEqual(card.bodyHeight+2);
    expect(card.right).toBeLessThanOrEqual(width+2);
   }
   expect(g.scrollWidth).toBeLessThanOrEqual(width+2);
  }finally{await context.close();}
 }
});
