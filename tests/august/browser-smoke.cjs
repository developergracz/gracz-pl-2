'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'../../contact-api/auth/august');
const output=path.resolve(__dirname,'../../test-results/august');
const views=[
 ['settings','settings.html'],
 ['messages','messages.html'],
 ['community','community.html'],
 ['global-chat','global-chat.html'],
 ['players','players.html'],
 ['tournaments','turnieje.html'],
];
const sidebarSections=[
 ['Konto i profil','profile'],['Bezpieczeństwo','security'],['Prywatność','privacy'],
 ['Powiadomienia','notifications'],['Wiadomości i chat','messages'],['Gry i rozgrywka','games'],
 ['Wygląd i dostępność','appearance'],['Sesje i urządzenia','sessions'],['Dane i konto','data']
];
let servePlayerPanel=null;
const memberId='33333333-3333-4333-8333-333333333333';
const accounts={memberId,displayName:'Gracz Testowy',nickname:'gracztest'};
const fixtures={created:[],sent:[],chat:[{id:'1',nickname:'Gracz Testowy',body:'Witaj w społeczności!'}]};
const returnJson=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
const tournamentId='11111111-1111-4111-8111-111111111111';
const matchId='22222222-2222-4222-8222-222222222222';
function currentTournament(t){
 return {...t,playerCount:1,joined:true,currentRound:t.status==='live'?1:0};
}
async function listener(req,res){
 const request=new URL(req.url,'http://127.0.0.1'),pathname=request.pathname;
 let body={};
 if(req.method==='POST'||req.method==='PUT'){
  let raw='';
  for await(const chunk of req){raw+=String(chunk);if(raw.length>16384){res.writeHead(413);res.end();return}}
  try{body=JSON.parse(raw||'{}')}catch{res.writeHead(400);res.end();return}
 }
 if(pathname==='/auth/session')return returnJson(res,{loggedIn:true,nickname:accounts.nickname});
 if(pathname==='/auth/august/whoami')return returnJson(res,{ok:true,user:{userId:memberId,displayName:accounts.displayName}});
 if(pathname==='/auth/profile')return returnJson(res,{ok:true,profile:{nickname:accounts.nickname,displayName:accounts.displayName,bio:'Testowy profil',country:'PL',language:'pl',email:'gracz.test@example.test'}});
 if(pathname==='/auth/security-center')return returnJson(res,{ok:true,preferences:{newSessionAlert:true,passwordAlert:true},sessions:[]});
 if(pathname==='/auth/privacy-center')return returnJson(res,{ok:true,preferences:{publicProfile:true,showOnline:true,friendMessages:true,gameInvites:true}});
 if(pathname==='/auth/notification-center')return returnJson(res,{ok:true,preferences:{messages:true,friends:true,games:true,highlightUnread:true,showNicknames:true,showDates:true,autoReadOnOpen:false,muteMinutes:0}});
 if(pathname==='/auth/message-center')return returnJson(res,{ok:true,conversations:[{nickname:'gracz2',lastMessage:'Przykładowa wiadomość',unread:1,archived:false,lastOwn:false}]});
 if(pathname==='/auth/social/messages'){
  if(req.method==='POST'){fixtures.sent.push(body);return returnJson(res,{ok:true})}
  return returnJson(res,{ok:true,messages:[{id:'msg1',own:false,body:'Przykładowa wiadomość',createdAt:'2026-11-08T18:00:00Z'}]});
 }
 if(pathname==='/auth/friends')return returnJson(res,{ok:true,connections:[{nickname:'gracz2',status:'accepted'},{nickname:'gracz3',status:'pending',direction:'incoming'}]});
 if(pathname==='/auth/friends/presence')return returnJson(res,{ok:true,friends:[{nickname:'gracz2',online:true},{nickname:'gracz3',online:false}]});
 if(pathname==='/auth/friends/search')return returnJson(res,{ok:true,players:[{nickname:'gracz2'}]});
 if(pathname==='/auth/friends/action')return returnJson(res,{ok:true});
 if(pathname==='/auth/social/challenges')return returnJson(res,{ok:true,challenges:[]});
 if(pathname==='/auth/august/chat'){
  if(req.method==='POST'){fixtures.chat.push({id:String(fixtures.chat.length+1),nickname:accounts.displayName,body:body.body});return returnJson(res,{ok:true})}
  return returnJson(res,{ok:true,messages:fixtures.chat});
 }
 if(pathname==='/auth/august/tournaments'){
  if(req.method==='POST'){
   const t={...body,tournamentId,ownerId:memberId,ownerName:accounts.displayName,status:'registration',rated:false};
   fixtures.created.push(t);return returnJson(res,{ok:true,tournament:t},201);
  }
  return returnJson(res,{ok:true,tournaments:fixtures.created.map(currentTournament)});
 }
 if(pathname==='/auth/august/tournaments/'+tournamentId){
  const t=fixtures.created[0];return returnJson(res,{ok:true,tournament:currentTournament(t),
   players:[{userId:memberId,displayName:accounts.displayName,points:0,wins:0,draws:0,losses:0,buchholz:0}],
   matches:[]});
 }
 if(pathname==='/auth/search-entry'){res.writeHead(302,{Location:'/wyszukiwarka/'});res.end();return}
 if(pathname==='/wyszukiwarka/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<h1>Wyszukiwarka – podgląd testowy</h1>');return}
 if(pathname.startsWith('/konto/panel')&&servePlayerPanel(req,res,request))return;
 const prefix='/konto/sierpien/';
 if(!pathname.startsWith(prefix)){res.writeHead(404);res.end('Not found');return}
 const local=pathname.slice(prefix.length);
 let filename=null;
 const allowed=new Set(['settings','messages','community','global-chat','players','tournaments']);
 if(views.some(x=>x[1]===local))filename=local==='turnieje.html'?'tournaments.html':local;
 else if(local.startsWith('assets/')){
  const asset=local.slice('assets/'.length);
  if(asset==='bridge.js'||/^(settings|messages|community|global-chat|players|tournaments)\.(css|js)$/.test(asset)) filename=asset;
 }
 if(!filename){res.writeHead(404);res.end('Not found');return}
 const ext=path.extname(filename),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
 const bytes=await fs.readFile(path.join(root,filename));
 res.writeHead(200,{'Content-Type':types[ext],'Cache-Control':'no-store'});
 res.end(bytes);
}
async function run(){
 ({servePlayerPanel}=await import(require('node:url').pathToFileURL(path.resolve(__dirname,'../../contact-api/auth/panel.mjs')).href));
 await fs.mkdir(output,{recursive:true});
 const server=http.createServer((req,res)=>{void listener(req,res).catch(e=>{console.error(e);res.writeHead(500);res.end('Internal fixture error')})});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const issues=[];
 try{
  for(const device of [
    {name:'desktop',width:1440,height:900,isMobile:false},
    {name:'mobile',width:390,height:844,isMobile:true}
  ]){
   for(const [name,slug] of views){
    const page=await browser.newPage({viewport:{width:device.width,height:device.height},deviceScaleFactor:1,isMobile:device.isMobile,hasTouch:device.isMobile});
    const pageErrors=[];
    const missing=[];
    page.on('pageerror',e=>pageErrors.push(String(e.message||e)));
    page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)missing.push({url:r.url(),status:r.status()})});
    const response=await page.goto(origin+'/konto/sierpien/'+slug,{waitUntil:'load',timeout:25000});
    await page.waitForTimeout(700);
    const metrics=await page.evaluate(()=>({
     width:document.documentElement.scrollWidth,viewport:window.innerWidth,
     title:document.title,header:!!document.querySelector('header'),
     loadedStyles:Array.from(document.styleSheets).filter(x=>x.href?.includes('/konto/sierpien/assets/')).length
    }));

    if(name==='players'){
     const gameCards=await page.locator('.quick-game[href^="/konto/"]').count();
     if(gameCards!==3)pageErrors.push('premium lobby needs three live game links, got '+gameCards);
     const allFriends=await page.locator('.friend-row').count();
     if(allFriends!==2)pageErrors.push('live friends not rendered: '+allFriends);
     await page.locator('[data-filter="online"]').click();
     if(await page.locator('.friend-row').count()!==1)pageErrors.push('online friend filter did not work');
     await page.locator('[data-filter="offline"]').click();
     if(await page.locator('.friend-row').count()!==1)pageErrors.push('offline friend filter did not work');
     await page.locator('[data-filter="all"]').click();
     await page.fill('#search','gracz2');
     if(await page.locator('.friend-row').count()!==1)pageErrors.push('nickname search did not filter');
     await page.fill('#search','');
     const entries=await page.locator('#player-menu a[data-section]').evaluateAll(xs=>xs.map(x=>[[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim(),x.getAttribute('href')]));
     const expected=sidebarSections.map(([label,id])=>[label,'/konto/panel/?sekcja='+id]);
     if(JSON.stringify(entries)!==JSON.stringify(expected))pageErrors.push('sidebar entries mismatch: '+JSON.stringify(entries));
     if(await page.locator('#player-menu a.active[aria-current="page"]').count()!==1)pageErrors.push('sidebar active lobby item missing');
     const toggle=page.locator('#sidebar-toggle'),menu=page.locator('#player-menu');
     if(device.name==='desktop'){
      const side=await page.locator('#player-sidebar').boundingBox(),hero=await page.locator('.hero').boundingBox();
      if(!(await menu.isVisible())||await toggle.isVisible())pageErrors.push('desktop sidebar must be visible without toggle');
      if(!side||!hero||side.x<hero.x+hero.width||side.width<250||side.width>300)pageErrors.push('desktop sidebar not vertically aligned on the right of lobby: '+JSON.stringify({side,hero}));
      if(await page.locator('#player-sidebar').evaluate(x=>getComputedStyle(x).position)!=='sticky')pageErrors.push('desktop sidebar not sticky');
       if(await page.locator('.lobby-layout').evaluate(x=>getComputedStyle(x).display)!=='grid')pageErrors.push('desktop lobby layout missing CSS grid');
     }else{
      if(!(await toggle.isVisible())||await menu.isVisible())pageErrors.push('mobile menu must start collapsed behind toggle');
      await toggle.click();
      if(!(await menu.isVisible())||await toggle.getAttribute('aria-expanded')!=='true')pageErrors.push('mobile menu toggle did not open');
      await page.locator('#player-menu a[data-section="security"]').focus();
      await page.keyboard.press('Escape');
      if(await menu.isVisible()||await toggle.getAttribute('aria-expanded')!=='false')pageErrors.push('Escape did not close mobile menu');
      if(!(await toggle.evaluate(x=>x===document.activeElement)))pageErrors.push('focus not returned to mobile menu toggle');
     }
    }
    await page.screenshot({path:path.join(output,device.name+'-'+name+'.png'),fullPage:true});
    const problems=[];
    if(response.status()!==200)problems.push('HTTP '+response.status());
    if(new URL(page.url()).pathname!=='/konto/sierpien/'+slug)problems.push('unexpected redirect '+page.url());
    if(!metrics.loadedStyles)problems.push('no local stylesheet loaded');
    if(pageErrors.length)problems.push('JS exceptions: '+pageErrors.join('; '));
    if(missing.length)problems.push('local HTTP failures: '+JSON.stringify(missing));
    if(metrics.width>metrics.viewport+2)problems.push('horizontal overflow '+metrics.width+'/'+metrics.viewport);
    console.log(JSON.stringify({view:name,device:device.name,...metrics,problems}));
    if(problems.length)issues.push(device.name+'/'+name+': '+problems.join('; '));
    await page.close();
   }
  }
  for(const device of [{name:'desktop',width:1440,height:900,isMobile:false,sections:sidebarSections},{name:'mobile',width:390,height:844,isMobile:true,sections:[sidebarSections[1]]}]){
   const nav=await browser.newPage({viewport:{width:device.width,height:device.height},isMobile:device.isMobile,hasTouch:device.isMobile});
   for(const [label,id] of device.sections){
    await nav.goto(origin+'/konto/sierpien/players.html',{waitUntil:'load'});
    if(device.isMobile)await nav.locator('#sidebar-toggle').click();
    await nav.locator('#player-menu a[data-section="'+id+'"]').click();
    await nav.waitForURL(origin+'/konto/panel/?sekcja='+id,{timeout:10000});
    try{await nav.locator('[data-panel="'+id+'"].active').waitFor({state:'visible',timeout:10000})}
    catch{issues.push(device.name+' sidebar "'+label+'" did not open panel section '+id);continue}
    if(await nav.locator('.nav.active[data-section]').getAttribute('data-section')!==id)issues.push(device.name+' panel nav not active for '+id);
   }
   await nav.close();
  }
  console.log('PLAYER_SIDEBAR_NAVIGATION_PASS');
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>issues.push('workflow JS: '+e.message));
  await page.goto(origin+'/konto/sierpien/turnieje.html');
  await page.click('#create-tournament');
  await page.fill('#ct-title','Turniej próbny — Gomoku');
  await page.click('#create-submit');
  await page.waitForTimeout(450);
  if(fixtures.created.length!==1)issues.push('create tournament form did not submit');
  else console.log('TOURNAMENT_CREATE_FORM_PASS');
  await page.goto(origin+'/konto/sierpien/messages.html');
  await page.click('#compose-btn');
  await page.fill('#recipient-search','gracz2');
  await page.fill('#compose-form [name=subject]','Test interfejsu');
  await page.fill('#message-editor','Wiadomość testowa z przeglądarki');
  await page.locator('#compose-form [type=submit]').click();
  await page.waitForTimeout(300);
  if(fixtures.sent.length!==1)issues.push('message composition did not submit');
  else console.log('MESSAGE_COMPOSE_FORM_PASS');
  await page.goto(origin+'/konto/sierpien/global-chat.html');
  await page.fill('.august-live-chat form input','Test chatu przeglądarkowego');
  await page.locator('.august-live-chat form button').click();
  await page.waitForTimeout(250);
  if(fixtures.chat.length!==2)issues.push('general chat did not submit');
  else console.log('GENERAL_CHAT_FORM_PASS');
  await page.close();
  if(issues.length)throw Error('AUGUST_BROWSER_SMOKE_FAILED\n'+issues.join('\n'));
  console.log('AUGUST_BROWSER_SMOKE_PASS 6 modules x 2 viewports + player sidebar + 3 form workflows');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
