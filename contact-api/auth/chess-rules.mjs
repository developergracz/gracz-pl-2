// Chess rules v1: deterministic, no network or account state. 0x88 board.
export const START_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const dirs={n:[-33,-31,-18,-14,14,18,31,33],b:[-17,-15,15,17],r:[-16,-1,1,16],k:[-17,-16,-15,-1,1,15,16,17]};
const active=i=>i>=0&&i<128&&!(i&0x88);
const color=p=>p==='.'?0:p===p.toUpperCase()?1:-1;
export const coord=i=>'abcdefgh'[i&7]+(8-(i>>4));
export const square=s=>/^[a-h][1-8]$/.test(s)?(8-Number(s[1]))*16+'abcdefgh'.indexOf(s[0]):-1;
export function parseFen(fen=START_FEN){
 const [placement,turn,castling,ep,half,full]=fen.split(' ');
 if(!placement||!/^[wb]$/.test(turn)||!/^(?:-|K?Q?k?q?)$/.test(castling)||!/^(?:-|[a-h][36])$/.test(ep)||!/^\d+$/.test(half)||!/^[1-9]\d*$/.test(full))throw Error('INVALID_FEN');
 const b=Array(128).fill('.'),rows=placement.split('/');
 if(rows.length!==8)throw Error('INVALID_FEN');
 for(let r=0;r<8;r++){
  let c=0;
  for(const p of rows[r]){
   if(/^[1-8]$/.test(p))c+=Number(p);
   else{if(!/^[pnbrqkPNBRQK]$/.test(p)||c>=8)throw Error('INVALID_FEN');b[r*16+c++]=p;}
  }
  if(c!==8)throw Error('INVALID_FEN');
 }
 if(b.filter(x=>x==='K').length!==1||b.filter(x=>x==='k').length!==1)throw Error('INVALID_KINGS');
 return {b,t:turn==='w'?1:-1,c:(castling.includes('K')?1:0)|(castling.includes('Q')?2:0)|(castling.includes('k')?4:0)|(castling.includes('q')?8:0),ep:ep==='-'?-1:square(ep),half:Number(half),full:Number(full)};
}
export const initial=()=>parseFen();
export function attacked(s,target,by){
 for(let from=0;from<128;from++){
  if(!active(from)||color(s.b[from])!==by)continue;
  const piece=s.b[from].toLowerCase();
  if(piece==='p'){if(target===from-16*by-1||target===from-16*by+1)return true;continue;}
  for(const d of (dirs[piece]||[...dirs.b,...dirs.r])){
   for(let to=from+d;active(to);to+=d){
    if(to===target)return true;
    if(s.b[to]!=='.'||piece==='n'||piece==='k')break;
   }
  }
 }
 return false;
}
export const check=(s,by=s.t)=>attacked(s,s.b.indexOf(by===1?'K':'k'),-by);
export function apply(s,m){
 const [from,to,promotion,flag]=m,b=s.b.slice(),piece=b[from],captured=b[to];let c=s.c;
 b[from]='.';b[to]=promotion?(s.t===1?promotion.toUpperCase():promotion):piece;
 if(flag==='ep')b[to+16*s.t]='.';
 if(flag==='castle'){const rf=to>from?from+3:from-4,rt=to>from?from+1:from-1;b[rt]=b[rf];b[rf]='.';}
 if(piece==='K')c&=~3;if(piece==='k')c&=~12;
 const rooks={119:1,112:2,7:4,0:8};
 if(piece.toLowerCase()==='r')c&=~(rooks[from]||0);
 if(captured.toLowerCase()==='r')c&=~(rooks[to]||0);
 return {b,t:-s.t,c,ep:piece.toLowerCase()==='p'&&Math.abs(to-from)===32?(to+from)/2:-1,
 half:piece.toLowerCase()==='p'||captured!=='.'||flag==='ep'?0:s.half+1,full:s.full+(s.t===-1?1:0)};
}
export function legal(s){
 const out=[],turn=s.t;
 for(let from=0;from<128;from++){
  if(!active(from)||color(s.b[from])!==turn)continue;
  const p=s.b[from].toLowerCase();
  const add=(to,flag='')=>{
   if(s.b[to].toLowerCase()==='k')return;
   if(p==='p'&&((to>>4)===0||(to>>4)===7))for(const promote of ['q','r','b','n'])out.push([from,to,promote,flag]);
   else out.push([from,to,'',flag]);
  };
  if(p==='p'){
   const to=from-16*turn;
   if(active(to)&&s.b[to]==='.'){
    add(to);
    const two=to-16*turn;
    if((from>>4)===(turn===1?6:1)&&s.b[two]==='.')add(two);
   }
   for(const dx of [-1,1]){
    const t=to+dx;if(!active(t))continue;
    if(color(s.b[t])===-turn)add(t);
    else if(t===s.ep&&s.b[t]==='.'&&s.b[t+16*turn]===(turn===1?'p':'P'))add(t,'ep');
   }
  }else{
   const directions=p==='q'?[...dirs.b,...dirs.r]:dirs[p];
   for(const d of directions)for(let to=from+d;active(to);to+=d){
    if(color(s.b[to])===turn)break;add(to);
    if(s.b[to]!=='.'||p==='n'||p==='k')break;
   }
   if(p==='k'&&from===(turn===1?116:4)&&!check(s)){
    const rook=turn===1?'R':'r',rights=turn===1?[1,2]:[4,8];
    if((s.c&rights[0])&&s.b[from+3]===rook&&s.b[from+1]==='.'&&s.b[from+2]==='.'&&!attacked(s,from+1,-turn)&&!attacked(s,from+2,-turn))add(from+2,'castle');
    if((s.c&rights[1])&&s.b[from-4]===rook&&s.b[from-1]==='.'&&s.b[from-2]==='.'&&s.b[from-3]==='.'&&!attacked(s,from-1,-turn)&&!attacked(s,from-2,-turn))add(from-2,'castle');
   }
  }
 }
 return out.filter(m=>!check(apply(s,m),turn));
}
export function move(s,uci){
 if(typeof uci!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))return null;
 const m=legal(s).find(x=>coord(x[0])+coord(x[1])+x[2]===uci);
 return m?apply(s,m):null;
}
export function san(s,m){
 const [from,to,promotion,flag]=m,p=s.b[from].toUpperCase(),capture=s.b[to]!=='.'||flag==='ep';
 let text='';
 if(flag==='castle')text=to>from?'O-O':'O-O-O';
 else{
  if(p!=='P'){
   text=p;
   const others=legal(s).filter(x=>x[0]!==from&&x[1]===to&&s.b[x[0]]===s.b[from]);
   if(others.length)text+=!others.some(x=>(x[0]&7)===(from&7))?coord(from)[0]:!others.some(x=>(x[0]>>4)===(from>>4))?coord(from)[1]:coord(from);
  }else if(capture)text=coord(from)[0];
  text+=(capture?'x':'')+coord(to)+(promotion?'='+promotion.toUpperCase():'');
 }
 const next=apply(s,m);
 return text+(check(next)?legal(next).length?'+':'#':'');
}
export function key(s){return s.b.join('')+':'+s.t+':'+s.c+':'+s.ep;}
export function result(states){
 const s=states[states.length-1],moves=legal(s);
 if(!moves.length)return check(s)?(s.t===1?'Mat — czarne wygrywają':'Mat — białe wygrywają'):'Pat — remis';
 const units=[];for(let i=0;i<128;i++)if(active(i)&&s.b[i]!=='.'&&!/[kK]/.test(s.b[i]))units.push([s.b[i].toLowerCase(),((i>>4)+(i&7))%2]);
 if(!units.length||(units.length===1&&['b','n'].includes(units[0][0]))||(units.every(x=>x[0]==='b')&&new Set(units.map(x=>x[1])).size===1))return 'Remis — brak materiału matującego';
 if(s.half>=150)return 'Remis — 75 ruchów';
 if(states.filter(x=>key(x)===key(s)).length>=5)return 'Remis — pięciokrotne powtórzenie';
 return '';
}
