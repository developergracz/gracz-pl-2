// Deterministic, bounded computer opponent. Uses the same legal rules as the server.
// This is a lightweight local engine, not Stockfish or grandmaster-strength AI.
import {legal,apply,check} from './chess-rules.mjs';
const values={p:100,n:320,b:330,r:500,q:900,k:0};
function score(state){
 let value=0;
 for(let i=0;i<128;i++){
  if(i&0x88){i=(i|7);continue;}
  const p=state.b[i];if(p==='.')continue;
  const own=p===p.toUpperCase()?1:-1,type=p.toLowerCase();
  const col=i&7,row=i>>4,center=(3.5-Math.abs(col-3.5))+(3.5-Math.abs(row-3.5));
  let v=values[type];
  if(type==='p')v+=own===1?(6-row)*8:(row-1)*8;
  if(type==='n'||type==='b')v+=center*7;
  if(type==='k'&&state.full<25)v-=center*3;
  value+=own*v;
 }
 return value;
}
function movePriority(s,m){
 const victim=s.b[m[1]];const attacker=s.b[m[0]];
 return (victim==='.'?0:10*(values[victim.toLowerCase()]||0)-(values[attacker.toLowerCase()]||0))+(m[2]?800:0)+(m[3]==='castle'?20:0);
}
export function chooseComputerMove(state,{level='normal',maxMs=650}={}){
 if(!state||!Array.isArray(state.b)||![1,-1].includes(state.t))return null;
 const candidates=legal(state);if(!candidates.length)return null;
 const caps=Math.max(100,Math.min(1300,Number(maxMs)||650));
 const deadline=Date.now()+caps;
 const maximum={beginner:1,normal:2,hard:3,master:4}[level]||2;
 let best=candidates[0],completed=false,nodes=0;
 const ordered=(s,moves)=>moves.sort((a,b)=>movePriority(s,b)-movePriority(s,a));
 const terminal=(s,moves,ply)=>moves.length?null:check(s)?-100000+ply:0;
 function search(s,depth,alpha,beta,ply){
  if(++nodes%32===0&&Date.now()>deadline)throw Error('TIME_BUDGET');
  const moves=legal(s),end=terminal(s,moves,ply);
  if(end!==null)return end;
  if(!depth)return score(s)*s.t;
  let value=-Infinity;
  for(const m of ordered(s,moves)){
   const v=-search(apply(s,m),depth-1,-beta,-alpha,ply+1);
   if(v>value)value=v;
   if(v>alpha)alpha=v;
   if(alpha>=beta)break;
  }
  return value;
 }
 for(let depth=1;depth<=maximum;depth++){
  let highest=-Infinity,next=best;
  try{
   for(const m of ordered(state,candidates.slice())){
    if(Date.now()>deadline)throw Error('TIME_BUDGET');
    const v=-search(apply(state,m),depth-1,-Infinity,-highest,1);
    if(v>highest){highest=v;next=m;}
   }
   best=next;completed=true;
  }catch(e){if(e.message!=='TIME_BUDGET')throw e;break;}
 }
 return best;
}
