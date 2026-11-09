'use strict';
const {strict:assert}=require('node:assert');
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile,stat,mkdir}=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'../../maintenance-site');
const output=path.resolve(__dirname,'../../test-results/game-hover');
const files=['chess','checkers','gomoku','thousand','poker'];
const contentType={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const file=new URL(req.url,'http://localhost').pathname;
  const safe=path.resolve(root,'.'+file,(file.endsWith('/')?'index.html':''));
  if(!safe.startsWith(root+path.sep)){res.writeHead(403).end();return}
  const bytes=await readFile(safe);
  res.writeHead(200,{'Content-Type':contentType[path.extname(safe)]||'application/octet-stream'});
  res.end(bytes);
 }catch(error){res.writeHead(404);res.end()}
});
(async()=>{
 await mkdir(output,{recursive:true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  for(const item of files){
   const source=page.locator('.r4-img-'+item);
   await source.scrollIntoViewIfNeeded();
   const before=await page.locator('#nasze-gry .r4-game').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
   const b=await source.boundingBox();
   await page.mouse.move(b.x+8,b.y+8);
   const preview=page.locator('#r4-game-hover-preview');
   await preview.waitFor({state:'visible',timeout:5000});
   const p=await preview.boundingBox();
   const viewport=page.viewportSize();
   assert(p.width>=250 && p.height>=140,item+' preview is too small');
   assert(p.x>=0 && p.y>=0 && p.x+p.width<=viewport.width+1 && p.y+p.height<=viewport.height+1,item+' preview beyond viewport');
   assert(p.x<b.x+b.width&&p.x+p.width>b.x&&p.y<b.y+b.height&&p.y+p.height>b.y,
     item+' popup must overlap thumbnail for continuous cursor travel');
   await page.mouse.move(p.x+p.width*.65,p.y+p.height*.45,{steps:8});
   await page.waitForTimeout(300);
   assert(await preview.isVisible(),item+' popup disappears when cursor enters it');
   const shadow=await preview.evaluate(n=>getComputedStyle(n).boxShadow);
   assert(!/0px 0px (?:1[5-9]|[2-9]\d)px/.test(shadow),item+' preview has neon glow');
   const after=await page.locator('#nasze-gry .r4-game').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
   assert.deepEqual(after,before,item+' preview changes card height');
   await page.screenshot({path:path.join(output,item+'.png')});
   await page.mouse.move(2,2);await page.waitForTimeout(260);
   assert(!(await preview.isVisible()),item+' preview does not close after leaving');
  }
  await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.goto(origin+'/',{waitUntil:'domcontentloaded'});
  const mobileState=await mobile.locator('#r4-game-hover-preview').evaluate(n=>getComputedStyle(n).display);
  assert.equal(mobileState,'none','popup must not cover mobile cards');
  await mobile.close();
  console.log('HOME_GAME_PREVIEWS_PASS: 5 hover previews, cursor transfer, viewport bounds, stable cards, mobile');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;server.close()});
