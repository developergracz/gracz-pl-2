// AUDIT ONLY. Computer opponent (contact-api/auth/chess-computer.mjs) — legality, latency, strength.
// UI mapping (served app.js): select value normal/hard/expert/master -> engine beginner/normal/hard/master,
// maxMs 450 except master 750.
import * as R from '/home/user/gracz-pl-2/contact-api/auth/chess-rules.mjs';
import {chooseComputerMove} from '/home/user/gracz-pl-2/contact-api/auth/chess-computer.mjs';
const UI=[['normal','beginner',450,'Początkujący'],['hard','normal',450,'Normalny (domyślny)'],['expert','hard',450,'Zaawansowany'],['master','master',750,'Najmocniejszy lokalny']];
const uci=m=>m&&(R.coord(m[0])+R.coord(m[1])+m[2]);
let x=987654321;const rnd=()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};
const mode=process.argv[2]||'quick';
const out={mode};
// sample positions from random games
const sample=[];
while(sample.length<60){let s=R.initial();const plies=10+Math.floor(rnd()*50);let ok=true;for(let i=0;i<plies;i++){const lm=R.legal(s);if(!lm.length||R.result([s])){ok=false;break;}s=R.apply(s,lm[Math.floor(rnd()*lm.length)]);}if(ok&&R.legal(s).length&&!R.result([s]))sample.push(s);}
if(mode==='quick'){
 out.levels=[];
 for(const [ui,engine,maxMs,label] of UI){
  const times=[];let illegal=0,nulls=0,budgetHit=0;
  for(const s of sample){const t=performance.now();const m=chooseComputerMove(s,{level:engine,maxMs});const dt=performance.now()-t;times.push(dt);
   if(!m)nulls++;else if(!R.legal(s).some(y=>uci(y)===uci(m)))illegal++;if(dt>=maxMs-5)budgetHit++;}
  times.sort((a,b)=>a-b);
  out.levels.push({ui,engine,label,maxMs,positions:sample.length,illegal,nulls,budgetHitPct:Math.round(budgetHit/sample.length*100),
   p50:Math.round(times[Math.floor(times.length*.5)]),p95:Math.round(times[Math.floor(times.length*.95)]),max:Math.round(times.at(-1))});
 }
 // terminal positions
 const mate=R.parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),mated=R.parseFen('6Qk/8/6K1/8/8/8/8/8 b - - 0 1');
 out.terminal={stalemateReturns:chooseComputerMove(mate,{level:'master'}),mateReturns:chooseComputerMove(mated,{level:'master'}),badInput:chooseComputerMove(null),badTurn:chooseComputerMove({b:[],t:0})};
 // tactics
 const puzzles=[
  ['mate-in-1 (Qg7#)','6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1',null,'mate1'],
  ['mate-in-1 black back rank','3r2k1/8/8/8/8/8/5PPP/6K1 b - - 0 1','d8d1','exact'],
  ['free queen capture','4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1','d1d5','exact'],
  ['avoid hanging queen (only safe retreats)','4k3/8/8/8/3r4/8/3Q4/4K3 w - - 0 1',null,'notloseQ'],
  ['promotion','8/P6k/8/8/8/8/8/K7 w - - 0 1','a7a8q','exact'],
  ['escape check','4k3/8/8/8/8/8/4r3/4K3 w - - 0 1','e1e2','exact'],
  ['mate-in-2 (Qd8+ Rxd8 Rxd8#)','2r3k1/5ppp/8/8/8/8/5PPP/3QR1K1 w - - 0 1',null,'mate2'],
  ['fork knight (Nc7+ wins rook)','r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1','b5c7','exact'],
 ];
 out.tactics=[];
 for(const [name,fen,expect,kind] of puzzles){
  const row={name,fen};
  for(const [ui,engine,maxMs] of UI){
   const s=R.parseFen(fen),m=chooseComputerMove(s,{level:engine,maxMs});let ok;
   if(kind==='exact')ok=uci(m)===expect;
   else if(kind==='mate1'){const n=R.apply(s,m);ok=R.result([n]).startsWith('Mat');}
   else if(kind==='mate2'){const n=R.apply(s,m);ok=R.check(n)&&R.legal(n).every(r=>{const a=R.apply(n,r);return R.legal(a).some(w=>R.result([R.apply(a,w)]).startsWith('Mat'));});}
   else if(kind==='notloseQ'){const n=R.apply(s,m);ok=!R.legal(n).some(r=>n.b[r[1]]==='Q')||R.legal(n).every(r=>n.b[r[1]]!=='Q'||false);}
   row[ui]=(ok?'OK ':'MISS ')+uci(m);
  }
  out.tactics.push(row);
 }
}
if(mode==='match'){
 // Small tournament at real UI budgets. Random 4-ply openings, 200 ply cap, adjudication by result().
 const playGame=(white,black,seedOpen)=>{
  let s=R.initial();const keys=[R.key(s)];x=seedOpen;
  for(let i=0;i<4;i++){const lm=R.legal(s);s=R.apply(s,lm[Math.floor(rnd()*lm.length)]);keys.push(R.key(s));}
  const states=[s];
  for(let ply=0;ply<200;ply++){
   const r=R.result([s]);const reps=keys.filter(k=>k===R.key(s)).length;
   if(r)return r.startsWith('Mat')?(r.includes('białe')?'1-0':'0-1'):'1/2 '+r;
   if(reps>=3)return '1/2 3-fold';
   if(s.half>=100)return '1/2 50-move';
   const side=s.t===1?white:black;let m;
   if(side==='random'){const lm=R.legal(s);m=lm[Math.floor(rnd()*lm.length)];}
   else{const u=UI.find(u=>u[1]===side);m=chooseComputerMove(s,{level:side,maxMs:u[2]});}
   s=R.apply(s,m);keys.push(R.key(s));
  }
  return '* cap';
 };
 const pairs=[['beginner','random'],['master','random'],['normal','beginner'],['hard','normal'],['master','hard'],['master','beginner']];
 out.games=[];
 for(const [a,b] of pairs){for(let g=0;g<2;g++){const t=Date.now();const w=g?b:a,bl=g?a:b;const r=playGame(w,bl,1000+g*7+a.length*13+b.length);out.games.push({white:w,black:bl,result:r,sec:Math.round((Date.now()-t)/1000)});console.error(JSON.stringify(out.games.at(-1)));}}
}
console.log(JSON.stringify(out,null,1));
