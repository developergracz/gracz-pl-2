// AUDIT ONLY. Explicit FEN scenarios for §4.1–§4.3 against the real modules (no mocks).
import fs from 'node:fs';
import * as R from '/home/user/gracz-pl-2/contact-api/auth/chess-rules.mjs';
import {initialChessMatch,playChessMatch,undoLastChessMove} from '/home/user/gracz-pl-2/contact-api/auth/chess-match.mjs';
const results=[];
const uci=m=>R.coord(m[0])+R.coord(m[1])+m[2];
const moves=f=>R.legal(R.parseFen(f)).map(uci).sort();
function T(id,area,desc,fn){let pass=false,actual;try{const r=fn();pass=r.pass;actual=r.actual;}catch(e){actual='EXCEPTION '+e.message;}results.push({id,area,desc,pass,actual});}
const st2s=st=>({b:st.board,t:st.turn===1?1:-1,c:st.c,ep:st.ep,half:st.half,full:st.full});
function fromFen(f){const st=initialChessMatch(),s=R.parseFen(f);return Object.assign(st,{board:s.b,turn:s.t===1?1:2,c:s.c,ep:s.ep,half:s.half,full:s.full,positions:[R.key(s)]});}
// 4.1 piece moves
T('R01','ruchy','Start: 20 legalnych ruchów',()=>{const n=moves(R.START_FEN).length;return {pass:n===20,actual:n};});
T('R02','ruchy','Skoczek b1: a3,c3; nie d2 (własna figura)',()=>{const m=moves(R.START_FEN).filter(x=>x.startsWith('b1'));return {pass:m.join()==='b1a3,b1c3',actual:m};});
T('R03','ruchy','Gońce zablokowane na starcie (0 ruchów)',()=>{const m=moves(R.START_FEN).filter(x=>x.startsWith('c1')||x.startsWith('f1'));return {pass:m.length===0,actual:m};});
T('R04','ruchy','Wieża: blokowanie drogi i bicie',()=>{const m=moves('4k3/8/8/p7/8/8/8/R3K3 w Q - 0 1').filter(x=>x.startsWith('a1'));return {pass:m.includes('a1a5')&&!m.includes('a1a6')&&m.includes('a1d1'),actual:m};});
T('R05','ruchy','Hetman 27 ruchów z d4 na pustej planszy',()=>{const m=moves('8/7k/8/8/3Q4/8/K7/8 w - - 0 1').filter(x=>x.startsWith('d4'));return {pass:m.length===27,actual:m.length};});
T('R06','ruchy','Król nie może wejść na pole atakowane',()=>{const m=moves('4k3/8/8/8/8/8/r7/4K3 w - - 0 1');return {pass:!m.includes('e1e2')&&!m.includes('e1d2')&&m.includes('e1d1'),actual:m};});
T('R07','ruchy','Związany skoczek (pin pionowy) nie może się ruszyć',()=>{const m=moves('4q2k/8/8/8/8/8/4N3/4K3 w - - 0 1').filter(x=>x.startsWith('e2'));return {pass:m.length===0,actual:m};});
T('R08','ruchy','Związany goniec porusza się tylko wzdłuż linii związania',()=>{const m=moves('7k/8/8/8/8/2b5/3B4/4K3 w - - 0 1').filter(x=>x.startsWith('d2'));return {pass:m.join()==='d2c3',actual:m};});
T('R09','ruchy','Pod szachem tylko ruchy usuwające szach',()=>{const m=moves('4k3/8/8/8/8/8/3P4/r3K3 w - - 0 1');return {pass:m.every(x=>x.startsWith('e1')),actual:m};});
T('R10','ruchy','Pion: podwójny ruch zablokowany na polu pośrednim',()=>{const m=moves('4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1').filter(x=>x.startsWith('e2'));return {pass:m.length===0,actual:m};});
T('R11','ruchy','Pion nie bije do przodu',()=>{const m=moves('4k3/8/8/8/8/4p3/4P3/4K3 w - - 0 1').filter(x=>x.startsWith('e2'));return {pass:m.length===0,actual:m};});
// 4.2 special
T('S01','roszada','Roszada krótka i długa dostępna',()=>{const m=moves('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');return {pass:m.includes('e1g1')&&m.includes('e1c1'),actual:m.filter(x=>x.startsWith('e1'))};});
T('S02','roszada','Brak roszady przez szach (f1 atakowane)',()=>{const m=moves('r3k2r/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');return {pass:!m.includes('e1g1'),actual:m.filter(x=>x.startsWith('e1'))};});
T('S03','roszada','Brak roszady gdy król w szachu',()=>{const m=moves('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1');return {pass:!m.includes('e1g1')&&!m.includes('e1c1'),actual:m.filter(x=>x.startsWith('e1'))};});
T('S04','roszada','Roszada długa dozwolona gdy b1 atakowane',()=>{const m=moves('1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1');return {pass:m.includes('e1c1'),actual:m.filter(x=>x.startsWith('e1'))};});
T('S05','roszada','Brak roszady na atakowane pole docelowe g1',()=>{const m=moves('4k1r1/8/8/8/8/8/8/4K2R w K - 0 1');return {pass:!m.includes('e1g1'),actual:m.filter(x=>x.startsWith('e1'))};});
T('S06','roszada','Utrata praw po ruchu króla',()=>{let s=R.parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');s=R.move(s,'e1f1');s=R.move(s,'a8b8');s=R.move(s,'f1e1');s=R.move(s,'b8a8');return {pass:s.c===4&&!R.legal(s).some(m=>m[3]==='castle'),actual:{c:s.c}};});
T('S07','roszada','Utrata prawa tylko po stronie ruszonej wieży',()=>{let s=R.parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');s=R.move(s,'h1h2');s=R.move(s,'a8a7');s=R.move(s,'h2h1');s=R.move(s,'a7a8');const m=R.legal(s).filter(x=>x[3]==='castle').map(uci);return {pass:m.join()==='e1c1'&&s.c===6,actual:{c:s.c,m}};});
T('S08','roszada','Utrata prawa po zbiciu wieży w rogu',()=>{let s=R.parseFen('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1');s=R.move(s,'g2h1');return {pass:!(s.c&1)&&!!(s.c&2),actual:{c:s.c}};});
T('S09','roszada','Wykonanie roszady przenosi wieżę',()=>{const s=R.parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');const a=R.move(s,'e1g1'),b=R.move(s,'e1c1');return {pass:a.b[R.square('f1')]==='R'&&a.b[R.square('h1')]==='.'&&b.b[R.square('d1')]==='R'&&b.b[R.square('a1')]==='.',actual:'ok'};});
T('E01','en passant','Bicie w przelocie tylko bezpośrednio po ruchu o 2 pola',()=>{let s=R.parseFen('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');s=R.move(s,'d7d5');const ok1=R.legal(s).some(m=>uci(m)==='e5d6'&&m[3]==='ep');let t=R.move(s,'e1d1');t=R.move(t,'e8d8');const ok2=!R.legal(t).some(m=>uci(m)==='e5d6');return {pass:ok1&&ok2,actual:{ok1,ok2}};});
T('E02','en passant','Bicie w przelocie usuwa właściwego piona',()=>{let s=R.parseFen('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');s=R.move(s,'d7d5');s=R.move(s,'e5d6');return {pass:s.b[R.square('d5')]==='.'&&s.b[R.square('d6')]==='P'&&s.half===0,actual:'ok'};});
T('E03','en passant','En passant odsłaniający szach po linii poziomej — nielegalny',()=>{const s=R.parseFen('8/8/8/K2pP2r/8/8/8/7k w - d6 0 1');return {pass:!R.legal(s).some(m=>uci(m)==='e5d6'),actual:R.legal(s).map(uci)};});
T('E04','en passant','En passant jako obrona przed szachem pionem',()=>{const s=R.parseFen('8/8/8/2k5/3Pp3/8/8/4K3 b - d3 0 1');const m=R.legal(s).map(uci);return {pass:m.includes('e4d3'),actual:m};});
T('P01','promocja','Promocja na H, W, G, S',()=>{const m=moves('8/4P3/8/8/8/8/k7/4K3 w - - 0 1').filter(x=>x.startsWith('e7'));return {pass:m.join()==='e7e8b,e7e8n,e7e8q,e7e8r',actual:m};});
T('P02','promocja','Promocja z biciem + SAN z szachem',()=>{const s=R.parseFen('3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1');const m=R.legal(s).find(x=>uci(x)==='e7d8q');return {pass:R.san(s,m)==='exd8=Q+',actual:R.san(s,m)};});
T('P03','promocja','Podpromocja na skoczka z szachem (e8=N+)',()=>{const s=R.parseFen('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1');const m=R.legal(s).find(x=>uci(x)==='e7e8n');return {pass:R.san(s,m)==='e8=N+',actual:R.san(s,m)};});
T('P04','promocja','Czarna promocja tworzy czarną figurę',()=>{let s=R.parseFen('4k3/8/8/8/8/8/p7/4K3 b - - 0 1');s=R.move(s,'a2a1r');return {pass:s.b[R.square('a1')]==='r',actual:s.b[R.square('a1')]};});
T('P05','promocja','Ruch na ostatnią linię bez litery promocji odrzucony',()=>{const s=R.parseFen('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');return {pass:R.move(s,'e7e8')===null,actual:R.move(s,'e7e8')};});
T('C01','szach/mat','Podwójny szach — wyłącznie ruch królem',()=>{const s=R.parseFen('4k3/8/8/8/1b6/8/4r3/4K3 w - - 0 1');const m=R.legal(s).map(uci);return {pass:R.check(s)&&m.length>0&&m.every(x=>x.startsWith('e1')),actual:m};});
T('C02','szach/mat','Mat szewczyka (białe wygrywają)',()=>{let s=R.initial();for(const u of ['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7'])s=R.move(s,u);return {pass:R.result([s])==='Mat — białe wygrywają',actual:R.result([s])};});
T('C03','szach/mat','Mat głupca (czarne wygrywają)',()=>{let s=R.initial();for(const u of ['f2f3','e7e5','g2g4','d8h4'])s=R.move(s,u);return {pass:R.result([s])==='Mat — czarne wygrywają',actual:R.result([s])};});
T('C04','pat','Pat — remis',()=>{const r=R.result([R.parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')]);return {pass:r==='Pat — remis',actual:r};});
T('D01','remis','K vs K — brak materiału',()=>{const r=R.result([R.parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1')]);return {pass:r==='Remis — brak materiału matującego',actual:r};});
T('D02','remis','K+S vs K — brak materiału',()=>{const r=R.result([R.parseFen('4k3/8/8/8/8/8/8/3NK3 w - - 0 1')]);return {pass:r.includes('brak materiału'),actual:r};});
T('D03','remis','K+G vs K+G jednopolowe — brak materiału',()=>{const r=R.result([R.parseFen('4k3/8/8/2b5/8/8/8/2B1K3 w - - 0 1')]);return {pass:r.includes('brak materiału'),actual:r};});
T('D04','remis','K+G vs K+G różnopolowe — gra trwa',()=>{const r=R.result([R.parseFen('4k3/8/8/3b4/8/8/8/2B1K3 w - - 0 1')]);return {pass:r==='',actual:r};});
T('D05','remis','K+S+S vs K — gra trwa (FIDE)',()=>{const r=R.result([R.parseFen('4k3/8/8/8/8/8/8/2NNK3 w - - 0 1')]);return {pass:r==='',actual:r};});
T('D06','remis','K+P vs K — gra trwa',()=>{const r=R.result([R.parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')]);return {pass:r==='',actual:r};});
T('D07','remis','50 ruchów: zgłaszalne przy half=100, nie automatyczne',()=>{const s=R.parseFen('4k3/8/8/8/8/8/8/R3K3 w - - 100 80');return {pass:R.claimableDraw(s,[])==='50_RUCHOW'&&R.result([s])==='',actual:{claim:R.claimableDraw(s,[]),auto:R.result([s])}};});
T('D08','remis','50 ruchów: half=99 niezgłaszalne',()=>{const s=R.parseFen('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');return {pass:R.claimableDraw(s,[])==='',actual:R.claimableDraw(s,[])};});
T('D09','remis','75 ruchów: remis automatyczny przy half=150',()=>{const r=R.result([R.parseFen('4k3/8/8/8/8/8/8/R3K3 w - - 150 100')]);return {pass:r==='Remis — 75 ruchów',actual:r};});
T('D10','remis','Mat ma pierwszeństwo przed regułą 75 ruchów',()=>{const r=R.result([R.parseFen('R5k1/5ppp/8/8/8/8/8/6K1 b - - 150 100')]);return {pass:r.startsWith('Mat'),actual:r};});
function play(list,state=initialChessMatch()){for(const u of list){const r=playChessMatch(state,state.turn,{uci:u});if(r.error)return {error:r.error,at:u,state};state=r.state;}return {state};}
const cycle=['g1f3','g8f6','f3g1','f6g8'];
T('D11','remis','3-krotne powtórzenie zgłaszalne po 2 cyklach',()=>{const {state}=play([...cycle,...cycle]);return {pass:R.claimableDraw(st2s(state),state.positions)==='TRZYKROTNE_POWTORZENIE'&&state.winner===0,actual:{claim:R.claimableDraw(st2s(state),state.positions),winner:state.winner}};});
T('D12','remis','Po 1 cyklu zgłoszenie odrzucone',()=>{const {state}=play(cycle);const r=playChessMatch(state,state.turn,{claimDraw:true});return {pass:r.error==='REMIS_NIEDOSTEPNY',actual:r.error||r.state?.winner};});
T('D13','remis','Zgłoszenie remisu (serwer) → winner=3 + drawReason',()=>{const {state}=play([...cycle,...cycle]);const r=playChessMatch(state,state.turn,{claimDraw:true});return {pass:r.state?.winner===3&&r.state?.drawReason==='TRZYKROTNE_POWTORZENIE',actual:r.state?{winner:r.state.winner,reason:r.state.drawReason}:r.error};});
T('D14','remis','Zgłoszenie przez gracza nie na ruchu → odrzucone',()=>{const {state}=play([...cycle,...cycle]);const r=playChessMatch(state,state.turn===1?2:1,{claimDraw:true});return {pass:r.error==='NIE_TWOJA_TURA',actual:r.error};});
T('D15','remis','5-krotne powtórzenie → remis automatyczny',()=>{const {state}=play([...cycle,...cycle,...cycle,...cycle]);return {pass:state.winner===3,actual:{winner:state.winner,moves:state.moves}};});
T('D16','remis','4-krotne powtórzenie → partia trwa',()=>{const {state}=play([...cycle,...cycle,...cycle]);return {pass:state.winner===0,actual:state.winner};});
T('D17','remis','Pozycje z różnymi prawami roszady są różne',()=>{const {state}=play(['e2e4','e7e5','e1e2','e8e7','e2e1','e7e8','e1e2','e8e7','e2e1','e7e8']);return {pass:R.claimableDraw(st2s(state),state.positions)==='',actual:{claim:R.claimableDraw(st2s(state),state.positions),c:state.c}};});
T('M01','stan','Po 1.e4: tura czarnych, ep=e3, half=0, full=1, SAN e4',()=>{const {state}=play(['e2e4']);return {pass:state.turn===2&&R.coord(state.ep)==='e3'&&state.half===0&&state.full===1&&state.history[0].san==='e4'&&state.moves===1,actual:{turn:state.turn,ep:state.ep,half:state.half,full:state.full}};});
T('M02','stan','Po 1.e4 e5 2.Sf3: half=1, full=2, ep=-1',()=>{const {state}=play(['e2e4','e7e5','g1f3']);return {pass:state.half===1&&state.full===2&&state.ep===-1,actual:{half:state.half,full:state.full,ep:state.ep}};});
T('M03','stan','Ruch figurą przeciwnika → odrzucony',()=>{const r=playChessMatch(initialChessMatch(),1,{uci:'e7e5'});return {pass:r.error==='NIEDOZWOLONY_RUCH',actual:r.error};});
T('M04','stan','Ruch w imieniu przeciwnika → NIE_TWOJA_TURA',()=>{const r=playChessMatch(initialChessMatch(),2,{uci:'e2e4'});return {pass:r.error==='NIE_TWOJA_TURA',actual:r.error};});
T('M05','stan','Ruch po macie → PARTIA_ZAKONCZONA',()=>{const {state}=play(['f2f3','e7e5','g2g4','d8h4']);const r=playChessMatch(state,1,{uci:'a2a3'});return {pass:state.winner===2&&r.error==='PARTIA_ZAKONCZONA',actual:{winner:state.winner,err:r.error}};});
T('M06','stan','Złośliwe dane (obiekt, długi tekst, SQL, wielkie litery, null) → odrzucone',()=>{const s=initialChessMatch();const bad=[{uci:{}},{uci:'e2e4'.repeat(100)},{uci:"e2e4'; DROP"},{uci:'e2e9'},{},null,{uci:'E2E4'},{uci:['e2e4']}];const errs=bad.map(b=>playChessMatch(s,1,b).error);return {pass:errs.every(e=>e==='NIEDOZWOLONY_RUCH'),actual:errs};});
T('M07','stan','Uszkodzony stan (dwa białe króle) → NIEPRAWIDLOWY_STAN',()=>{const s=initialChessMatch();s.board=s.board.slice();s.board[R.square('d1')]='K';const r=playChessMatch(s,1,{uci:'e2e4'});return {pass:r.error==='NIEPRAWIDLOWY_STAN',actual:r.error};});
T('M08','stan','Pat w partii online → winner=3',()=>{const r=playChessMatch(fromFen('7k/8/5QK1/8/8/8/8/8 w - - 0 1'),1,{uci:'f6f7'});return {pass:r.state?.winner===3,actual:r.state?.winner??r.error};});
T('M09','stan','K vs K po biciu (online) → winner=3',()=>{const r=playChessMatch(fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1'),1,{uci:'e1e2'});return {pass:r.state?.winner===3,actual:r.state?.winner??r.error};});
T('M10','stan','Mat (online) → winner = gracz matujący',()=>{const {state}=play(['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7']);return {pass:state.winner===1&&state.history.at(-1).san==='Qxf7#',actual:{winner:state.winner,san:state.history.at(-1).san}};});
T('U01','cofanie','Cofnięcie własnego ostatniego ruchu',()=>{const {state}=play(['e2e4','e7e5','g1f3']);const r=undoLastChessMove(state,1);const ref=play(['e2e4','e7e5']).state;return {pass:!r.error&&JSON.stringify(r.state.board)===JSON.stringify(ref.board)&&r.state.turn===1&&r.state.moves===2&&r.state.history.length===2&&r.state.positions.length===3,actual:r.error||{turn:r.state.turn,moves:r.state.moves}};});
T('U02','cofanie','Cofnięcie ruchu przeciwnika → odrzucone',()=>{const {state}=play(['e2e4','e7e5']);const r=undoLastChessMove(state,1);return {pass:r.error==='BRAK_RUCHU_DO_COFNIECIA',actual:r.error};});
T('U03','cofanie','Cofnięcie roszady przywraca prawa roszady',()=>{const {state}=play(['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','e1g1']);const r=undoLastChessMove(state,1);return {pass:!r.error&&r.state.c===15,actual:r.error||r.state.c};});
T('U04','cofanie','Cofnięcie po zakończeniu partii → odrzucone',()=>{const {state}=play(['f2f3','e7e5','g2g4','d8h4']);const r=undoLastChessMove(state,2);return {pass:!!r.error,actual:r.error};});
T('H01','historia','Partia >300 półruchów: przycinanie historii — skutki',()=>{
 for(let seed=1;seed<300;seed++){let x=(seed*2654435761)>>>0;const rnd=()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};
  let st=initialChessMatch();const ucis=[];
  while(st.moves<330&&st.winner===0){const lm=R.legal(st2s(st));let ok=null;
   for(let k=0;k<20&&!ok;k++){const m=lm[Math.floor(rnd()*lm.length)];const r=playChessMatch(st,st.turn,{uci:uci(m)});if(!r.error&&(r.state.winner===0||k===19))ok=r;}
   st=ok.state;ucis.push(st.history.at(-1).uci);}
  if(st.moves>=330&&st.winner===0){fs.writeFileSync(new URL('./evidence/long-game.json',import.meta.url),JSON.stringify({ucis,state:st}));
   const undo=undoLastChessMove(st,st.history.at(-1).player);
   return {pass:true,actual:{seed,moves:st.moves,historyLen:st.history.length,firstHistoryNumber:st.history[0].number,positions:st.positions.length,undoAfter300:undo.error||'ok',stateJsonBytes:JSON.stringify(st).length}};}
 }
 return {pass:false,actual:'no long game generated'};});
const pass=results.filter(r=>r.pass).length;
console.log(JSON.stringify({pass,fail:results.length-pass,results},null,1));
