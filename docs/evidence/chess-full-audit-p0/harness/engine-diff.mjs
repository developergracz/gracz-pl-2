// AUDIT ONLY (scratchpad). Independent verification of contact-api/auth/chess-rules.mjs
// against (a) published perft numbers and (b) chess.js 1.4.0 used only in this test.
import {createRequire} from 'node:module';
import * as R from '/home/user/gracz-pl-2/contact-api/auth/chess-rules.mjs';
const require=createRequire('/tmp/claude-0/-home-user-gracz-pl-2/5ebe096a-3fdb-538f-943d-787ce15a7917/scratchpad/audit/ref/');
const {Chess}=require('chess.js');

const out={perft:[],diff:{},issues:[]};
const uci=m=>R.coord(m[0])+R.coord(m[1])+m[2];
function fen(s){
 let rows=[];
 for(let r=0;r<8;r++){let row='',e=0;for(let c=0;c<8;c++){const p=s.b[r*16+c];if(p==='.')e++;else{if(e)row+=e;e=0;row+=p;}}if(e)row+=e;rows.push(row);}
 const cast=((s.c&1)?'K':'')+((s.c&2)?'Q':'')+((s.c&4)?'k':'')+((s.c&8)?'q':'')||'-';
 return rows.join('/')+' '+(s.t===1?'w':'b')+' '+cast+' '+(s.ep>=0?R.coord(s.ep):'-')+' '+s.half+' '+s.full;
}
function perft(s,d){if(d===0)return 1;const ms=R.legal(s);if(d===1)return ms.length;let n=0;for(const m of ms)n+=perft(R.apply(s,m),d-1);return n;}
// Published reference values (chessprogramming.org "Perft Results").
const suites=[
 ['startpos','rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',[20,400,8902,197281,4865609]],
 ['kiwipete','r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039,97862,4085603]],
 ['pos3','8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812,43238,674624]],
 ['pos4','r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467,422333]],
 ['pos4m','r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1',[6,264,9467,422333]],
 ['pos5','rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486,62379,2103487]],
 ['pos6','r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',[46,2079,89890,3894594]],
];
const maxDepth=Number(process.env.PERFT_DEPTH||4);
for(const [name,f,exp] of suites){
 const s=R.parseFen(f);
 for(let d=1;d<=Math.min(maxDepth,exp.length);d++){
  const t=Date.now(),n=perft(s,d);
  out.perft.push({name,depth:d,expected:exp[d-1],got:n,pass:n===exp[d-1],ms:Date.now()-t});
 }
}
// Differential random games. Deterministic PRNG so every failure is reproducible.
let seed=Number(process.env.SEED||20261116);
const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const N=Number(process.env.GAMES||400);
const stats={games:N,positions:0,moveSetMismatch:0,sanMismatch:0,fenMismatch:0,statusMismatch:0,insufficientMismatch:0,threefoldMismatch:0,fiftyMismatch:0,promotions:0,ep:0,castles:0,checks:0,mates:0,stalemates:0,insufficient:0};
function record(kind,detail){if(out.issues.filter(x=>x.kind===kind).length<5)out.issues.push({kind,...detail});}
for(let g=0;g<N;g++){
 const ref=new Chess();let s=R.initial();const keys=[R.key(s)];const sans=[];
 for(let ply=0;ply<400;ply++){
  stats.positions++;
  const mine=R.legal(s).map(uci).sort();
  const theirs=ref.moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')).sort();
  if(mine.join()!==theirs.join()){stats.moveSetMismatch++;record('moveset',{fen:ref.fen(),mine:mine.filter(x=>!theirs.includes(x)),theirs:theirs.filter(x=>!mine.includes(x)),moves:sans.join(' ')});}
  // FEN: chess.js >=1.0 prints the ep square only when an ep capture is legal; compare the rest exactly.
  const a=fen(s).split(' '),b=ref.fen().split(' ');
  const epOk=a[3]===b[3]||(b[3]==='-'&&!R.legal(s).some(m=>m[3]==='ep'));
  if(a[0]!==b[0]||a[1]!==b[1]||a[2]!==b[2]||!epOk||a[4]!==b[4]||a[5]!==b[5]){stats.fenMismatch++;record('fen',{mine:fen(s),theirs:ref.fen(),moves:sans.join(' ')});}
  const inCheck=R.check(s),res=R.result([s]);
  if(inCheck)stats.checks++;
  if(inCheck!==ref.inCheck()||(res.startsWith('Mat')!==ref.isCheckmate())||(res.startsWith('Pat')!==ref.isStalemate())){stats.statusMismatch++;record('status',{fen:ref.fen(),mine:{inCheck,res},theirs:{check:ref.inCheck(),mate:ref.isCheckmate(),stalemate:ref.isStalemate()}});}
  const mineIns=res==='Remis — brak materiału matującego';
  if(!res.startsWith('Mat')&&!res.startsWith('Pat')&&mineIns!==ref.isInsufficientMaterial()){stats.insufficientMismatch++;record('insufficient',{fen:ref.fen(),mine:mineIns,theirs:ref.isInsufficientMaterial()});}
  const claim=R.claimableDraw(s,keys);
  if((claim==='TRZYKROTNE_POWTORZENIE')!==ref.isThreefoldRepetition()&&!(claim==='50_RUCHOW'&&ref.isThreefoldRepetition()&&keys.filter(k=>k===R.key(s)).length>=3)){stats.threefoldMismatch++;record('threefold',{fen:ref.fen(),mine:claim,theirs:ref.isThreefoldRepetition(),moves:sans.join(' ')});}
  if((s.half>=100)!==ref.isDrawByFiftyMoves()){stats.fiftyMismatch++;record('fifty',{fen:ref.fen()});}
  if(res){if(res.startsWith('Mat'))stats.mates++;else if(res.startsWith('Pat'))stats.stalemates++;else if(mineIns)stats.insufficient++;break;}
  const legalMoves=R.legal(s);if(!legalMoves.length)break;
  // Bias towards special moves so they are exercised often.
  const special=legalMoves.filter(m=>m[2]||m[3]);
  const m=special.length&&rnd()<0.5?special[Math.floor(rnd()*special.length)]:legalMoves[Math.floor(rnd()*legalMoves.length)];
  if(m[2])stats.promotions++;if(m[3]==='ep')stats.ep++;if(m[3]==='castle')stats.castles++;
  const mySan=R.san(s,m);
  const r=ref.move({from:R.coord(m[0]),to:R.coord(m[1]),promotion:m[2]||undefined});
  if(mySan!==r.san){stats.sanMismatch++;record('san',{fen:r.before,move:uci(m),mine:mySan,theirs:r.san});}
  sans.push(mySan);s=R.apply(s,m);keys.push(R.key(s));
 }
}
out.diff=stats;
console.log(JSON.stringify(out,null,1));
