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
   for(const [label,href] of [['Warcaby','/gry/warcaby/'],['Gomoku','/gry/gomoku/'],['Tysiąc','/gry/tysiac/'],['Poker treningowy','/gry/poker-treningowy/']]){
    const card=page.locator('.r4-game').filter({has:page.locator('h3', {hasText:label})});
    await expect(card).toHaveAttribute('href',href);
   }
   const form=page.locator('.site-footer form[data-newsletter]');
   await expect(form).toHaveCount(1);
   await expect(form.locator('button[type=submit]')).toBeDisabled();

   for(const asset of ['r4-reference-hero.webp','r4-reference-community.webp','r4-reference-newsletter.webp','gracz-game-chess-online-premium-r12.avif','gracz-game-checkers-premium-r12.avif','r4-game-gomoku.webp','r4-game-thousand.webp','r4-game-poker.webp']){
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
   if(width>680 && width<1181)expect(layout.illustration).toContain('gracz-hero-mobile-art-r14.webp');
    if(width<=680){
      await expect(page.locator('.r4-owner-picture')).toBeVisible();
      await expect(page.locator('.r4-owner-image')).toHaveAttribute('fetchpriority','high');
       await expect(page.locator('.r4-owner-image')).toHaveAttribute('src','/assets/gracz-hero-mobile-lcp-r16.webp');
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
      expect(Math.abs(geometry.heroHeight - Math.min(width,1500) * 724 / 2172)).toBeLessThan(3);
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


test('R14: approved Full Max artwork is actually displayed with accessible clickable CTAs',async({browser})=>{
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
   expect(dims.src).toContain('gracz-hero-approved-r14.webp');
   expect(Math.abs(dims.heroRect.height/dims.heroRect.width-724/2172)).toBeLessThan(.01);
   expect(Math.abs(dims.imageRect.height/dims.imageRect.width-724/2172)).toBeLessThan(.02);
   expect(dims.heroRect.height).toBeGreaterThan(380);
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
   for(const hotspot of ['.r4-owner-hotspot--games','.r4-owner-hotspot--guides']) {
     await page.locator(hotspot).hover();
     expect(await page.locator(hotspot).evaluate(el=>getComputedStyle(el).boxShadow)).toBe('none');
   }
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
  await expect(page.locator('.r4-owner-picture')).toBeVisible();
   await expect(page.locator('.r4-owner-image')).toBeVisible();
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

test('R16 desktop footer keeps logo aligned and approved full artwork within container',async({browser})=>{
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
       photo:rect('.site-footer .footer-news-full-art-r16'),
       phoneDisplay:getComputedStyle(document.querySelector('.r4-phone')).display,
       logoDisplay:getComputedStyle(document.querySelector('.footer-signature-logo')).display
     };
   });
   expect(info.scroll).toBeLessThanOrEqual(width+2);
   expect(info.phoneDisplay).toBe('none');
   expect(info.photo.left).toBeGreaterThanOrEqual(info.news.left-1);
   expect(info.photo.left).toBeGreaterThanOrEqual(info.news.left-1);
   expect(info.photo.right).toBeLessThanOrEqual(info.news.right+2);
   expect(info.photo.bottom).toBeLessThanOrEqual(info.news.bottom+2);
   expect(info.logoDisplay).not.toBe('none');
   expect(Math.abs(info.logo.midY-info.nav.midY)).toBeLessThanOrEqual(12);
   expect(info.logo.bottom).toBeLessThanOrEqual(info.footer.bottom+1);
   expect(info.photo.bottom).toBeLessThanOrEqual(info.news.bottom+2);
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
    expect(geo.news.width,'R27 newsletter fills the desktop width').toBeGreaterThanOrEqual(width-2);
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

test('R16 displays exact accepted full newsletter artwork with a genuine aligned form',async({browser})=>{
 test.setTimeout(60000); // Sequential viewport matrix on CI.
 const approvedImage=fs.readFileSync(path.join(__dirname,'../../maintenance-site/assets/gracz-newsletter-full-approved-r16.webp'));
 const approvedSHA=require('node:crypto').createHash('sha256').update(approvedImage).digest('hex');
 expect(approvedSHA,'Only the exact Owner-approved R16 art may pass').toBe('1f4d91984b76e50cada7c1409aced20e85a0eeb9f0af3a69e34a9737dae8988c');
 for(const width of [390,768,960,1024,1366,1600]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const scene=page.locator('.site-footer .footer-news > img.footer-news-full-art-r16');
   const phone=page.locator('.site-footer .footer-news > img.footer-news-smartphone');
   const form=page.locator('.site-footer form[data-newsletter]');
   await form.scrollIntoViewIfNeeded();
   await expect(scene).toHaveAttribute('src','/assets/gracz-newsletter-full-approved-r16.webp');
   await expect(form).toBeVisible();
   await expect(form.locator('#news-email')).toHaveAttribute('type','email');
   if(width>960){
    // The approved image itself contains the placeholder; check real input hides it.
    const style=await form.locator('#news-email').evaluate(el=>{
      const css=getComputedStyle(el);
      return {background:css.backgroundColor,fill:css.webkitTextFillColor,shadow:css.boxShadow,opacity:css.opacity};
    });
    expect(style.background).toBe('rgb(255, 255, 255)');
    expect(style.fill).toBe('rgb(20, 38, 55)');
    expect(style.shadow).toContain('999px');
    expect(style.opacity).toBe('1');
   }
   await expect(form.locator('button[type=submit]')).toBeDisabled();
   if(width>960){
    await expect.poll(()=>scene.evaluate(img=>img.complete && img.naturalWidth===1671),{timeout:10000}).toBe(true);
   }
   const state=await page.evaluate(()=>{
    const section=document.querySelector('.site-footer .footer-news');
    const scene=section.querySelector('img.footer-news-full-art-r16');
    const phone=section.querySelector('img.footer-news-smartphone');
    const rect=el=>{const r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom];};
    const form=section.querySelector('form[data-newsletter]');
    return {section:rect(section),scene:rect(scene),phone:rect(phone),
      form:rect(form),email:rect(form.querySelector('input[type=email]')),
      submit:rect(form.querySelector('button[type=submit]')),
      consent:rect(form.querySelector('[data-footer-newsletter-consent]')),
      sceneDisplayed:getComputedStyle(scene).display!=='none',
      phoneDisplayed:getComputedStyle(phone).display!=='none',
      natural:[scene.naturalWidth,scene.naturalHeight],
      overflow:document.documentElement.scrollWidth};
   });
   expect(state.overflow).toBeLessThanOrEqual(width+2);
   if(width>960){
    expect(state.sceneDisplayed).toBe(true);
    expect(state.natural).toEqual([1671,941]);
    expect(state.phoneDisplayed).toBe(false);
    const [x,y,r,b]=state.section;
    const [sx,sy,sr,sb]=state.scene;
    const [fx,fy,fr,fb]=state.form;
    expect(Math.abs(sx-x)).toBeLessThanOrEqual(2);
    expect(Math.abs(sr-r)).toBeLessThanOrEqual(2);
    expect(Math.abs(sy-y)).toBeLessThanOrEqual(2);
    expect(Math.abs((b-y)-(sb-sy))).toBeLessThanOrEqual(3);
    expect(Math.abs((fx-x)/(r-x)-.0312)).toBeLessThan(.018);
    expect(Math.abs((fy-y)/(b-y)-.3920)).toBeLessThan(.022);
    expect(Math.abs((fr-fx)/(r-x)-.4505)).toBeLessThan(.024);
    expect(Math.abs((fb-fy)/(b-y)-.0800)).toBeLessThan(.024);
    expect(Math.abs((r-x)-width),'R27 artwork fills viewport width').toBeLessThanOrEqual(2);
    const [ex,ey,er,eb]=state.email;
    const [bx,by,br,bb]=state.submit;
    expect(er).toBeLessThanOrEqual(bx+2);
    expect(Math.abs(ey-by)).toBeLessThanOrEqual(2);
    expect(Math.abs(eb-bb)).toBeLessThanOrEqual(2);
    expect(state.consent[0]).toBeGreaterThanOrEqual(fx-2);
    expect(state.consent[1]).toBeGreaterThanOrEqual(fb+5);
    expect(state.consent[2]).toBeLessThanOrEqual(r+2);
   }else{
    expect(state.sceneDisplayed).toBe(false);
    expect(state.phoneDisplayed).toBe(true);
    expect(state.phone[1]).toBeGreaterThanOrEqual(state.form[3]+5);
    expect(state.phone[0]).toBeGreaterThanOrEqual(state.section[0]-2);
    expect(state.phone[2]).toBeLessThanOrEqual(state.section[2]+2);
   }
  }finally{await context.close();}
 }
});

test('R27 newsletter spans desktop width without cropping or distorting the artwork', async({browser})=>{
 test.setTimeout(60000);
 for(const viewport of [{width:1024,height:720},{width:1366,height:768},{width:1600,height:785},{width:1600,height:900}]){
  const context=await browser.newContext({viewport});
  try{
   const page=await context.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('.site-footer .footer-news.footer-news--approved-r16');
   const img=section.locator('> img.footer-news-full-art-r16');
   const form=section.locator('form[data-newsletter]');
   await section.scrollIntoViewIfNeeded();
   await expect(img).toBeVisible();
   await expect(form).toBeVisible();
   const geo=await page.evaluate(()=>{
    const section=document.querySelector('.site-footer .footer-news.footer-news--approved-r16');
    const img=section.querySelector('.footer-news-full-art-r16');
    const form=section.querySelector('form[data-newsletter]');
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const footer=document.querySelector('.site-footer');
    const ambient=getComputedStyle(footer,'::before');
    return {s:rect(section),art:rect(img),form:rect(form),footer:rect(footer),ambientFilter:ambient.filter,ambientMask:ambient.maskImage,
      ambientBackground:ambient.backgroundImage,footerBottom:rect(document.querySelector('.site-footer .footer-bottom')),overflow:document.documentElement.scrollWidth};
   });
   expect(geo.overflow).toBeLessThanOrEqual(viewport.width+2);
   if(viewport.width>=1024){
    expect(geo.footer.width,'premium backdrop must span the browser').toBeGreaterThanOrEqual(viewport.width-2);
    expect(geo.ambientFilter,'desktop backdrop must be sharp, not blurred').toBe('none');
    expect(geo.ambientMask,'desktop backdrop must not disappear in the side gutters').toBe('none');
    expect(geo.ambientBackground).toContain('radial-gradient');
   }
   expect(Math.abs(geo.s.width-viewport.width),'R27 newsletter fills available browser width').toBeLessThanOrEqual(2);
   expect(geo.s.width,'newsletter must not be tiny on normal desktop screens').toBeGreaterThanOrEqual(viewport.width>1200?1040:850);
   expect(geo.s.height,'R27 artwork extends naturally and scrolls when taller than the viewport').toBeGreaterThanOrEqual(viewport.height-(viewport.width>=1181?130:157));
   if(viewport.width>=1181){
    expect(geo.s.width,'desktop newsletter must use the available height, not empty side gutters').toBeGreaterThanOrEqual(viewport.height>=900?1300:1100);
   }
   expect(geo.s.bottom,'Newsletter must remain reachable by vertical scroll').toBeGreaterThan(0);
   expect(geo.s.top,'Newsletter must intersect viewport after scrolling').toBeLessThanOrEqual(viewport.height+2);
   if(viewport.width>=1181)expect(geo.footerBottom.top,'Legal footer must follow the complete artwork').toBeGreaterThanOrEqual(geo.s.bottom-2);
   expect(Math.abs(geo.s.height-geo.s.width*941/1671)).toBeLessThanOrEqual(4);
   expect(Math.abs(geo.art.top-geo.s.top)).toBeLessThanOrEqual(2);
   expect(Math.abs(geo.art.bottom-geo.s.bottom)).toBeLessThanOrEqual(4);
   expect(geo.form.left).toBeGreaterThanOrEqual(geo.s.left-2);
   expect(geo.form.right).toBeLessThanOrEqual(geo.s.right+2);
   await expect(form.locator('input[type=email]')).toHaveCount(1);
   await expect(form.locator('button[type=submit]')).toBeDisabled();
  }finally{await context.close();}
 }
});

test('R21 actual newsletter is full-width on phones and loads real images',async({browser})=>{
 test.setTimeout(90000);
 const sizes=[
  {width:360,height:780},
  {width:390,height:844},
  {width:768,height:950},
  {width:1024,height:720},
  {width:1600,height:785}
 ];
 fs.mkdirSync(path.join(process.cwd(),'test-results/home-r4'),{recursive:true});
 for(const viewport of sizes){
  const ctx=await browser.newContext({viewport});
  try{
   const page=await ctx.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('.site-footer .footer-news.footer-news--approved-r16');
   const form=section.locator('form[data-newsletter]');
   await expect(form).toHaveClass(/footer-newsletter-live/);
   await section.scrollIntoViewIfNeeded();
   const image=section.locator(viewport.width<=960?'.footer-news-smartphone':'.footer-news-full-art-r16');
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0),{timeout:15000}).toBe(true);
   const g=await section.evaluate(el=>{
    const rect=x=>{const r=x.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const f=el.querySelector('form[data-newsletter]');
    const h=el.querySelector('h2');
    const input=f.querySelector('input[type=email]');
    const grid=el.parentElement,footer=el.closest('.site-footer');
    return {banner:rect(el),heading:rect(h),input:rect(input),form:rect(f),
      grid:rect(grid),footer:rect(footer),gridColumns:getComputedStyle(grid).gridTemplateColumns,
      screenWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
   });
   if(viewport.width===768) {
    await section.screenshot({path:'test-results/home-r4/newsletter-r21-768-diagnostic.png',animations:'disabled'});
    console.log('R21 TABLET GEO',JSON.stringify(g));
   }
   expect(g.scrollWidth,'No horizontal page overflow').toBeLessThanOrEqual(viewport.width+2);
   expect(g.banner.left,'Banner must stay inside screen').toBeGreaterThanOrEqual(-2);
   expect(g.banner.right,'Banner must stay inside screen').toBeLessThanOrEqual(viewport.width+2);
   if(viewport.width<=960){
    expect(g.banner.width,'Mobile newsletter must use real available screen width').toBeGreaterThanOrEqual(viewport.width*.82);
    expect(g.heading.width,'Mobile heading may not collapse to narrow vertical strip').toBeGreaterThanOrEqual(viewport.width*.60);
    expect(g.form.width,'Signup form must use full mobile column').toBeGreaterThanOrEqual(viewport.width*.67);
    expect(g.input.width,'Email input may not collapse').toBeGreaterThanOrEqual(viewport.width*.55);
   }else{
    expect(g.banner.height,'R27 banner keeps the original aspect ratio').toBeCloseTo(g.banner.width*941/1671,0);
    expect(g.banner.width).toBeGreaterThan(800);
   }
   if(viewport.width===390||viewport.width===1600){
    await section.screenshot({path:'test-results/home-r4/newsletter-r21-'+viewport.width+'.png',animations:'disabled'});
    await page.screenshot({path:'test-results/home-r4/newsletter-r21-viewport-'+viewport.width+'.png',fullPage:false,animations:'disabled'});
   }
  }finally{await ctx.close()}
 }
});

test('R27 approved newsletter image fills the complete desktop width',async({browser})=>{
 test.setTimeout(90000);
 fs.mkdirSync(path.join(process.cwd(),'test-results/home-r4'),{recursive:true});
 for(const viewport of [{width:1600,height:785},{width:1920,height:1080}]){
  const ctx=await browser.newContext({viewport});
  try{
   const page=await ctx.newPage();
   await page.goto('/');
   await page.getByRole('button',{name:'Odrzuć wszystko'}).click();
   const section=page.locator('.site-footer .footer-news.footer-news--approved-r16');
   await section.scrollIntoViewIfNeeded();
   const art=section.locator('img.footer-news-full-art-r16');
   await expect(art).toBeVisible();
   await expect.poll(()=>art.evaluate(img=>img.complete&&img.naturalWidth===1671&&img.naturalHeight===941),{timeout:12000}).toBe(true);
   const state=await page.evaluate(()=>{
    const footer=document.querySelector('.site-footer');
    const banner=footer.querySelector('.footer-news--approved-r16');
    const art=banner.querySelector('img.footer-news-full-art-r16');
    const form=banner.querySelector('form[data-newsletter]');
    const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom}};
    return {footer:rect(footer),banner:rect(banner),art:rect(art),
      beforeContent:getComputedStyle(footer,'::before').content,
      beforeBackground:getComputedStyle(footer,'::before').backgroundImage,
      beforeMask:getComputedStyle(footer,'::before').maskImage,
      emailCount:form.querySelectorAll('input[type=email]').length,
      submitCount:form.querySelectorAll('button[type=submit]').length,
      overflow:document.documentElement.scrollWidth};
   });
   expect(state.footer.left).toBeGreaterThanOrEqual(-2);
   expect(state.footer.right).toBeLessThanOrEqual(viewport.width+2);
   expect(state.footer.width).toBeGreaterThanOrEqual(viewport.width-2);
   expect(state.beforeContent).not.toBe('none');
   expect(state.beforeBackground).toContain('radial-gradient');
   expect(state.beforeMask).toBe('none');
   expect(state.banner.left,'R27 artwork begins at left edge').toBeGreaterThanOrEqual(-2);
   expect(state.banner.right,'R27 artwork reaches right edge').toBeGreaterThanOrEqual(viewport.width-2);
   expect(state.art.width).toBeCloseTo(state.banner.width,0);
   expect(state.art.top).toBeCloseTo(state.banner.top,0);
   expect(state.art.bottom).toBeCloseTo(state.banner.bottom,0);
   expect(state.overflow).toBeLessThanOrEqual(viewport.width+2);
   expect(state.emailCount).toBe(1);
   expect(state.submitCount).toBe(1);
   await page.screenshot({path:'test-results/home-r4/newsletter-r23-viewport-'+viewport.width+'.png',animations:'disabled',fullPage:false});
  }finally{await ctx.close();}
 }
});

