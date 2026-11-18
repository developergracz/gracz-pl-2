// Real Chromium regression for the owner-approved chess-style Warcaby console.
// Old gold-frame insets and Gomoku left sidebar are no longer the intended geometry.
// The actual Warcaby engine and buttons remain live; no test-only DOM impersonation.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {serveCheckersConsole} from '../../../contact-api/auth/checkers-console.mjs';
import {serveGomokuConsole} from '../../../contact-api/auth/gomoku-console.mjs';

const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(serveCheckersConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
 if(url.pathname==='/auth/message-center'){
  res.writeHead(401,{'Content-Type':'application/json'});res.end('{"ok":false}');return;
 }
 res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"challenges":[]}');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;
const errors=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 for(const [width,height] of [[1649,928],[1280,800],[1024,768],[910,720],[390,844]]){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64);
  await page.waitForFunction(()=>!document.body.classList.contains('checkers-shell-loading'));
  for(const [name,classes] of [
   ['default',[]],['hide-dock',['console-hide-dock']],
   ['hide-players',['console-hide-players']],
   ['hide-sidebar',['console-hide-sidebar']],
   ['hide-dock-and-sidebar',['console-hide-dock','console-hide-sidebar']],
   ['hide-dock-and-players',['console-hide-dock','console-hide-players']],
   ['hide-quicklinks',['console-hide-quicklinks']]
  ]){
   const metrics=await page.evaluate(classes=>{
    const layout=document.getElementById('game');
    for(const c of [...layout.classList])if(c.startsWith('console-hide-'))layout.classList.remove(c);
    for(const c of classes)layout.classList.add(c);
    const record=selector=>{
     const el=document.querySelector(selector);if(!el)return null;
     const s=getComputedStyle(el),r=el.getBoundingClientRect();
     return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
      visible:s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    };
    return {
     board:record('#board'),frame:record('.boardframe'),dock:record('#game>.boardarea>.side-dock'),
     clocks:record('#game .cc-top .players'),nav:record('.cc-site-nav'),
     game:record('#game'),pieces:document.querySelectorAll('#board .piece').length,
     squares:document.querySelectorAll('#board .square').length
    };
   },classes);
   const label=width+'×'+height+' '+name;
   assert.equal(metrics.squares,64,'64 real board squares '+label);
   assert.equal(metrics.pieces,24,'12 white + 12 black pieces '+label);
   assert.ok(metrics.board?.width>100&&metrics.board?.height>100,'Board visible '+label);
   assert.ok(Math.abs(metrics.board.width-metrics.board.height)<3,'Board must stay square '+label);
   if(metrics.frame?.visible){
    assert.ok(Math.abs(metrics.frame.width-metrics.frame.height)<3,'Frameless square console '+label);
    const frame=metrics.frame,board=metrics.board;
    const inset=[board.left-frame.left,frame.right-board.right,board.top-frame.top,frame.bottom-board.bottom];
    assert.ok(inset.every(x=>Math.abs(x)<4),'No old gold frame inset '+label+' '+JSON.stringify(inset));
   }
   if(!classes.includes('console-hide-dock')&&width>800){
    assert.ok(metrics.dock?.visible,'Right owner console exists '+label);
    assert.ok(metrics.board.right<=metrics.dock.left+3,'Board does not cross right panel '+label);
   }
   if(metrics.clocks?.visible&&metrics.nav?.visible){
    const a=metrics.clocks,b=metrics.nav;
    const overlap=Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&
       Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    assert.ok(!overlap,'Clocks and navigation do not overlap '+label);
   }
   console.log('PASS '+label);
  }
  await page.close();
 }
 assert.deepEqual(errors,[],'No browser runtime errors');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
