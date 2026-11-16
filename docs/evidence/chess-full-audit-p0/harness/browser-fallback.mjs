import {chromium,startServer,user,friends,challenge,context,log,save,cleanup,sleep,SHOTS} from './bh.mjs';
const srv=await startServer();const base=srv.base;const browser=await chromium.launch({headless:true});
try{
 const A=await user('Fbk'),B=await user('Fbl');await friends(A,B);const id=await challenge(A,B,0,0);
 const ctx=await context(browser,base,A);const page=await ctx.newPage();
 let chat=0,match=0,chat429=0,match429=0;
 page.on('response',r=>{const u=r.url();if(u.includes('/auth/match/chat?')){chat++;if(r.status()===429)chat429++;}else if(u.includes('/auth/match?')){match++;if(r.status()===429)match429++;}});
 await page.routeWebSocket('**/auth/match/realtime',ws=>{ws.close();}); // WebSocket unavailable (e.g. blocking proxy)
 await page.clock.install();
 await page.goto(base+'/konto/szachy/?match='+id,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('cc-owner'));
 for(let minute=1;minute<=14;minute++){await page.clock.runFor(60000);await sleep(900);}
 const status=await page.locator('#chat-status').textContent();const notice=await page.locator('#game-state').textContent();
 await page.screenshot({path:SHOTS+'/53-fallback-polling-limit.png'});
 log('L11','limity','Brak WebSocket → polling co 4 s przez 14 min (zegar strony przyspieszony): przekroczenie limitów GET czatu/partii',chat429===0&&match429===0,{chatRequests:chat,chat429,matchRequests:match,match429,chatStatus:status,notice});
 await ctx.close();
}finally{await browser.close();srv.child.kill('SIGKILL');await cleanup();save('browser-fallback');process.exit(0);}