test('Approved six-card images are unique and all local assets resolve',async({browser})=>{
 const cards=[
 ['#poradniki-academy .r4-approved-guide-chess','gracz-guide-chess-wide-approved-r10.avif'],
 ['#poradniki-academy .r4-approved-guide-checkers','gracz-guide-checkers-wide-approved-r10.avif'],
 ['#poradniki-academy .r4-approved-guide-poker','gracz-guide-poker-wide-approved-r10.avif'],
 ['#aktualnosci .r4-approved-blog-tournament','gracz-blog-tournament-owner-premium-r3.avif'],
 ['#aktualnosci .r4-approved-blog-analysis','gracz-blog-analysis-wide-premium-r9.avif'],
 ['#aktualnosci .r4-approved-blog-thousand','gracz-blog-thousand-wide-premium-r9.avif']
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
    expect(s.photo).toContain(selector.includes('blog-thousand')?'-thousand-wide-premium-r9.avif':selector.includes('blog-analysis')?'-analysis-wide-premium-r9.avif':selector.includes('blog-')?'-owner-premium-r3.avif':'-wide-approved-r10.avif');
    expect(s.position).toContain(selector.includes('blog-')?'0%':y);
    expect(s.contrast).toBe('none');
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await ctx.close();}
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
   expect(d.guides).toBe(n);expect(d.blogs).toBe(n);
   expect(d.guide.h).toBeGreaterThanOrEqual(width<=680?350:400);
   expect(d.blog.h).toBeGreaterThanOrEqual(width<=680?350:400);
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
     'gracz-blog-tournament-owner-premium-r3.avif',
     'gracz-blog-analysis-wide-premium-r9.avif',
     'gracz-blog-thousand-wide-premium-r9.avif'
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
     const bytes=(await response.body()).length;expect(bytes).toBeGreaterThan(i===0?25000:10000);if(i>0)expect(bytes).toBeLessThan(50000);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await context.close();}
 }
});

