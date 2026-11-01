// Server-authoritative, deterministic two-player board engines. No browser-submitted board state.
const inBounds=(r,c,n)=>r>=0&&c>=0&&r<n&&c<n;
const index=(r,c,n)=>r*n+c;
const coords=(p,n)=>[Math.floor(p/n),p%n];
const side=x=>x===1||x===3?1:x===2||x===4?2:0;
const dirs=[[-1,-1],[-1,1],[1,-1],[1,1]];

export function initialGame(game){
 if(game==='gomoku')return {board:Array(225).fill(0),turn:1,winner:0,moves:0};
 if(game==='warcaby'){
  const board=Array(64).fill(0);
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
   if((r+c)%2!==1)continue;
   if(r<3)board[index(r,c,8)]=1;
   if(r>4)board[index(r,c,8)]=2;
  }
  return {board,turn:1,winner:0,moves:0,forced:null,quiet:0};
 }
 throw Error('UNKNOWN_GAME');
}
export function legalCaptures(board,turn,from){
 const [r,c]=coords(from,8),piece=board[from];
 if(side(piece)!==turn)return [];
 const results=[];
 for(const [dr,dc] of dirs){
  const nr=r+dr*2,nc=c+dc*2;
  if(!inBounds(nr,nc,8)||!inBounds(r+dr,c+dc,8))continue;
  const mid=index(r+dr,c+dc,8),target=index(nr,nc,8);
  if(board[target]===0&&side(board[mid])===3-turn)
   results.push({from,to:target,taken:mid});
 }
 return results;
}
function hasCapture(board,turn){
 return board.some((piece,i)=>side(piece)===turn&&legalCaptures(board,turn,i).length>0);
}
function canMove(board,turn){
 if(hasCapture(board,turn))return true;
 for(let i=0;i<64;i++)if(side(board[i])===turn){
  const [r,c]=coords(i,8),piece=board[i];
  for(const [dr,dc] of dirs){
   if(piece<=2&&dr!==(turn===1?1:-1))continue;
   const nr=r+dr,nc=c+dc;
   if(inBounds(nr,nc,8)&&board[index(nr,nc,8)]===0)return true;
  }
 }
 return false;
}
function playGomoku(state,move){
 const to=move?.to;
 if(!Number.isInteger(to)||to<0||to>=225||state.board[to]!==0)
  return {error:'NIEDOZWOLONY_RUCH'};
 const board=state.board.slice();board[to]=state.turn;
 const [r,c]=coords(to,15);
 let won=false;
 for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
  let total=1;
  for(const direction of [-1,1]){
   for(let k=1;k<=4;k++){
    const rr=r+dr*k*direction,cc=c+dc*k*direction;
    if(!inBounds(rr,cc,15)||board[index(rr,cc,15)]!==state.turn)break;
    total++;
   }
  }
  if(total>=5){won=true;break;}
 }
 const moves=state.moves+1;
 const winner=won?state.turn:moves===225?3:0;
 return {state:{board,turn:winner?state.turn:3-state.turn,winner,moves}};
}
function playWarcaby(state,move){
 const from=move?.from,to=move?.to,board=state.board;
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=64||to<0||to>=64||
  board[to]!==0||side(board[from])!==state.turn||(state.forced!==null&&state.forced!==from))
  return {error:'NIEDOZWOLONY_RUCH'};
 const [r,c]=coords(from,8),[nr,nc]=coords(to,8),dr=nr-r,dc=nc-c;
 if(Math.abs(dr)!==Math.abs(dc)||!inBounds(nr,nc,8))return {error:'NIEDOZWOLONY_RUCH'};
 const piece=board[from],jump=Math.abs(dr)===2;
 if(state.forced!==null&&!jump)return {error:'BICIE_OBOWIAZKOWE'};
 const capture=legalCaptures(board,state.turn,from).find(x=>x.to===to);
 const mustCapture=state.forced!==null||hasCapture(board,state.turn);
 if(jump&&!capture)return {error:'NIEDOZWOLONY_RUCH'};
 if(!jump){
  if(Math.abs(dr)!==1||(piece<=2&&dr!==(state.turn===1?1:-1)))
   return {error:'NIEDOZWOLONY_RUCH'};
  if(mustCapture)return {error:'BICIE_OBOWIAZKOWE'};
 }
 const next=board.slice();next[from]=0;next[to]=piece;
 if(jump)next[capture.taken]=0;
 const promote=(piece===1&&nr===7)||(piece===2&&nr===0);
 if(promote)next[to]=state.turn===1?3:4;
 // Rule variant: short kings; crowning finishes the current turn.
 const continued=jump&&!promote&&legalCaptures(next,state.turn,to).length>0;
 const turn=continued?state.turn:3-state.turn;
 const forced=continued?to:null;
 const quiet=jump||promote?0:state.quiet+1;
 const moves=state.moves+1;
 const winner=quiet>=80?3:!continued&&!canMove(next,turn)?state.turn:0;
 return {state:{board:next,turn:winner?state.turn:turn,winner,moves,forced,quiet}};
}
export function playMove(game,state,player,move){
 const expected=game==='gomoku'?225:game==='warcaby'?64:0;
 if(!expected||!state||!Array.isArray(state.board)||state.board.length!==expected||
  ![1,2].includes(state.turn)||![0,1,2,3].includes(state.winner)||
  !Number.isInteger(state.moves)||state.moves<0)return {error:'NIEPRAWIDLOWY_STAN'};
 if(state.winner!==0)return {error:'PARTIA_ZAKONCZONA'};
 if(player!==state.turn)return {error:'NIE_TWOJA_TURA'};
 return game==='gomoku'?playGomoku(state,move):playWarcaby(state,move);
}
