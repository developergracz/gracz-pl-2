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
   await expect(page.locator('#gracz-next')).toContainText('System kont użytkowników jest jeszcze przygotowywany');
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
   if(width>=681)expect(layout.illustration).toContain('r4-reference-hero-crisp.svg');
   else expect(layout.illustration).toContain('r4-reference-hero.webp');
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
      expect(Math.abs(geometry.heroHeight - Math.min(width,1500) * 914 / 1721)).toBeLessThan(3);
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


test('R13: approved Full Max artwork is actually displayed with accessible clickable CTAs',async({browser})=>{
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
   expect(dims.naturalWidth).toBe(1721);
   expect(dims.naturalHeight).toBe(914);
   expect(dims.src).toContain('hero-owner-fullmax-approved-r13.webp');
   expect(Math.abs(dims.heroRect.height/dims.heroRect.width-914/1721)).toBeLessThan(.01);
   expect(Math.abs(dims.imageRect.height/dims.imageRect.width-914/1721)).toBeLessThan(.02);
   expect(dims.heroRect.height).toBeGreaterThan(600);
   expect(dims.copyVisible).toContain('inset');
   expect(dims.overflow).toBeLessThanOrEqual(width+2);
   for(const rect of [dims.game,dims.guides]){
    expect(rect.left).toBeGreaterThanOrEqual(dims.heroRect.left);
    expect(rect.right).toBeLessThanOrEqual(dims.heroRect.right+2);
    expect(rect.top).toBeGreaterThanOrEqual(dims.heroRect.top);
    expect(rect.bottom).toBeLessThanOrEqual(dims.heroRect.bottom+2);
   }
   await expect(page.locator('.r4-owner-hotspot--games')).toHaveAttribute('href','/gry/');
   await expect(page.locator('.r4-owner-hotspot--guides')).toHaveAttribute('href','/poradniki/');
   if(width===1366) {
     await page.locator('.r4-owner-hotspot--games').click();
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
  await expect(page.locator('.r4-owner-picture')).toBeHidden();
  await expect(page.locator('.r4-hero-copy')).toBeVisible();
  await expect(page.locator('.r4-hero-actions a[href="/gry/"]')).toBeVisible();
  await expect(page.locator('.r4-hero-actions a[href="/poradniki/"]')).toBeVisible();
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
     blogCard:rect('.r4-update'),phone:rect('.r4-phone'),next:rect('.r4-next'),
     image:getComputedStyle(document.querySelector('.r4-guide-photo')).position,
     columns:getComputedStyle(document.querySelector('.r4-guides-grid')).gridTemplateColumns.split(' ').length,
     scrollWidth:document.documentElement.scrollWidth};
   });
   expect(m.scrollWidth).toBeLessThanOrEqual(width+2);
   expect(m.hero.h).toBeGreaterThan(620);
   expect(m.hero.h).toBeLessThan(810);
   expect(m.cVisual.x).toBeGreaterThan(m.community.x+m.community.w*.33);
   expect(m.cVisual.right).toBeLessThanOrEqual(m.community.right+2);
   expect(m.cVisual.h).toBeLessThan(m.community.h);
   expect(m.guide.h).toBeGreaterThan(210);
   expect(m.guide.h).toBeLessThan(250);
   expect(m.image).toBe('absolute');
   expect(m.columns).toBe(4);
   expect(m.phone.x).toBeGreaterThan(m.blogCard.right);
   expect(m.phone.y).toBeGreaterThanOrEqual(m.blog.y-1);
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
  expect(v.columns).toBe(2);
  expect(v.phone).toBe('none');
 }finally{await context.close();}
});

