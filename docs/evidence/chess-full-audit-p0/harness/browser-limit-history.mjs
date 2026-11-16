// AUDIT ONLY — end-to-end consequence of the 80-move/15-min limit in a timed game; online history > 300 plies.
import fs from 'node:fs';
import {chromium,startServer,user,friends,challenge,db,context,open,log,save,cleanup,sq,pieces,clickMove,sleep,SHOTS,AUDIT,HOST} from './bh.mjs';
const srv=await startServer();const base=srv.base;const browser=await chromium.launch({headless:true});
const T=async(id,area,desc,fn)=>{try{const r=await fn();log(id,area,desc,r.pass,r.actual,r.extra||{});}catch(e){log(id,area,desc,false,'EXCEPTION '+String(e.message).slice(0,300));}};
const api=async(u,method,path,body)=>{const r=await fetch(base+path,{method,headers:{Origin:HOST,Cookie:'__Host-gracz_session='+u.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};};
const long=JSON.parse(fs.readFileSync(AUDIT+'/evidence/long-game.json'));
try{
 await T('L10','limity/zegary','Skutek limitu: po 80 ruchach w 15 min gracz w nowej partii 1 min nie może ruszyć (429) i przegrywa na czas',async()=>{
  const P=await user('Lim'),Q=await user('Lio');await friends(P,Q);const m1=await challenge(P,Q,0,0);
  let st=(await api(P,'GET','/auth/match?id='+m1)).match;let n=0;
  for(const u of long.ucis){const who=st.state.turn===1?P:Q;const r=await api(who,'POST','/auth/match',{id:m1,version:st.version,move:{uci:u}});if(r.status!==200)break;st=r.match;n++;if(n>=160)break;}
  const m2=await challenge(P,Q,1,0);const cp=await context(browser,base,P),cq=await context(browser,base,Q);const pp=await open(cp,base+'/konto/szachy/?match='+m2),pq=await open(cq,base+'/konto/szachy/?match='+m2);
  await sleep(2000);await clickMove(pp,'e2','e4');await sleep(1500);const notice=await pp.locator('#game-state').textContent();
  const s1=(await db.query('SELECT state FROM gracz_public_identity.game_matches WHERE challenge_id=$1',[m2])).rows[0].state;
  await pp.screenshot({path:SHOTS+'/50-move-rate-limited.png'});
  await pp.waitForFunction(()=>/Partia zakończona/.test(document.getElementById('game-state').textContent),null,{timeout:90000});
  const s2=(await db.query('SELECT state FROM gracz_public_identity.game_matches WHERE challenge_id=$1',[m2])).rows[0].state;const fin=await pp.locator('#game-state').textContent();const popup=await pp.locator('#game-result-modal').isVisible();
  await pp.screenshot({path:SHOTS+'/51-rate-limited-time-loss.png'});await cp.close();await cq.close();
  return {pass:false,actual:{movesPlayedInFirstGame:n,noticeAfterMoveAttempt:notice,historyAfterAttempt:s1.history.length,final:fin,winner:s2.winner,timeoutLoser:s2.clock.timeoutLoser,loserPopupShown:popup}};});
 await T('H10','historia','Online >300 półruchów: lista ruchów (numeracja), przegląd pozycji, PGN',async()=>{
  const R=await user('Lng'),S=await user('Lnh');await friends(R,S);const id=await challenge(R,S,0,0);await api(R,'GET','/auth/match?id='+id);
  await db.query('UPDATE gracz_public_identity.game_matches SET state=$1::jsonb WHERE challenge_id=$2',[JSON.stringify(long.state),id]);
  const c=await context(browser,base,R);const p=await open(c,base+'/konto/szachy/?match='+id);await sleep(1500);await p.locator('#history-tab').click();
  const a=await p.evaluate(()=>({count:document.getElementById('history-count').textContent,firstRow:document.querySelector('#moves-list .chess-history-turn')?.innerText.replace(/\s+/g,' '),enabledReview:document.querySelectorAll('#moves-list .chess-move-row:not([disabled])').length,disabledReview:document.querySelectorAll('#moves-list .chess-move-row[disabled]').length}));
  await c.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});await p.locator('.chess-history-action[data-action="pgn"]').click();await sleep(300);const pgn=await p.evaluate(()=>navigator.clipboard.readText());
  await p.screenshot({path:SHOTS+'/52-online-history-300.png'});await c.close();
  const realFirst=long.state.history[0];
  return {pass:a.firstRow.startsWith(String(Math.ceil(realFirst.number/2))+'.')&&a.disabledReview===0,actual:{...a,serverFirstEntry:{number:realFirst.number,san:realFirst.san},pgnStart:pgn.slice(0,40)}};});
}catch(e){log('X00','harness','Wyjątek',false,String(e.stack).slice(0,600));}
finally{await browser.close();srv.child.kill('SIGKILL');await cleanup();save('browser-limit-history');process.exit(0);}
