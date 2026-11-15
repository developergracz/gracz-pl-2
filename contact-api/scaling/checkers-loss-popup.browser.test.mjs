// Browser acceptance for the isolated checkers result popup. No production accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';

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
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveCheckersConsole(req,res,url))return;
  const send=(code,data)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname==='/auth/social/challenges'){
   if(req.method==='GET')return send(200,{ok:true,challenges});
   const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{invites.push(JSON.parse(Buffer.concat(chunks).toString()));send(200,{ok:true,id:'44444444-4444-4444-8444-444444444444'});});return;
  }
  if(url.pathname==='/auth/friends/presence')return send(200,{ok:true,friends:[{nickname:'Basia_1',online:true},{nickname:'Nieobecny',online:false}]});
  if(url.pathname==='/auth/match')return send(404,{ok:false,error:'BRAK_PARTII'});
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
 assert.equal(await page.locator('#board').evaluate(el=>el.innerHTML),before,'board must not be touched');
 await page.locator('#warcaby-loss-others').click();
 await page.waitForFunction(()=>document.querySelector('#warcaby-loss-tables')?.textContent.includes('Zosia_PL'));
 assert.match(await page.locator('#warcaby-loss-tables').innerText(),/Zosia_PL/);
 assert.doesNotMatch(await page.locator('#warcaby-loss-tables').innerText(),/Mistrz_Andrzej/,'current finished game not in live tables');
 assert.match(await page.locator('#warcaby-loss-friends').innerText(),/Basia_1/);
 assert.doesNotMatch(await page.locator('#warcaby-loss-friends').innerText(),/Nieobecny/);
 assert.match(await page.locator('#warcaby-loss-scheduled').innerText(),/Karol_22/);
 assert.equal(await page.locator('#warcaby-loss-tables a').count(),1);
 await page.locator('#warcaby-loss-rematch').click();
 await page.waitForFunction(()=>document.querySelector('#warcaby-loss-notice')?.textContent.includes('zostało wysłane'));
 assert.deepEqual(invites[0],{action:'send',game:'warcaby',nickname:'Mistrz_Andrzej',timeLimitMinutes:10,incrementSeconds:2});
 const old=page.locator('#game-result-modal');
 await old.evaluate(el=>{el.hidden=false;});
 await page.waitForFunction(()=>document.querySelector('#game-result-modal')?.hidden===true);
 await page.locator('#warcaby-loss-close').click();
 assert.equal(await page.locator('#warcaby-loss-overlay').isVisible(),false);
 for(const winner of [0,1,3]){
  await page.evaluate((value,id)=>window.dispatchEvent(new CustomEvent('gracz:warcaby:position',{detail:{mode:'online',matchId:id,version:6,winner:value,player:1,players:['Ty','Mistrz_Andrzej']}})),winner,priorId);
  assert.equal(await page.locator('#warcaby-loss-overlay').isVisible(),false,'no popup for non-loss');
 }
 assert.deepEqual(errors,[],'no browser runtime errors');
 await page.close();
});
