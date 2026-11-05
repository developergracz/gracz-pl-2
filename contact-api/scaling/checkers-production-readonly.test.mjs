// Read-only production acceptance: real HTTPS, real Chromium, no production credentials.
// Do not create accounts, matches or messages. Fail closed on unexpected responses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='https://gracz-contact-api.onrender.com';
const pages=[
 ['/health','health'],
 ['/konto/warcaby/','text/html'],
 ['/konto/warcaby/styl.css','text/css'],
 ['/konto/warcaby/app.js','javascript'],
 ['/konto/warcaby/rules.mjs','javascript'],
 ['/konto/warcaby/training-ui.mjs','javascript'],
 ['/konto/gomoku/','text/html']
];
async function checkedFetch(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{return await fetch(origin+path,{signal:controller.signal,redirect:'manual',headers:{'User-Agent':'gracz-production-checkers-acceptance/1.0'}});}
 finally{clearTimeout(timer);}
}

test('LIVE: public checkers console, assets, health and unauthorized match access', {timeout:90000},async()=>{
 const results=[];
 for(const [path,contentType] of pages){
  const res=await checkedFetch(path);
  assert.equal(res.status,200,path+' HTTP '+res.status);
  assert.match(res.headers.get('content-type')||'',new RegExp(contentType),path+' content type');
  const body=await res.text();
  if(path==='/konto/warcaby/')assert.match(body,/class="board checkers-grid"/);
  if(path==='/konto/warcaby/app.js')assert.match(body,/auth\/match/);
  if(path==='/konto/warcaby/rules.mjs')assert.match(body,/function playMove/);
  results.push({path,status:res.status,bytes:Buffer.byteLength(body)});
 }
 const privateMatch='/auth/match?id=11111111-1111-4111-8111-111111111111';
 const denied=await checkedFetch(privateMatch);
 assert.equal(denied.status,401,'unauthenticated guest must not read arbitrary private match');
 console.log('PRODUCTION_HTTP_PASS',JSON.stringify({results,unauthorizedMatch:denied.status}));
});

test('LIVE: Chromium renders the actual 8x8 Warcaby board and 24 pieces', {timeout:90000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const failures=[];
  page.on('response',res=>{
   if(res.url().startsWith(origin+'/konto/')&&res.status()>=400)failures.push({status:res.status(),url:res.url()});
  });
  await page.goto(origin+'/konto/warcaby/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64,{timeout:15000});
  const squares=page.locator('#board .square'),pieces=page.locator('#board .square .piece');
  assert.equal(await squares.count(),64);
  assert.equal(await pieces.count(),24);
  assert.equal((await page.locator('#board').getAttribute('role')),'grid');
  const scriptLoaded=await page.evaluate(()=>Boolean(document.getElementById('training-mode')&&document.getElementById('online-mode')));
  assert.equal(scriptLoaded,true,'full premium checkers console loaded');
  assert.deepEqual(failures,[],'required game assets must not fail');
  console.log('PRODUCTION_CHROMIUM_PASS',JSON.stringify({squares:64,pieces:24,viewport:'1600x900',url:page.url()}));
 }finally{await browser.close();}
});
