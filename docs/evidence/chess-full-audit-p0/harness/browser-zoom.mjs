import {chromium,startServer,context,open,log,save,cleanup,sq,pieces,sleep,SHOTS} from './bh.mjs';
const srv=await startServer();const base=srv.base;const browser=await chromium.launch({headless:true});
try{for(const [w,h,label] of [[800,450,'200%'],[1067,600,'150%'],[1280,720,'125%']]){
 const z=await context(browser,base,null,{viewport:{width:w,height:h},deviceScaleFactor:1600/w});const p=await open(z,base+'/konto/szachy/');
 const opp=await p.evaluate(()=>{const o=document.getElementById('chess-opponent');o.value='human';o.dispatchEvent(new Event('change',{bubbles:true}));return true;});
 await p.locator('#board .chess-square').nth(sq('f3')).scrollIntoViewIfNeeded();await p.locator('#board .chess-square').nth(sq('g1')).scrollIntoViewIfNeeded();
 const a=await p.locator('#board .chess-square').nth(sq('g1')).boundingBox(),b=await p.locator('#board .chess-square').nth(sq('f3')).boundingBox();
 const inView=a.y+a.height<=h&&b.y>=0;
 await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await p.mouse.up();await sleep(400);
 const pc=await pieces(p);await p.screenshot({path:SHOTS+`/42-zoom-${label.replace('%','pct')}.png`});
 log('B20-'+label,'plansza',`Powiększenie ${label} (${w}×${h} CSS px): przeciąganie myszą g1→f3 trafia w poprawne pole`,pc[sq('f3')]==='N',{f3:pc[sq('f3')],bothSquaresInView:inView,boxes:{g1:a,f3:b}});
 await z.close();}}
finally{await browser.close();srv.child.kill('SIGKILL');await cleanup();save('browser-zoom');process.exit(0);}
