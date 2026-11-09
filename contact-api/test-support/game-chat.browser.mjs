// Acceptance of presentation and existing send controls; APIs use deterministic fixtures.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {initialGame} from '../auth/game-engine.mjs';
import {initialChessMatch} from '../auth/chess-match.mjs';
const require=createRequire(new URL('../../modern/checkers-engine/package.json',import.meta.url));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if([serveGomokuConsole,serveCheckersConsole,serveChessConsole].some(serve=>serve(req,res,url)))return;
 res.writeHead(404);res.end('{}');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=process.env.CHAT_BASE_URL||'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const long='To długa wiadomość użytkownika — sprawdzamy automatyczne zawijanie i czytelność. '.repeat(5)+'X'.repeat(100);
const answer='Witaj! Odpowiedź GRACZ AI.\nMożemy porozmawiać o grze.';
const id='d48944ab-106f-4d4b-855b-bcb76e30a112';
async function inspect(page,selector,expected,{short=false}={}){
 const el=page.locator(selector).last();await el.waitFor();
 const info=await page.evaluate(selector=>{
  const e=[...document.querySelectorAll(selector)].at(-1);
  const r=e.getBoundingClientRect(),p=e.parentElement,pr=p.getBoundingClientRect(),css=getComputedStyle(e);
  const title=e.querySelector('strong'),text=e.querySelector('p'),time=e.querySelector('time');
  const range=document.createRange();range.selectNodeContents(text);const lines=[...range.getClientRects()];
  return {background:css.backgroundColor,align:css.alignSelf,width:r.width,parentWidth:p.clientWidth,
   left:r.left-pr.left,overflow:e.scrollWidth>e.clientWidth+1,text:text.textContent,
   title:title.textContent,time:time?.textContent,dateTime:time?.dateTime,
   sameLine:Math.abs(title.getBoundingClientRect().top-lines[0].top)<3,
   lineCount:lines.length,contentColor:getComputedStyle(text).color,titleColor:getComputedStyle(title).color};
 },selector);
 assert.equal(info.background,expected==='own'?'rgb(80, 61, 41)':'rgb(16, 62, 67)',JSON.stringify(info));
 assert.equal(info.align,'flex-start');assert.ok(info.width<=info.parentWidth*.95+1&&info.width>=info.parentWidth*.85,JSON.stringify(info));
 assert.ok(info.left<15&&!info.overflow,JSON.stringify(info));assert.ok(info.time&&info.dateTime);
 assert.equal(info.contentColor,'rgb(255, 255, 255)');assert.equal(info.titleColor,'rgb(242, 211, 154)');
 if(short)assert.ok(info.sameLine&&info.lineCount===1,JSON.stringify(info));
 if(info.text===long)assert.ok(info.lineCount>1);
 return info;
}
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:700}]){
  for(const slug of ['gomoku','warcaby','szachy']){
   for(const mode of ['training','online']){
    const page=await browser.newPage({viewport});page.setDefaultTimeout(10000);
    const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
    // Force the existing HTTP fallback; no real accounts or provider calls.
    await page.addInitScript(()=>{window.WebSocket=undefined});
    const rows=[{id:'1',player:1,body:'witam',createdAt:'2026-11-09T12:15:00Z'},{id:'2',player:2,body:'Wiadomość przeciwnika',createdAt:'2026-11-09T12:16:00Z'}];
    const match={id,game:slug,version:0,player:1,players:['Tester','Ty'],playable:true,state:slug==='szachy'?initialChessMatch():initialGame(slug)};
    await page.route('**/auth/**',async route=>{
     const url=new URL(route.request().url()),body=route.request().postDataJSON();
     let result={ok:true,profile:{nickname:'Tester'},challenges:[{id,game:slug,status:'accepted',opponent:'Ty'}],friends:[],items:[],messages:rows};
     if(url.pathname==='/auth/match')result={ok:true,match};
     if(url.pathname==='/auth/match/chat'&&route.request().method()==='POST'){
      calls.push({kind:'online',body});rows.push({id:String(rows.length+1),player:1,body:body.message,createdAt:new Date().toISOString()});
     }
     await route.fulfill({json:result});
    });
    await page.route('**/ai-chat',async route=>{calls.push({kind:'ai',body:route.request().postDataJSON()});await route.fulfill({json:{ok:true,answer}})});
    await page.goto(base+'/konto/'+slug+'/'+(mode==='online'?'?match='+id:''));
    await page.locator('.gracz-ai-toggle').waitFor({state:'attached'});
    await page.locator('#chat-tab').click();
    const input=page.locator('#chat-input');await input.waitFor();
    if(mode==='online'){
     if(slug==='gomoku')await page.locator('#join-room').click();
     await page.locator('#chat-messages .game-chat-message').nth(1).waitFor();
     const opponent=await inspect(page,'#chat-messages .game-chat-message:not(.own)','other');assert.equal(opponent.title,'Ty:');
    }
    await input.fill('witam');await input.press('Enter');
    await page.waitForFunction(expected=>[...document.querySelectorAll('#chat-messages .own p')].filter(e=>e.textContent==='witam').length===expected,mode==='online'?2:1);
    await page.waitForFunction(()=>!document.querySelector('#chat-send').disabled);
    await inspect(page,'#chat-messages .own','own',{short:true});
    if(mode==='training')await inspect(page,'#chat-messages .game-chat-message:not(.own)','other');
    await input.fill(long);await page.locator('#chat-send').click();
    await page.waitForFunction(text=>[...document.querySelectorAll('#chat-messages .own p')].some(e=>e.textContent===text),long);
    await inspect(page,'#chat-messages .own','own');
    assert.equal(calls.length,2,slug+' '+mode+' sends exactly once per control');
    assert.deepEqual(calls.map(c=>c.body.message),['witam',long]);
    if(process.env.CHAT_SCREENSHOT_DIR){await mkdir(process.env.CHAT_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.CHAT_SCREENSHOT_DIR+'/'+slug+'-'+mode+'-'+viewport.width+'-main.png',fullPage:true})}
    await page.locator('#history-tab').click();
    // Some consoles intentionally hide the preview in the moves view; inspect its DOM using a test-only visible wrapper.
    await page.locator('#chat-preview').evaluate(e=>{e.hidden=false;e.parentElement.style.setProperty('display','flex','important')});
    await inspect(page,'#chat-preview .own','own');
    await page.locator('#chat-tab').click();
    await page.locator('#chat-preview').evaluate(e=>e.parentElement.style.removeProperty('display'));
    // The inherited dock header is hidden; activate the existing secondary AI panel programmatically.
    await page.locator('.gracz-ai-toggle').evaluate(e=>e.click());
    await page.locator('.gracz-ai-input').fill('witam');await page.locator('.gracz-ai-input').press('Enter');
    await page.waitForFunction(()=>!document.querySelector('.gracz-ai-send').disabled);
    await inspect(page,'.gracz-ai-log .own','own',{short:true});
    await inspect(page,'.gracz-ai-log .game-chat-message:not(.own)','other');
    await page.locator('.gracz-ai-input').fill(long);await page.locator('.gracz-ai-send').click();
    await inspect(page,'.gracz-ai-log .own','own');
    await page.waitForFunction(()=>!document.querySelector('.gracz-ai-send').disabled);
    assert.equal(calls.length,4);assert.deepEqual(errors,[],slug+' '+mode+' runtime errors');
    if(process.env.CHAT_SCREENSHOT_DIR){await mkdir(process.env.CHAT_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.CHAT_SCREENSHOT_DIR+'/'+slug+'-'+mode+'-'+viewport.width+'.png',fullPage:true})}
    console.log('PASS',slug,mode,viewport.width,'short/long, AI/opponent, preview, Enter/button');
    await page.close();
   }
  }
 }
}finally{await browser.close();server.close();server.closeAllConnections()}
