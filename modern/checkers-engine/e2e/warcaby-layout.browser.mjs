// Focused real-Chromium regression: clocks, player cards and quick links must
// never paint into the same track, including every layout preset.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {serveCheckersConsole} from '../../../contact-api/auth/checkers-console.mjs';
import {serveGomokuConsole} from '../../../contact-api/auth/gomoku-console.mjs';

const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(serveCheckersConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
const errors=[];
try {
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 for(const [width,height] of [[1649,928],[1280,800],[1024,768],[910,720],[390,844]]){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/konto/warcaby/app.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto('http://127.0.0.1:'+port+'/konto/warcaby/',{waitUntil:'load'});
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
    for(const c of ['clock-1','clock-2'])document.getElementById(c)?.removeAttribute('hidden');
    const info=selector=>{
     const el=document.querySelector(selector);
     if(!el)return null;
     const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
     return {
      x:rect.left,y:rect.top,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,
      width:rect.width,height:rect.height,
      visible:style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0,
      position:style.position
     };
    };
    return {
     nav:info('.premium-quick-links'),
     player:info('.players .player.second'),
     clock:info('#clock-2'),
     board:info('.boardframe'),
     boardArea:info('.boardarea'),
     status:info('#game-state'),
     dock:info('.side-dock'),
     sidebar:info('.sidebar')
    };
   },classes);
   const label=width+'×'+height+' '+name;
   assert.ok(metrics.board&&metrics.board.width>60&&metrics.board.height>60,'Missing board '+label+' '+JSON.stringify(metrics));
   const overlap=(a,b)=>a&&b&&a.visible&&b.visible&&
      Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
   assert.ok(!overlap(metrics.nav,metrics.clock),'Clock overlaps upper navigation '+label+' '+JSON.stringify(metrics));
   assert.ok(!overlap(metrics.nav,metrics.player),'Player card overlaps upper navigation '+label+' '+JSON.stringify(metrics));
   if(metrics.clock?.visible&&metrics.player?.visible){
    assert.ok(metrics.clock.left>=metrics.player.left-1 &&
      metrics.clock.right<=metrics.player.right+1,
     'Clock protrudes beyond player card '+label+' '+JSON.stringify(metrics));
   }
   if(width>800&&classes.includes('console-hide-dock')&&!classes.includes('console-hide-quicklinks')){
    assert.ok(metrics.nav.visible&&metrics.nav.position!=='absolute',
      'Navigation floated out of layout '+label+' '+JSON.stringify(metrics));
    assert.ok(!overlap(metrics.nav,metrics.status),'Navigation overlaps status '+label);
   }
   console.log('PASS '+label);
  }
  await page.close();
 }
 assert.deepEqual(errors,[],'JavaScript errors');
} finally {
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
