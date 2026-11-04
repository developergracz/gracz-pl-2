// Lightweight local Warcaby opponent. Uses exactly the same rules module as online games.
// No account APIs or server-side bot workers are required.
import {initialGame, playMove, legalCaptures} from './game-engine.mjs';
export {initialGame, playMove, legalCaptures};

const side=piece=>(piece===1||piece===3)?1:(piece===2||piece===4)?2:0;
const diagonals=[[-1,-1],[-1,1],[1,-1],[1,1]];
const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const countPieces=(board,player)=>board.filter(p=>side(p)===player).length;

export function legalMoves(state){
 if(!state||state.winner||!Array.isArray(state.board)||state.board.length!==64)return [];
 const board=state.board,turn=state.turn,forced=state.forced??null;
 const starts=forced!==null?[forced]:board.map((p,i)=>side(p)===turn?i:-1).filter(i=>i>=0);
 const captures=starts.flatMap(from=>legalCaptures(board,turn,from).map(({to,taken})=>({from,to,taken})));
 if(captures.length||forced!==null)return captures;
 const moves=[];
 for(const from of starts){
  const piece=board[from],r=Math.floor(from/8),c=from%8;
  for(const [dr,dc] of diagonals){
   if(piece<=2&&dr!==(turn===1?1:-1))continue;
   let row=r+dr,col=c+dc;
   while(inside(row,col)&&board[row*8+col]===0){
    moves.push({from,to:row*8+col});
    if(piece<=2)break;
    row+=dr;col+=dc;
   }
  }
 }
 return moves;
}

export function evaluate(state,computer=2){
 if(state.winner===computer)return 100000;
 if(state.winner===3-computer)return -100000;
 if(state.winner===3)return 0;
 let result=0;
 for(let i=0;i<64;i++){
  const piece=state.board[i],player=side(piece);
  if(!player)continue;
  const row=Math.floor(i/8),col=i%8;
  const king=piece>=3;
  const advancement=king?0:(player===1?row:7-row)*4;
  const center=3.5-Math.max(Math.abs(row-3.5),Math.abs(col-3.5));
  const value=(king?325:100)+advancement+center*2;
  result+=(player===computer?1:-1)*value;
 }
 // A very small preference for having material rather than delaying captures.
 result+=(countPieces(state.board,computer)-countPieces(state.board,3-computer))*2;
 return result;
}

export function chooseComputerMove(state,level='normal',options={}){
 if(!state||state.winner||state.turn!==2)return null;
 const top=legalMoves(state);
 if(!top.length)return null;
 const depths={normal:1,hard:2,expert:3,master:5};
 const budgets={normal:800,hard:2500,expert:7000,master:17000};
 const depth=depths[level]??1;
 const maxNodes=Math.max(200,Math.min(20000,Number(options.maxNodes)||budgets[level]||800));
 const deadline=Date.now()+Math.max(30,Math.min(800,Number(options.maxMs)||450));
 let visited=0;
 const ordered=(moves,node)=>moves.slice().sort((a,b)=>{
  const rank=m=>(m.taken!==undefined?100:0)+(node.board[m.from]>=3?7:0);
  return rank(b)-rank(a)||a.from-b.from||a.to-b.to;
 });
 function search(node,remaining,alpha,beta){
  visited++;
  if(!remaining||node.winner||visited>=maxNodes||Date.now()>deadline)return evaluate(node,2);
  const legal=legalMoves(node);
  if(!legal.length)return node.turn===2?-100000:100000;
  const maximize=node.turn===2;
  let best=maximize?-Infinity:Infinity;
  for(const move of ordered(legal,node)){
   const applied=playMove('warcaby',node,node.turn,move);
   if(applied.error)continue;
   const score=search(applied.state,remaining-1,alpha,beta);
   best=maximize?Math.max(best,score):Math.min(best,score);
   if(maximize)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
   if(beta<=alpha||visited>=maxNodes||Date.now()>deadline)break;
  }
  return Number.isFinite(best)?best:evaluate(node,2);
 }
 let best=null,bestScore=-Infinity;
 for(const move of ordered(top,state)){
  const applied=playMove('warcaby',state,2,move);
  if(applied.error)continue;
  const score=search(applied.state,depth-1,-Infinity,Infinity);
  if(score>bestScore){bestScore=score;best=move}
  if(visited>=maxNodes||Date.now()>deadline)break;
 }
 return best||top[0];
}
