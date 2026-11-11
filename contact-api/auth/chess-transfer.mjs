// Pure PGN/FEN transfer for chess. The server tests and the browser console share this exact file.
// Import only builds a validated local position and move list; it never updates a live online match.
import {START_FEN,parseFen,legal,apply,coord,square,san,check,result} from './chess-rules.mjs';
export const MAX_PGN=200_000,MAX_PLIES=2_000;
const MAX_FEN=120,MAX_TAGS=64,MAX_TAG_VALUE=1_000;
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const RESULTS=new Set(['1-0','0-1','1/2-1/2','*']);
const RESERVED=new Set(['Result','FEN','SetUp']);
const TAG_NAME=/^[A-Za-z][A-Za-z0-9_]*$/;
// Short algebraic (SAN) plus the long forms other programs export: Ng1-f3, e2e4, e7e8q, 0-0.
const SAN=/^(?:(O-O-O|O-O)|([NBRQKP])?([a-h])?([1-8])?([-x:])?([a-h][1-8])(?:=?([NBRQnbrq]))?)$/;
const fail=(code,detail={})=>Object.assign(Error(code),{code},detail);
function assertText(value,max){if(typeof value!=='string'||value.length>max)throw fail('CHESS_TRANSFER_SIZE');return value;}
const moveKey=m=>coord(m[0])+coord(m[1])+m[2];
// Automatic end of the game according to the shared rules engine, as a PGN result ('' = game continues).
export function terminalOutcome(states){
 const text=result(states);
 return !text?'':/białe wygrywają/.test(text)?'1-0':/czarne wygrywają/.test(text)?'0-1':'1/2-1/2';
}
export function exportFen(s){
 if(!s||!Array.isArray(s.b)||s.b.length!==128||![1,-1].includes(s.t)||!Number.isInteger(s.c)||s.c<0||s.c>15||
    !Number.isInteger(s.ep)||s.ep< -1||s.ep>=128||(s.ep>=0&&(s.ep&0x88))||
    !Number.isSafeInteger(s.half)||s.half<0||!Number.isSafeInteger(s.full)||s.full<1)throw fail('INVALID_POSITION');
 const rows=[];
 for(let r=0;r<8;r++){
  let row='',empty=0;
  for(let f=0;f<8;f++){
   const p=s.b[r*16+f];
   if(p==='.'){empty++;continue;}
   if(typeof p!=='string'||!/^[pnbrqkPNBRQK]$/.test(p))throw fail('INVALID_POSITION');
   if(empty)row+=empty;empty=0;row+=p;
  }
  if(empty)row+=empty;rows.push(row);
 }
 const castling=(s.c&1?'K':'')+(s.c&2?'Q':'')+(s.c&4?'k':'')+(s.c&8?'q':'')||'-';
 return rows.join('/')+' '+(s.t===1?'w':'b')+' '+castling+' '+(s.ep<0?'-':coord(s.ep))+' '+s.half+' '+s.full;
}
export function importFen(text){
 const fields=assertText(text,MAX_FEN).trim().split(/\s+/);
 if(fields.length===4)fields.push('0','1'); // EPD-style FEN without counters
 if(fields.length!==6)throw fail('INVALID_FEN');
 const fen=fields.join(' ');
 let state;
 try{state=parseFen(fen);}catch(error){throw fail(error.message==='INVALID_KINGS'?'INVALID_FEN_KINGS':'INVALID_FEN');}
 if(exportFen(state)!==fen)throw fail('INVALID_FEN');
 const b=state.b,t=state.t,ep=state.ep;
 for(let f=0;f<8;f++)if(/[Pp]/.test(b[f])||/[Pp]/.test(b[112+f]))throw fail('INVALID_FEN_PAWN');
 for(const side of [/^[PNBRQK]$/,/^[pnbrqk]$/]){
  const own=b.filter(p=>side.test(p));
  if(own.length>16||own.filter(p=>p==='P'||p==='p').length>8)throw fail('INVALID_FEN_MATERIAL');
 }
 if((state.c&1)&&(b[116]!=='K'||b[119]!=='R')||(state.c&2)&&(b[116]!=='K'||b[112]!=='R')||
    (state.c&4)&&(b[4]!=='k'||b[7]!=='r')||(state.c&8)&&(b[4]!=='k'||b[0]!=='r'))throw fail('INVALID_FEN_CASTLING');
 // The en passant square must sit behind a pawn that has just made a double step.
 if(ep>=0&&((ep>>4)!==(t===1?2:5)||b[ep]!=='.'||b[ep-16*t]!=='.'||b[ep+16*t]!==(t===1?'p':'P')))throw fail('INVALID_FEN_EN_PASSANT');
 // The side that has just moved can never be left in check.
 if(check(state,-t))throw fail('INVALID_FEN_CHECK');
 return state;
}
// First game only: tags, then main-line tokens. Comments, NAGs, % escapes and variations are skipped.
function readPgn(input){
 const text=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 const tags=Object.create(null),tokens=[],tag=/\[[ \t]*([A-Za-z][A-Za-z0-9_]*)[ \t]+"((?:\\.|[^"\\\n])*)"[ \t]*\]/y;
 let i=0,count=0,depth=0,outcome='';
 const lineEnd=from=>{const end=text.indexOf('\n',from);return end<0?text.length:end;};
 for(;;){
  while(i<text.length&&/\s/.test(text[i]))i++;
  if(text[i]==='%'&&(i===0||text[i-1]==='\n')){i=lineEnd(i);continue;}
  if(text[i]!=='[')break;
  tag.lastIndex=i;const m=tag.exec(text);
  if(!m||++count>MAX_TAGS||m[2].length>MAX_TAG_VALUE)throw fail('INVALID_PGN_TAG');
  tags[m[1]]=m[2].replace(/\\(["\\])/g,'$1');i=tag.lastIndex;
 }
 while(i<text.length){
  const ch=text[i];
  if(/\s/.test(ch)){i++;continue;}
  if(ch==='%'&&(i===0||text[i-1]==='\n')){i=lineEnd(i);continue;}
  if(ch===';'){i=lineEnd(i);continue;}
  if(ch==='{'){const end=text.indexOf('}',i);if(end<0)throw fail('INVALID_PGN_COMMENT');i=end+1;continue;}
  if(ch==='('){depth++;i++;continue;}
  if(ch===')'){if(!depth)throw fail('INVALID_PGN_VARIATION');depth--;i++;continue;}
  if(ch==='['&&!depth)break; // the next game starts without a termination marker
  if(ch==='['||ch===']'||ch==='}')throw fail('INVALID_PGN_TOKEN');
  let end=i;while(end<text.length&&!/[\s{}();[\]]/.test(text[end]))end++;
  const word=text.slice(i,end);i=end;
  if(depth)continue;
  if(RESULTS.has(word)){outcome=word;break;}
  const move=word.replace(/^\d+\.+/,''); // move numbers "12." and "12..." (never castling "0-0")
  if(!move||/^\d+$/.test(move)||/^\$\d+$/.test(move)||/^[!?]+$/.test(move)||move==='e.p.')continue;
  if(tokens.length>=MAX_PLIES)throw fail('CHESS_TRANSFER_SIZE');
  tokens.push(move);
 }
 if(depth)throw fail('INVALID_PGN_VARIATION');
 return {tags,tokens,outcome};
}
// Every legal move the token can describe. Exactly one match is required by the caller.
function matchMoves(s,token){
 const m=SAN.exec(token.replace(/e\.p\.$/,'').replace(/[+#!?]+$/,'').replace(/0/g,'O'));
 if(!m)return [];
 const [,castle,piece,file,rank,separator,target,promotion]=m,moves=legal(s);
 if(castle)return moves.filter(x=>x[3]==='castle'&&(x[1]>x[0])===(castle==='O-O'));
 const to=square(target),capture=separator==='x'||separator===':',long=!piece&&file&&rank;
 return moves.filter(x=>x[1]===to&&
  (long?x[0]===square(file+rank):s.b[x[0]].toUpperCase()===(piece||'P'))&&
  (!file||coord(x[0])[0]===file)&&(!rank||coord(x[0])[1]===rank)&&
  (!capture||s.b[x[1]]!=='.'||x[3]==='ep')&&
  (promotion||'').toLowerCase()===x[2]);
}
export function exportPgn(uciMoves,{headers={},startFen=START_FEN,outcome='*'}={}){
 if(!Array.isArray(uciMoves)||uciMoves.length>MAX_PLIES||!RESULTS.has(outcome)||!headers||typeof headers!=='object')throw fail('INVALID_PGN');
 const start=importFen(startFen),fen=exportFen(start),words=[],states=[start];
 let s=start;
 for(const uci of uciMoves){
  if(typeof uci!=='string'||!UCI.test(uci))throw fail('INVALID_PGN_MOVE');
  const m=legal(s).find(x=>moveKey(x)===uci);if(!m)throw fail('ILLEGAL_PGN_MOVE');
  if(s.t===1)words.push(s.full+'.');else if(!words.length)words.push(s.full+'...');
  words.push(san(s,m));s=apply(s,m);states.push(s);
 }
 const actual=terminalOutcome(states);
 if(actual&&outcome!==actual)throw fail('PGN_RESULT_MISMATCH');
 // Seven Tag Roster first, in the order required by the PGN standard.
 const tags={Event:'GRACZ.PL Szachy',Site:'gracz.pl',Date:'????.??.??',Round:'-',White:'?',Black:'?',Result:outcome};
 for(const [k,v] of Object.entries(headers)){
  if(!TAG_NAME.test(k)||typeof v!=='string'||v.length>250||/[\u0000-\u001f\u007f]/.test(v))throw fail('INVALID_PGN_TAG');
  if(RESERVED.has(k))throw fail('RESERVED_PGN_TAG');
  tags[k]=v;
 }
 if(fen!==START_FEN){tags.SetUp='1';tags.FEN=fen;}
 const lines=[];let line='';
 for(const word of [...words,outcome]){
  if(line&&line.length+1+word.length>80){lines.push(line);line=word;}else line=line?line+' '+word:word;
 }
 lines.push(line);
 return Object.entries(tags).map(([k,v])=>'['+k+' "'+v.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"]').join('\n')+'\n\n'+lines.join('\n')+'\n';
}
export function importPgn(text){
 const {tags,tokens,outcome:marker}=readPgn(assertText(text,MAX_PGN));
 const declared=tags.Result;
 if(declared!==undefined&&!RESULTS.has(declared))throw fail('INVALID_PGN_RESULT');
 if(marker&&declared&&declared!==marker)throw fail('PGN_RESULT_MISMATCH');
 if(tags.SetUp!==undefined&&!['0','1'].includes(tags.SetUp)||tags.SetUp==='1'&&!tags.FEN||tags.SetUp==='0'&&tags.FEN!==undefined)throw fail('INVALID_PGN_SETUP');
 const start=importFen(tags.FEN??START_FEN),states=[start],uciMoves=[],sanMoves=[];
 let s=start,outcome=marker||declared||'*';
 for(const [index,token] of tokens.entries()){
  const found=matchMoves(s,token);
  if(found.length!==1)throw fail('ILLEGAL_OR_AMBIGUOUS_PGN_MOVE',{ply:index+1,token,ambiguous:found.length>1});
  const m=found[0];uciMoves.push(moveKey(m));sanMoves.push(san(s,m));s=apply(s,m);states.push(s);
 }
 const actual=terminalOutcome(states);
 if(actual){if(outcome==='*')outcome=actual;else if(outcome!==actual)throw fail('PGN_RESULT_MISMATCH');}
 return {headers:{...tags},startFen:exportFen(start),uciMoves,sanMoves,outcome,finalFen:exportFen(s),states};
}
// Console entry point: one FEN line or one PGN game (the first game of a multi-game file).
export function importChessText(text){
 const input=assertText(text,MAX_PGN).replace(/^\uFEFF/,'').trim();
 if(!input)throw fail('EMPTY_CHESS_TRANSFER');
 if(/^[pnbrqkPNBRQK1-8]+(?:\/[pnbrqkPNBRQK1-8]+){7}\s+[wb](?:\s|$)/.test(input)){
  const state=importFen(input),fen=exportFen(state);
  return {kind:'fen',headers:{},startFen:fen,uciMoves:[],sanMoves:[],outcome:terminalOutcome([state])||'*',finalFen:fen,states:[state]};
 }
 return {kind:'pgn',...importPgn(input)};
}