test('R5 desktop footer aligns its logo and newsletter image clears floating phone',async({browser})=>{
 for(const width of [1366,1600,1920]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const info=await page.evaluate(()=>{
     const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,midY:(r.top+r.bottom)/2};};
     const newsletter=document.querySelector('.site-footer .footer-news');
     return {scroll:document.documentElement.scrollWidth,
       phone:rect('.r4-phone'),blog:rect('.r4-updates'),
       news:rect('.site-footer .footer-news'),nav:rect('.site-footer .footer-bottom .legal'),
       logo:rect('.footer-signature-logo'),footer:rect('.site-footer .footer-bottom'),
       photo:rect('.site-footer .footer-news-photo'),
       logoDisplay:getComputedStyle(document.querySelector('.footer-signature-logo')).display
     };
   });
   expect(info.scroll).toBeLessThanOrEqual(width+2);
   expect(info.phone.left).toBeGreaterThan(info.blog.left+info.blog.width*.70);
   expect(info.phone.top).toBeGreaterThanOrEqual(info.blog.top-1);
   expect(info.photo.left).toBeGreaterThanOrEqual(info.news.left-1);
   expect(info.photo.right).toBeLessThanOrEqual(info.news.right-200);
   expect(info.photo.bottom).toBeLessThanOrEqual(info.news.bottom+2);
   expect(info.logoDisplay).not.toBe('none');
   expect(Math.abs(info.logo.midY-info.nav.midY)).toBeLessThanOrEqual(12);
   expect(info.logo.bottom).toBeLessThanOrEqual(info.footer.bottom+1);
   expect(info.phone.bottom).toBeLessThanOrEqual(info.footer.top+4);
   const form=page.locator('.site-footer form[data-newsletter]');
   await expect(form.locator('input[type=email]')).toBeVisible();
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   const notice=form.locator('.footer-newsletter-status');
   await expect(notice).toContainText('Zapisy do newslettera są tymczasowo niedostępne');
   await expect(notice.locator('a')).toHaveAttribute('href','/newsletter/#nl-maintenance-notice');
   const noticeFont=await notice.locator('a').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
   expect(noticeFont).toBeLessThan(13);
  }finally{await context.close()}
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
   expect(info.w).toBe(1282);
   expect(info.h).toBe(666);
   expect(info.displayW).toBeGreaterThan(250);
   expect(info.fit).toBe('contain');
   expect(info.src).toContain('gracz-community-art-sharp-r2.webp');
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
   await expect(cards.nth(1)).toContainText('Jak analizować swoje partie?');
   await expect(cards.nth(2)).toContainText('Tysiąc — historia i ciekawostki');
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
    expect(geo.phone.left).toBeGreaterThanOrEqual(geo.cards.right);
    expect(geo.phone.top).toBeGreaterThanOrEqual(geo.blog.top);
    expect(geo.phone.bottom).toBeGreaterThan(geo.next.top);
    expect(geo.news.left).toBeLessThan(geo.cards.left+3);
   }else{
    expect(geo.phoneDisplay).toBe('none');
   }
   const form=page.locator('.site-footer form[data-newsletter]');
   await expect(form).toHaveCount(1);
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   const signup=page.locator('#gracz-next [data-modal="register"]');
   await signup.click();
   await expect(page.getByRole('dialog')).toBeVisible();
  }finally{await context.close();}
 }
});

test('R10 original 720px newsletter photograph fits and keeps screen perspective',async({browser})=>{
 for(const width of [390,768,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const photo=page.locator('.site-footer .footer-news > img.footer-news-photo');
   await photo.scrollIntoViewIfNeeded();
   const result=await photo.evaluate(async(img)=>{
    await img.decode();
    const container=img.closest('.footer-news');
    const imgr=img.getBoundingClientRect();
    const box=container.getBoundingClientRect();
    const style=getComputedStyle(container),imgstyle=getComputedStyle(img);
    return {naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,
      visible:imgstyle.display!=='none',objectFit:imgstyle.objectFit,
      image:[imgr.left,imgr.top,imgr.right,imgr.bottom],
      container:[box.left,box.top,box.right,box.bottom],
      background:style.backgroundImage,
      scrollWidth:document.documentElement.scrollWidth};
   });
   expect(result.naturalWidth).toBe(720);
   expect(result.naturalHeight).toBe(374);
   expect(result.visible).toBe(true);
   expect(result.objectFit).toBe('contain');
   expect(result.background).not.toContain('newsletter.webp');
   expect(result.scrollWidth).toBeLessThanOrEqual(width+2);
   const [left,top,right,bottom]=result.image;
   const [cl,ct,cr,cb]=result.container;
   expect(left).toBeGreaterThanOrEqual(cl-2);
   expect(right).toBeLessThanOrEqual(cr+2);
   expect(top).toBeGreaterThanOrEqual(ct-2);
   expect(bottom).toBeLessThanOrEqual(cb+2);
   const signup=page.locator('.site-footer form[data-newsletter]');
   await expect(signup).toBeVisible();
   await expect(signup.locator('button[type=submit]')).toBeDisabled();
  }finally{await context.close()}
 }
});
