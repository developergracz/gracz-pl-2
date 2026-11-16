// AUDIT ONLY. Online chess against the real production router, PostgreSQL 16 and Redis on loopback.
// Disposable accounts in database gracz_test; nothing here touches production.
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire('/home/user/gracz-pl-2/contact-api/package.json');
const WebSocket=require('ws');
const {createDatabase}=await import('/home/user/gracz-pl-2/contact-api/persistence/database.mjs');
const {assertDisposableDatabaseUrl}=await import('/home/user/gracz-pl-2/contact-api/integration/test-database-guard.mjs');
assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const HOST='https://gracz-contact-api.onrender.com',hash=x=>createHash('sha256').update(x).digest();
const results=[];const log=(id,area,desc,pass,actual)=>{results.push({id,area,desc,pass,actual});console.error((pass?'PASS ':'FAIL ')+id+' '+desc+' '+JSON.stringify(actual).slice(0,300));};
const child=fork('/home/user/gracz-pl-2/contact-api/scaling/browser-instance.mjs',{env:{...process.env},stdio:['ignore','pipe','pipe','ipc']});
let errs='';child.stderr.on('data',x=>errs+=x);child.stdout.on('data',x=>errs+=x);
const [{port}]=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('server died '+errs)})]);
const base='http://127.0.0.1:'+port;
const db=createDatabase();
const users={};
async function user(tag){
 const id=randomUUID(),token=randomBytes(32).toString('hex'),nick=('Aud'+tag+id.replaceAll('-','')).slice(0,20);
 await db.query('INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES($1,$2,$3,$4,$5,$5,now())',[id,nick,nick.toLowerCase(),nick.toLowerCase()+'@example.invalid',Buffer.alloc(64)]);
 await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",[hash(token),id]);
 return users[tag]={id,token,nick,tag};
}
async function friends(a,b){await db.query("INSERT INTO gracz_public_identity.friend_connections(account_a,account_b,requested_by,status) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,'accepted')",[a.id,b.id]);}
async function api(u,method,path,body,{origin=HOST,cookie,raw}={}){
 const headers={Origin:origin};
 if(u||cookie)headers.Cookie=cookie??('__Host-gracz_session='+u.token);
 if(body!==undefined)headers['Content-Type']='application/json';
 const r=await fetch(base+path,{method,headers,body:raw??(body===undefined?undefined:JSON.stringify(body))});
 let j={};try{j=await r.json();}catch{}
 return {status:r.status,...j};
}
const getMatch=(u,id)=>api(u,'GET','/auth/match?id='+id);
const move=(u,id,version,uci)=>api(u,'POST','/auth/match',{id,version,move:{uci}});
async function invite(a,b,minutes=0,inc=0){
 const s=await api(a,'POST','/auth/social/challenges',{action:'send',game:'szachy',nickname:b.nick,timeLimitMinutes:minutes,incrementSeconds:inc});
 if(!s.ok)throw Error('invite failed '+JSON.stringify(s));
 const acc=await api(b,'POST','/auth/social/challenges',{action:'accept',id:s.id});
 if(!acc.ok)throw Error('accept failed '+JSON.stringify(acc));
 return s.id;
}
async function setState(id,mutate){
 const r=await db.query('SELECT state,version FROM gracz_public_identity.game_matches WHERE challenge_id=$1',[id]);
 const state=mutate(structuredClone(r.rows[0].state));
 await db.query('UPDATE gracz_public_identity.game_matches SET state=$1::jsonb,version=version+1 WHERE challenge_id=$2',[JSON.stringify(state),id]);
}
try{
 const A=await user('A'),B=await user('B'),C=await user('C');
 await friends(A,B);await friends(A,C);
 // ---------- Lifecycle with 5+2 clock ----------
 const id=await invite(A,B,5,2);
 log('O01','online','Zaproszenie wysłane przez API i zaakceptowane przez drugie konto',true,{id});
 let a=await getMatch(A,id);
 log('O02','online','Pierwsze otwarcie tworzy partię; A=gracz 1 (białe); zegar nie startuje przed wejściem B',a.status===200&&a.match.player===1&&a.match.state.clock.since===null&&a.match.state.clock.ready.join()==='true,false',{player:a.match?.player,clock:a.match?.state?.clock});
 let early=await move(A,id,a.match.version,'e2e4');
 log('O03','zegary','Ruch przed wejściem przeciwnika (partia na czas) odrzucony',early.status===409&&early.error==='OCZEKIWANIE_NA_GRACZA',early);
 const b=await getMatch(B,id);
 log('O04','zegary','Wejście B: player=2 (czarne), ready=[true,true], zegar startuje (since ustawione), 5:00/5:00',b.match.player===2&&b.match.state.clock.ready.every(Boolean)&&!!b.match.state.clock.since&&b.match.state.clock.remaining.join()==='300000,300000'&&b.match.state.clock.incrementMs===2000,b.match.state.clock);
 const c=await getMatch(C,id);
 log('S01','bezpieczeństwo','Trzecie konto (znajomy A) nie może odczytać cudzej partii',c.status===404,{status:c.status,error:c.error});
 const cm=await move(C,id,b.match.version,'e2e4');
 log('S02','bezpieczeństwo','Trzecie konto nie może wykonać ruchu w cudzej partii',cm.status===404,{status:cm.status,error:cm.error});
 let v=b.match.version;
 const wrongTurn=await move(B,id,v,'e7e5');
 log('S03','bezpieczeństwo','Ruch w imieniu przeciwnika (czarne na turze białych) odrzucony',wrongTurn.status===409&&wrongTurn.error==='NIE_TWOJA_TURA',wrongTurn);
 const blackPieceByWhite=await move(A,id,v,'e7e5');
 log('S04','bezpieczeństwo','Białe próbują ruszyć figurę czarnych → odrzucone',blackPieceByWhite.status===409&&blackPieceByWhite.error==='NIEDOZWOLONY_RUCH',blackPieceByWhite);
 const stale=await move(A,id,v-1,'e2e4');
 log('S05','spójność','Nieaktualna wersja partii → 409 ODSWIEZ_PARTIE',stale.status===409&&stale.error==='ODSWIEZ_PARTIE',stale);
 // concurrent duplicate / conflicting moves
 const t0=Date.now();
 const race=await Promise.all([move(A,id,v,'e2e4'),move(A,id,v,'d2d4'),move(A,id,v,'e2e4'),move(A,id,v,'g1f3')]);
 let after=await getMatch(A,id);
 const ok=race.filter(r=>r.status===200);
 log('S06','spójność','4 równoczesne żądania ruchu z tą samą wersją → dokładnie 1 przyjęte, historia=1',ok.length===1&&after.match.state.history.length===1&&after.match.version===v+1,{statuses:race.map(r=>r.status+':'+(r.error||r.match?.state?.history?.at(-1)?.uci)),history:after.match.state.history.map(h=>h.uci),version:after.match.version});
 const replay=await move(A,id,v,after.match.state.history[0].uci);
 log('S07','spójność','Powtórzone (zdublowane) żądanie po sukcesie → odrzucone (409)',replay.status===409,{status:replay.status,error:replay.error});
 const clk=after.match.state.clock;
 log('Z01','zegary','Po ruchu białych: aktywny zegar czarnych, bonus +2 s doliczony białym, since odświeżone',after.match.state.turn===2&&clk.remaining[0]<=302000&&clk.remaining[0]>=300000-(Date.now()-t0)-2000&&clk.remaining[1]===300000&&!!clk.since,{remaining:clk.remaining,turn:after.match.state.turn});
 v=after.match.version;
 // ---------- CSRF / session ----------
 const csrf=await api(B,'POST','/auth/match',{id,version:v,move:{uci:'e7e5'}},{origin:'https://evil.example'});
 log('S08','bezpieczeństwo','POST z obcym Origin (CSRF) → 403',csrf.status===403,{status:csrf.status,error:csrf.error});
 const noOrigin=await fetch(base+'/auth/match',{method:'POST',headers:{Cookie:'__Host-gracz_session='+B.token,'Content-Type':'application/json'},body:JSON.stringify({id,version:v,move:{uci:'e7e5'}})});
 log('S09','bezpieczeństwo','POST bez nagłówka Origin → 403',noOrigin.status===403,{status:noOrigin.status});
 const noSess=await api(null,'GET','/auth/match?id='+id);
 log('S10','bezpieczeństwo','Brak sesji → 401',noSess.status===401,{status:noSess.status,error:noSess.error});
 const fakeSess=await api(null,'GET','/auth/match?id='+id,undefined,{cookie:'__Host-gracz_session='+'f'.repeat(64)});
 log('S11','bezpieczeństwo','Sfałszowany token sesji → 401',fakeSess.status===401,{status:fakeSess.status});
 const badId=await api(A,'GET','/auth/match?id=../../etc');
 log('S12','bezpieczeństwo','Nieprawidłowy identyfikator partii → 400',badId.status===400,{status:badId.status,error:badId.error});
 let big;try{big=await api(B,'POST','/auth/match',undefined,{raw:JSON.stringify({id,version:v,move:{uci:'e7e5'},pad:'x'.repeat(6000)})});}catch(e){big={status:'connection-reset',error:String(e.cause?.code||e.message)};}
 const stillV=(await getMatch(A,id)).match.version;
 log('S13','bezpieczeństwo','Zbyt duże body (>MAX_BODY) → odrzucone (400 lub zerwanie połączenia), stan bez zmian',(big.status===400||big.status==='connection-reset')&&stillV===v,{...big,versionUnchanged:stillV===v});
 const notJson=await api(B,'POST','/auth/match',undefined,{raw:'{"id":'});
 log('S14','bezpieczeństwo','Niepoprawny JSON → 400',notJson.status===400,{status:notJson.status,error:notJson.error});
 const resign=await api(B,'POST','/auth/match',{id,version:v,move:{resign:true}});
 log('N01','funkcje','Poddanie partii (resign) — brak w API',resign.status===409&&resign.error==='NIEDOZWOLONY_RUCH',{status:resign.status,error:resign.error,note:'NOT IMPLEMENTED'});
 const offer=await api(B,'POST','/auth/match',{id,version:v,move:{offerDraw:true}});
 log('N02','funkcje','Propozycja remisu za zgodą (offer/accept) — brak w API',offer.status===409,{status:offer.status,error:offer.error,note:'NOT IMPLEMENTED'});
 // ---------- Chat ----------
 const xss='<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>&lt;b&gt;';
 const sent=await api(A,'POST','/auth/match/chat',{id,message:xss});
 const read=await api(B,'GET','/auth/match/chat?id='+id);
 log('T01','czat','Wiadomość z HTML/skryptem zapisana i zwrócona jako surowy tekst (renderowanie sprawdzane w przeglądarce)',sent.ok&&read.messages?.at(-1)?.body===xss&&read.messages.at(-1).player===1,{sent:sent.status,body:read.messages?.at(-1)?.body});
 const long=await api(A,'POST','/auth/match/chat',{id,message:'x'.repeat(601)});
 log('T02','czat','Wiadomość >600 znaków → 400',long.status===400,{status:long.status,error:long.error});
 const ctrl=await api(A,'POST','/auth/match/chat',{id,message:'a\u0000b'});
 log('T03','czat','Znaki sterujące → 400',ctrl.status===400,{status:ctrl.status});
 const cchat=await api(C,'GET','/auth/match/chat?id='+id);const cpost=await api(C,'POST','/auth/match/chat',{id,message:'intruz'});
 log('T04','czat','Trzecie konto nie czyta i nie pisze na czacie cudzej partii',cchat.status===404&&cpost.status===404,{get:cchat.status,post:cpost.status});
 // ---------- WebSocket ----------
 const wsUrl='ws://127.0.0.1:'+port+'/auth/match/realtime';
 const wsOpen=(headers)=>new Promise(res=>{const ws=new WebSocket(wsUrl,{headers});const msgs=[];let st='open';ws.on('unexpected-response',(q,r)=>{res({ws,status:r.statusCode,msgs});});ws.on('open',()=>res({ws,status:101,msgs}));ws.on('message',d=>msgs.push(JSON.parse(String(d))));ws.on('close',(code,reason)=>{ws.closeCode=code;ws.closeReason=String(reason);});ws.on('error',()=>{});});
 const evil=await wsOpen({Origin:'https://evil.example',Cookie:'__Host-gracz_session='+A.token});
 log('W01','websocket','WS z obcego Origin odrzucony',evil.status===403,{status:evil.status});
 const anon=await wsOpen({Origin:HOST});
 log('W02','websocket','WS bez sesji odrzucony',anon.status===401,{status:anon.status});
 const wc=await wsOpen({Origin:HOST,Cookie:'__Host-gracz_session='+C.token});
 wc.ws.send(JSON.stringify({type:'subscribe',matchId:id,version:-1}));
 await new Promise(r=>setTimeout(r,1500));
 log('W03','websocket','Subskrypcja cudzej partii przez WS → zamknięcie 1008 bez danych',wc.ws.closeCode===1008&&wc.msgs.length===0,{code:wc.ws.closeCode,msgs:wc.msgs.length});
 const wb=await wsOpen({Origin:HOST,Cookie:'__Host-gracz_session='+B.token});
 wb.ws.send(JSON.stringify({type:'subscribe',matchId:id,version:-1}));
 await new Promise(r=>setTimeout(r,800));
 const snap=wb.msgs.find(m=>m.type==='snapshot');
 log('W04','websocket','Subskrypcja własnej partii → snapshot z seq=1 i czatem',!!snap&&snap.seq===1&&snap.match.version===v&&Array.isArray(snap.messages),{types:wb.msgs.map(m=>m.type),seq:snap?.seq,version:snap?.match?.version});
 const spam=await wsOpen({Origin:HOST,Cookie:'__Host-gracz_session='+B.token});
 for(let i=0;i<10;i++)spam.ws.send(JSON.stringify({type:'subscribe',matchId:id,version:-1}));
 await new Promise(r=>setTimeout(r,800));
 log('W05','websocket','Zalew wiadomości WS (>8/10 s) → zamknięcie 1008',spam.ws.closeCode===1008,{code:spam.ws.closeCode,reason:spam.ws.closeReason});
 const bm=await move(B,id,v,'e7e5');
 await new Promise(r=>setTimeout(r,800));
 const delta=wb.msgs.find(m=>m.type==='match');
 log('W06','websocket','Ruch → delta WS (baseVersion→version, zmiany planszy, dopisana historia)',bm.status===200&&!!delta&&delta.baseVersion===v&&delta.version===v+1&&delta.changes.length===2&&delta.historyAppend.at(-1).uci==='e7e5',{baseVersion:delta?.baseVersion,version:delta?.version,changes:delta?.changes,bytes:delta&&JSON.stringify(delta).length});
 v=v+1;
 // session revoked → WS closed and API 401
 await db.query('UPDATE gracz_public_identity.sessions SET expires_at=now()-interval \'1 second\' WHERE token_digest=$1',[hash(B.token)]);
 const exp=await move(B,id,v,'g8f6');
 log('S15','bezpieczeństwo','Wygaśnięta sesja w trakcie gry → ruch 401',exp.status===401,{status:exp.status,error:exp.error});
 await new Promise(r=>setTimeout(r,2500));
 log('W07','websocket','Wygaśnięta sesja → istniejący WS zostaje zamknięty przy rekonsyliacji',wb.ws.closeCode===1008||wb.ws.readyState===3,{code:wb.ws.closeCode,state:wb.ws.readyState});
 await db.query('UPDATE gracz_public_identity.sessions SET expires_at=now()+interval \'2 hours\' WHERE token_digest=$1',[hash(B.token)]);
 // ---------- Undo with consent ----------
 a=await getMatch(A,id);v=a.match.version;
 let m1=await move(A,id,v,'g1f3');v=m1.match.version;
 const reqU=await api(A,'POST','/auth/match/undo',{id,version:v,action:'request'});
 log('U01','cofanie','Prośba o cofnięcie wstrzymuje zegar (since=null)',reqU.status===200&&reqU.match.state.clock.since===null&&!!reqU.match.undoRequest,{status:reqU.status,since:reqU.match?.state?.clock?.since});
 v=reqU.match.version;
 const blockedMove=await move(B,id,v,'g8f6');
 log('U02','cofanie','Przy oczekującej prośbie ruch przeciwnika zablokowany (OCZEKUJE_NA_DECYZJE)',blockedMove.status===409&&blockedMove.error==='OCZEKUJE_NA_DECYZJE',blockedMove);
 const selfAccept=await api(A,'POST','/auth/match/undo',{id,version:v,action:'accept',requestId:reqU.match.undoRequest.id});
 log('U03','cofanie','Wnioskodawca nie może sam zaakceptować własnej prośby',selfAccept.status===409,{status:selfAccept.status,error:selfAccept.error});
 const acc=await api(B,'POST','/auth/match/undo',{id,version:v,action:'accept',requestId:reqU.match.undoRequest.id});
 log('U04','cofanie','Akceptacja przez przeciwnika cofa ruch, tura wraca do białych, zegar wznowiony, bonus odebrany',acc.status===200&&acc.match.state.history.length===2&&acc.match.state.turn===1&&!!acc.match.state.clock.since,{hist:acc.match?.state?.history?.map(h=>h.uci),turn:acc.match?.state?.turn,remaining:acc.match?.state?.clock?.remaining});
 v=acc.match.version;
 // undo expiry restores clock from expiry instant
 m1=await move(A,id,v,'g1f3');v=m1.match.version;
 const req2=await api(A,'POST','/auth/match/undo',{id,version:v,action:'request'});
 await setState(id,s=>{s.undo.createdAt=new Date(Date.now()-200000).toISOString();return s;});
 const afterExp=await getMatch(B,id);
 const since=Date.parse(afterExp.match.state.clock.since);
 log('U05','cofanie','Nieodebrana prośba wygasa po 3 min; zegar liczony od chwili wygaśnięcia',!afterExp.match.undoRequest&&Math.abs(since-(Date.now()-20000))<3000,{undo:afterExp.match.undoRequest,sinceAgoMs:Date.now()-since});
 v=afterExp.match.version;
 // ---------- Draw claim end-to-end ----------
 // ---------- Timeout ----------
 await setState(id,s=>{s.clock.since=new Date(Date.now()-400000).toISOString();return s;});
 const tA=await getMatch(A,id),tB=await getMatch(B,id);
 log('Z02','zegary','Przekroczenie czasu finalizowane przez serwer przy odczycie; wynik zgodny u obu graczy',tA.match.state.winner===1&&tB.match.state.winner===1&&tA.match.state.clock.timeoutLoser===2&&tA.match.state.clock.since===null,{winnerA:tA.match.state.winner,winnerB:tB.match.state.winner,loser:tA.match.state.clock.timeoutLoser,remaining:tA.match.state.clock.remaining});
 const lateMove=await move(B,id,tB.match.version,'g8f6');
 log('Z03','zegary','Ruch po przekroczeniu czasu odrzucony',lateMove.status===409,{status:lateMove.status,error:lateMove.error});
 // Timeout vs insufficient material (FIDE 6.9): opponent with bare king cannot win on time.
 const D=await user('D'),E=await user('E');await friends(D,E);
 const id2=await invite(D,E,1,0);await getMatch(D,id2);await getMatch(E,id2);
 await setState(id2,s=>{const b=Array(128).fill('.');b[4]='k';b[116]='K';b[100]='Q';s.board=b;s.c=0;s.ep=-1;s.turn=1;s.clock.since=new Date(Date.now()-120000).toISOString();return s;});
 const fide=await getMatch(D,id2);
 log('Z04','zegary','FIDE 6.9: białe przekraczają czas, czarne mają samego króla → powinien być remis',fide.match.state.winner===3,{winner:fide.match.state.winner,note:'winner 2 = czarne wygrywają mimo samego króla'});
 // ---------- Blocked friend ----------
 const F=await user('F'),G=await user('G');await friends(F,G);const id3=await invite(F,G,0,0);
 let f=await getMatch(F,id3);
 await db.query('INSERT INTO gracz_public_identity.friend_blocks(blocker,blocked) VALUES($1,$2)',[G.id,F.id]);
 const blk=await move(F,id3,f.match.version,'e2e4');
 log('S16','bezpieczeństwo','Po zablokowaniu znajomego ruchy w partii są zablokowane',blk.status===403&&blk.error==='PARTIA_ZABLOKOWANA',{status:blk.status,error:blk.error});
 // ---------- Rate limits (15-minute fixed window per account) ----------
 const H=await user('H'),I=await user('I');await friends(H,I);const id4=await invite(H,I,0,0);
 const longUcis=JSON.parse(fs.readFileSync(new URL('./evidence/long-game.json',import.meta.url))).ucis;
 let st=(await getMatch(H,id4)).match;let firstLimited=null,ply=0;
 for(const u of longUcis){const who=st.state.turn===1?H:I;const r=await move(who,id4,st.version,u);ply++;if(r.status===429){firstLimited={ply,player:who.tag,moveNumberOfPlayer:Math.ceil(ply/2),error:r.error};break;}if(r.status!==200){firstLimited={ply,unexpected:r};break;}st=r.match;}
 log('L01','limity','Limit 80 ruchów POST na konto w stałym oknie 15 min — ruch 81. gracza odrzucony 429',firstLimited?.ply===161&&firstLimited?.error==='ZBYT_WIELE_PROB',firstLimited);
 const J=await user('J'),K=await user('K');await friends(J,K);const id5=await invite(J,K,0,0);await getMatch(J,id5);
 let chatLimit=null;for(let i=1;i<=200;i++){const r=await api(J,'GET','/auth/match/chat?id='+id5);if(r.status===429){chatLimit=i;break;}}
 log('L02','limity','Limit GET czatu = 180 / 15 min (polling awaryjny co 4 s = 225 / 15 min)',chatLimit===181,{firstRejectedRequest:chatLimit});
 let getLimit=null;for(let i=2;i<=260;i++){const r=await getMatch(J,id5);if(r.status===429){getLimit=i;break;}}
 log('L03','limity','Limit GET partii = 240 / 15 min (polling awaryjny co 4 s = 225 / 15 min + wymuszone odświeżenia)',getLimit===241,{firstRejectedRequest:getLimit});
 // ---------- Draw claim end-to-end ----------
 const L=await user('L'),M=await user('M');await friends(L,M);const id6=await invite(L,M,3,0);await getMatch(L,id6);let mm=(await getMatch(M,id6)).match;
 for(const u of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']){const who=mm.state.turn===1?L:M;const r=await move(who,id6,mm.version,u);mm=r.match;}
 const claim=await api(L,'POST','/auth/match',{id:id6,version:mm.version,move:{claimDraw:true}});
 log('D01','remis','Zgłoszenie remisu (3-krotne powtórzenie) przez API: winner=3, zegar zatrzymany',claim.status===200&&claim.match.state.winner===3&&claim.match.state.clock.since===null&&claim.match.state.drawReason==='TRZYKROTNE_POWTORZENIE',{status:claim.status,winner:claim.match?.state?.winner,since:claim.match?.state?.clock?.since});
 const sizes=await db.query('SELECT challenge_id, pg_column_size(state) AS bytes, jsonb_array_length(state->\'positions\') AS positions FROM gracz_public_identity.game_matches WHERE challenge_id=$1',[id4]);
 log('P01','wydajność','Rozmiar stanu JSONB długiej partii w PostgreSQL',true,sizes.rows[0]);
}catch(e){log('X00','harness','Wyjątek harnessu',false,String(e.stack||e));}
finally{
 for(const u of Object.values(users))await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[u.id]).catch(()=>{});
 await db.close();child.kill('SIGKILL');
 const pass=results.filter(r=>r.pass).length;
 console.log(JSON.stringify({pass,fail:results.length-pass,results},null,1));
 process.exit(0);
}
