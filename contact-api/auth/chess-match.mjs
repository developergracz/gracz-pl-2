import {initial,legal,apply,san,coord,result,key,check} from './chess-rules.mjs';
// Chess multiplayer adapter. Match state is always produced by trusted server code.
export function initialChessMatch(){
 const s=initial();
 return {board:s.b,turn:1,c:s.c,ep:s.ep,half:s.half,full:s.full,
   moves:0,winner:0,history:[],positions:[key(s)]};
}
function unpack(state){
 if(!state||!Array.isArray(state.board)||state.board.length!==128||
    !state.board.every(p=>typeof p==='string'&&(/^[.pnbrqkPNBRQK]$/.test(p)))||
    ![1,2].includes(state.turn)||!Number.isInteger(state.c)||state.c<0||state.c>15||
    !Number.isInteger(state.ep)||state.ep< -1||state.ep>=128||
    !Number.isSafeInteger(state.half)||state.half<0||
    !Number.isSafeInteger(state.full)||state.full<1||
    !Number.isSafeInteger(state.moves)||state.moves<0||
    ![0,1,2,3].includes(state.winner))return null;
 const s={b:state.board,t:state.turn===1?1:-1,c:state.c,ep:state.ep,half:state.half,full:state.full};
 if(s.b.filter(p=>p==='K').length!==1||s.b.filter(p=>p==='k').length!==1)return null;
 return s;
}
export function playChessMatch(state,player,request){
 const before=unpack(state);
 if(!before)return {error:'NIEPRAWIDLOWY_STAN'};
 if(state.winner!==0)return {error:'PARTIA_ZAKONCZONA'};
 if(player!==state.turn)return {error:'NIE_TWOJA_TURA'};
 const uci=request?.uci;
 if(typeof uci!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))
   return {error:'NIEDOZWOLONY_RUCH'};
 const move=legal(before).find(m=>coord(m[0])+coord(m[1])+m[2]===uci);
 if(!move)return {error:'NIEDOZWOLONY_RUCH'};
 const after=apply(before,move),notation=san(before,move);
 const positions=[...(Array.isArray(state.positions)?state.positions:[]),key(after)].slice(-300);
 const next={...state,board:after.b,turn:after.t===1?1:2,c:after.c,ep:after.ep,
  half:after.half,full:after.full,moves:state.moves+1,
  history:[...(Array.isArray(state.history)?state.history:[]).slice(-299),{player,uci,san:notation,number:state.moves+1}],
  positions};
 const dead=result([after]);
 const repetitions=positions.filter(x=>x===key(after)).length;
 if(dead.startsWith('Mat'))next.winner=player;
 else if(dead||repetitions>=5)next.winner=3;
 return {state:next};
}
