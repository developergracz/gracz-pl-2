// Browser acceptance for the isolated checkers result popup. No production accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

test('Warcaby loss shows the modal and only real authorized options, without changing the board', {timeout:60000}, async t=>{
 const priorId='11111111-1111-4111-8111-111111111111';
 const roomId='22222222-2222-4222-8222-222222222222';
 const scheduledId='33333333-3333-4333-8333-333333333333';
 const tomorrow=new Date(Date.now()+86400000).toISOString();
 const challenges=[
  {id:priorId,game:'warcaby',status:'accepted',opponent:'Mistrz_Andrzej',timeLimitMinutes:10,incrementSeconds:2,scheduledAt:null},
  {id:roomId,game:'warcaby',status:'accepted',opponent:'Zosia_PL',timeLimitMinutes:5,incrementSeconds:0,scheduledAt:null},
  {id:scheduledId,game:'warcaby',status:'accepted',opponent:'Karol_22',timeLimitMinutes:15,incrementSeconds:0,scheduledAt:tomorrow}
 ];
 const invites=[];
 let injectTrainingLoss=false,injectOnlineLoss=false;
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(injectTrainingLoss&&url.pathname==='/konto/warcaby/training-ui.mjs'){
   const script="export function setupTraining(a){return {setMode(next){if(next!=='training')return;a.setMode('training');a.setCurrent({type:'training',state:{board:Array(64).fill(0),turn:2,winner:2,moves:37,forced:null,history:[]},players:['Ty','Komputer'],player:1,playable:true,version:42});a.renderBoard();}}}";
   res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});res.end(script);return;
  }
  if(serveCheckersConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  const send=(code,data)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname==='/auth/session')return send(200,{ok:true,loggedIn:true,nickname:'GrAcZ'});
  if(url.pathname==='/auth/warcaby/tables')return send(200,{ok:true,tables:[{
   id:roomId,title:'Warcaby 5 min',host:'Zosia_PL',guest:null,minutes:5,incrementSeconds:0,
   visibility:'public',color:'white',mine:false,joined:false,status:'waiting'
  }]});
  if(url.pathname==='/auth/social/challenges'){
   if(req.method==='GET')return send(200,{ok:true,challenges});
   const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{invites.push(JSON.parse(Buffer.concat(chunks).toString()));send(200,{ok:true,id:'44444444-4444-4444-8444-444444444444'});});return;
  }
  if(url.pathname==='/auth/friends/presence')return send(200,{ok:true,friends:[{nickname:'Basia_1',online:true},{nickname:'Nieobecny',online:false}]});
  if(url.pathname==='/auth/match'){
   if(injectOnlineLoss)return send(200,{ok:true,match:{id:priorId,game:'warcaby',player:1,players:['Ty','Mistrz_Andrzej'],playable:true,version:99,state:{board:Array(64).fill(0),turn:2,winner:2,moves:42,forced:null,history:[]}}});
   return send(404,{ok:false,error:'BRAK_PARTII'});
  }
  return send(200,{ok:true,items:[],friends:[],challenges:[]});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/konto/warcaby/');
 await page.locator('#board .square').first().waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64);
 const before=await page.locator('#board').evaluate(el=>el.innerHTML);
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('gracz:warcaby:position',{detail:{mode:'online',matchId:id,version:4,winner:2,player:1,players:['Ty','Mistrz_Andrzej']}})),priorId);
 assert.equal(await page.locator('#warcaby-loss-overlay').isVisible(),true);
 assert.equal(await page.locator('#warcaby-loss-name').textContent(),'Mistrz_Andrzej');
 assert.equal(await page.locator('#warcaby-loss-verb').textContent(),'Przegrałeś');
 assert.equal(await page.locator('#warcaby-loss-emotion').textContent(),'😢');
 assert.equal(await page.locator('#warcaby-loss-title').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(246, 232, 204)');
 assert.equal(await page.locator('#warcaby-loss-player').evaluate(el=>getComputedStyle(el).color),'rgb(35, 121, 171)');
 assert.equal(await page.locator('#warcaby-loss-player').textContent(),'gracz','the account name is shown lowercase without changing account data');
 assert.equal(await page.locator('#warcaby-loss-player').evaluate(el=>getComputedStyle(el).fontSize),'25.92px',
  'nickname is larger than the surrounding 24px headline');
 assert.equal(await page.locator('#warcaby-loss-rematch').evaluate(el=>getComputedStyle(el).fontSize),'16px');
 assert.equal(await page.locator('#board').evaluate(el=>el.innerHTML),before,'board must not be touched');
 await page.waitForFunction(()=>document.querySelector('#warcaby-loss-player')?.textContent==='gracz');
 assert.equal(await page.locator('#warcaby-tables-overlay').isVisible(),false,'tables initially hidden');
 assert.deepEqual(await page.locator('.warcaby-loss-actions button').allTextContents(),['Rewanż','Stoły']);
 await page.locator('#warcaby-loss-rematch').click();
 await page.waitForFunction(()=>document.querySelector('#warcaby-loss-notice')?.textContent.includes('Wysłano propozycję rewanżu'));
 assert.deepEqual(invites[0],{action:'send',game:'warcaby',nickname:'Mistrz_Andrzej',timeLimitMinutes:10,incrementSeconds:2});
 await page.locator('#warcaby-loss-others').click();
 await page.locator('#warcaby-tables-overlay').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#warcaby-loss-tables')?.textContent.includes('Zosia_PL'));
 assert.match(await page.locator('#warcaby-loss-tables').innerText(),/Zosia_PL/);
 assert.doesNotMatch(await page.locator('#warcaby-loss-tables').innerText(),/Mistrz_Andrzej/,'current finished game not in available tables');
 assert.deepEqual(await page.locator('.warcaby-tables-menu button').allTextContents(),['Wolne stoły','W trakcie gry','Moje stoły']);
 assert.equal(await page.locator('#warcaby-loss-tables button').textContent(),'Dołącz');
 await page.locator('#warcaby-tables-close').click();
 const old=page.locator('#game-result-modal');
 await old.evaluate(el=>{el.hidden=false;});
 await page.waitForFunction(()=>document.querySelector('#game-result-modal')?.hidden===true);
 assert.equal(await page.locator('#warcaby-loss-overlay').isVisible(),false,
  'a stale native modal must not reopen after switching to Stoły');
 await old.evaluate(el=>{el.querySelector('.result-card').dataset.result='loss';el.hidden=false;});
 await page.waitForFunction(()=>document.querySelector('#warcaby-loss-overlay')?.hidden===false);
 assert.equal(await page.locator('#warcaby-loss-name').textContent(),'komputerem','training original result provides a fallback');
 await page.locator('#warcaby-loss-close').click();
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('gracz:warcaby:position',{
  detail:{mode:'online',matchId:id,version:6,winner:1,player:1,players:['Ty','Mistrz_Andrzej']}
 })),priorId);
 assert.equal(await page.locator('#warcaby-loss-overlay').isVisible(),true,'win also shows the result modal');
 assert.equal(await page.locator('#warcaby-loss-verb').textContent(),'Wygrałeś');
 assert.equal(await page.locator('#warcaby-loss-emotion').textContent(),'😄');
 await page.locator('#warcaby-loss-rematch').click();
 await page.waitForFunction(()=>document.querySelector('#warcaby-loss-notice')?.textContent.includes('Wysłano propozycję rewanżu'));
 assert.equal(invites.at(-1).nickname,'Mistrz_Andrzej','winning rematch targets the opponent, not yourself');
 await page.locator('#warcaby-loss-close').click();
 for(const winner of [0,3]){
  await page.evaluate(({value,id})=>window.dispatchEvent(new CustomEvent('gracz:warcaby:position',{detail:{mode:'online',matchId:id,version:7,winner:value,player:1,players:['Ty','Mistrz_Andrzej']}})),{value:winner,id:priorId});
  assert.equal(await page.locator('#warcaby-loss-overlay').isVisible(),false,'no custom popup for unfinished or drawn game');
 }
 assert.deepEqual(errors,[],'no browser runtime errors');
 await page.close();
 // Reproduce a real renderBoard() call after a final losing state instead of dispatching
 // the popup event directly. The training controller is isolated and disposable.
 injectTrainingLoss=true;
 const actual=await browser.newPage({viewport:{width:390,height:844}});
 const runtimeErrors=[];actual.on('pageerror',e=>runtimeErrors.push(e.message));
 await actual.goto('http://127.0.0.1:'+server.address().port+'/konto/warcaby/');
 await actual.waitForFunction(()=>document.querySelector('#warcaby-loss-overlay')?.hidden===false,{timeout:10000});
 assert.equal(await actual.locator('#warcaby-loss-name').textContent(),'komputerem');
 assert.equal(await actual.locator('#warcaby-tables-overlay').isVisible(),false,'tables open only when requested');
 assert.equal(await actual.locator('#board .square').count(),64);
 assert.deepEqual(runtimeErrors,[],'real controller rendering never breaks browser runtime');
 await actual.close();
 // A real HTTP match refresh with a terminal state must also open the same popup.
 injectTrainingLoss=false;injectOnlineLoss=true;
 const online=await browser.newPage({viewport:{width:1366,height:768}});
 const onlineErrors=[];online.on('pageerror',e=>onlineErrors.push(e.message));
 await online.goto('http://127.0.0.1:'+server.address().port+'/konto/warcaby/?match='+priorId);
 await online.waitForFunction(()=>document.querySelector('#warcaby-loss-overlay')?.hidden===false,null,{timeout:10000});
 assert.equal(await online.locator('#warcaby-loss-name').textContent(),'Mistrz_Andrzej');
 assert.equal(await online.locator('#warcaby-tables-overlay').isVisible(),false);
 assert.deepEqual(onlineErrors,[]);
 await online.close();
});
