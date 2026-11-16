import {chromium,startServer,context,open,log,save,cleanup,clickMove,sleep,saveKey,injected} from './bh.mjs';
const srv=await startServer();const base=srv.base;const browser=await chromium.launch({headless:true});
try{for(let run=1;run<=2;run++){const ctx=await context(browser,base,null);const page=await open(ctx,base+'/konto/szachy/');
 await page.evaluate(([k,v])=>localStorage.setItem(k,v),[saveKey,injected(['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6'],{opponent:'computer'})]);await page.reload();await page.waitForFunction(()=>document.body.classList.contains('cc-owner'));
 const w=[];await clickMove(page,'h5','f7');await sleep(600);w.push(await page.locator('#record-wins').textContent());
 for(let i=0;i<3;i++){await page.locator('#chess-owner-undo').click();await clickMove(page,'h5','f7');await sleep(600);w.push(await page.locator('#record-wins').textContent());}
 log('A09-r'+run,'komputer/wynik','Powtórzenie: wygrana, potem 3× (Cofnij + ten sam mat) — bilans wygranych',w.every(x=>x==='1'),{winsSequence:w});await ctx.close();}}
finally{await browser.close();srv.child.kill('SIGKILL');await cleanup();save('repeat-a09');process.exit(0);}