test('Approved Tysiac premium chip photo appears uncropped without duplicated text',async({browser})=>{
 for(const width of [390,1366]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await ctx.newPage();await page.goto('/');
   const card=page.locator('#aktualnosci .r4-update').nth(2);
   const photo=card.locator('img.r4-approved-blog-thousand');
   await expect(photo).toHaveAttribute('src','/assets/gracz-blog-thousand-wide-premium-r9.avif');
   await expect(photo).toHaveAttribute('alt','');
   await expect(photo).toHaveAttribute('loading','lazy');
   await photo.scrollIntoViewIfNeeded();
   await expect.poll(async()=>photo.evaluate(el=>el.naturalWidth)).toBe(720);
   await expect(photo).toHaveCSS('object-fit','cover');
   await expect(card.locator('.r4-update-body strong')).toHaveText('Tysiąc — zasady, taktyka i najważniejsze wskazówki');
   const response=await page.request.get('/assets/gracz-blog-thousand-wide-premium-r9.avif');
   expect(response.status()).toBe(200);
   expect((await response.body()).length).toBeGreaterThan(10000);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await ctx.close();}
 }
});

// Both approved wide photographs use actual files (not baked-in headings/buttons).
test('Two approved wide scenes load as native images without duplicate card copy',async({browser})=>{
 for(const width of [390,1366]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await ctx.newPage();await page.goto('/');
   for(const [selector,filename] of [
    ['.r4-approved-blog-analysis','gracz-blog-analysis-wide-premium-r9.avif'],
    ['.r4-approved-blog-thousand','gracz-blog-thousand-wide-premium-r9.avif']
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


test('Approved Full Max Premium game images load and display in chess and checkers cards',async({browser})=>{
 for(const width of [390,1366]){
  const ctx=await browser.newContext({viewport:{width,height:850}});
  try{
   const page=await ctx.newPage();await page.goto('/');
   for(const [klass,file] of [['r4-img-chess','gracz-game-chess-online-premium-r12.avif'],['r4-img-checkers','gracz-game-checkers-premium-r12.avif']]){
    const photo=page.locator('#nasze-gry .r4-game-image.'+klass);
    await expect(photo).toHaveCount(1);
    await expect.poll(async()=>photo.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('/assets/'+file);
    const response=await page.request.get('/assets/'+file);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/avif');
    expect((await response.body()).length).toBeGreaterThan(5000);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
  }finally{await ctx.close();}
 }
});
