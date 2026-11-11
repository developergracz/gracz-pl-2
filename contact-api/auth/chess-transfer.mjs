// Pure PGN/FEN transfer for chess. No client-provided position ever updates a live match.
import {START_FEN,parseFen,initial,legal,apply,coord,san,result} from './chess-rules.mjs';
const MAX_PGN=200_000, MAX_PLIES=2_000;
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const RESULTS=new Set(['1-0','0-1','1/2-1/2','*']);
function assertText(value,max){if(typeof value!=='string'||value.length>max)throw Error('CHESS_TRANSFER_SIZE');return value;}
export function exportFen(s){
 if(!s||!Array.isArray(s.b)||s.b.length!==128||![1,-1].includes(s.t))throw Error('INVALID_POSITION');
 const rows=[];
 for(let r=0;r<8;r++){let row='',empty=0;for(let f=0;f<8;f++){const p=s.b[r*16+f];if(p==='.')empty++;else{if(empty)row+=empty;empty=0;row+=p;}}if(empty)row+=empty;rows.push(row);}
 const castling=(s.c&1?'K':'')+(s.c&2?'Q':'')+(s.c&4?'k':'')+(s.c&8?'q':'')||'-';
 return rows.join('/')+' '+(s.t===1?'w':'b')+' '+castling+' '+(s.ep<0?'-':coord(s.ep))+' '+s.half+' '+s.full;
}
export function importFen(text){
 const fen=assertText(text,120).trim();
 const state=parseFen(fen);
 if(exportFen(state)!==fen)throw Error('INVALID_FEN');
 // Reject inconsistent castling and pawns on promotion ranks.
 const b=state.b;
 for(let f=0;f<8;f++)if(/[Pp]/.test(b[f])||/[Pp]/.test(b[112+f]))throw Error('INVALID_FEN_PAWN');
 if((state.c&1)&&(b[116]!=='K'||b[119]!=='R')||(state.c&2)&&(b[116]!=='K'||b[112]!=='R')||(state.c&4)&&(b[4]!=='k'||b[7]!=='r')||(state.c&8)&&(b[4]!=='k'||b[0]!=='r'))throw Error('INVALID_FEN_CASTLING');
 return state;
}
const moveKey=m=>coord(m[0])+coord(m[1])+m[2];
export function exportPgn(uciMoves,{headers={},startFen=START_FEN,outcome='*'}={}){
 if(!Array.isArray(uciMoves)||uciMoves.length>MAX_PLIES||!RESULTS.has(outcome))throw Error('INVALID_PGN');
 let s=importFen(startFen);const moves=[],history=[s];
 for(const uci of uciMoves){if(typeof uci!=='string'||!UCI.test(uci))throw Error('INVALID_PGN_MOVE');
  const m=legal(s).find(x=>moveKey(x)===uci);if(!m)throw Error('ILLEGAL_PGN_MOVE');
  moves.push((s.t===1?s.full+'. ':moves.length===0?s.full+'... ':'')+san(s,m));s=apply(s,m);history.push(s);
 }
 const actual=result(history);
 if(actual && outcome==='*')throw Error('PGN_RESULT_MISMATCH');
 if(actual && ((actual.includes('białe wygrywają')&&outcome!=='1-0')||(actual.includes('czarne wygrywają')&&outcome!=='0-1')||(actual.includes('remis')&&outcome!=='1/2-1/2')))throw Error('PGN_RESULT_MISMATCH');
 const tags={Event:'GRACZ.PL',Site:'gracz.pl',Result:outcome};
 if(startFen!==START_FEN){tags.SetUp='1';tags.FEN=startFen;}
 for(const [k,v] of Object.entries(headers)){if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(k)||typeof v!=='string'||v.length>250||/[\r\n]/.test(v))throw Error('INVALID_PGN_TAG');if(['Result','FEN','SetUp'].includes(k))throw Error('RESERVED_PGN_TAG');tags[k]=v;}
 const tagRows=Object.entries(tags).map(([k,v])=>'['+k+' "'+v.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"]');
 return tagRows.join('\n')+'\n\n'+moves.join(' ')+' '+outcome+'\n';
}
export function importPgn(text){
 const input=assertText(text,MAX_PGN);
 const tags={};let body=input.replace(/^\s*(?:\[[^\]\r\n]*\]\s*)+/u,match=>{
  for(const line of match.match(/\[[^\]\r\n]*\]/g)||[]){const m=/^\[([A-Za-z][A-Za-z0-9_]*)\s+"((?:\\.|[^"\\])*)"\]$/.exec(line);if(!m)throw Error('INVALID_PGN_TAG');tags[m[1]]=m[2].replace(/\\(["\\])/g,'$1');}
  return '';
 });
 // Strip nested RAV variations, brace comments and semicolon line comments.
 body=body.replace(/;[^\r\n]*/g,'').replace(/\{[^}]*\}/g,' ');
 let depth=0,main='';for(const ch of body){if(ch==='('){depth++;continue;}if(ch===')'){if(!depth)throw Error('INVALID_PGN_VARIATION');depth--;continue;}if(!depth)main+=ch;}
 if(depth)throw Error('INVALID_PGN_VARIATION');
 main=main.replace(/\$\d+/g,' ').replace(/\d+\.(?:\.\.)?/g,' ');
 const tokens=main.trim().split(/\s+/).filter(Boolean);let outcome='*';
 if(tokens.length&&RESULTS.has(tokens.at(-1)))outcome=tokens.pop();
 if(tags.Result&&tags.Result!==outcome)throw Error('PGN_RESULT_MISMATCH');
 if(tokens.length>MAX_PLIES)throw Error('CHESS_TRANSFER_SIZE');
 const startFen=tags.SetUp==='1'?tags.FEN:START_FEN;if(!startFen||tags.SetUp&&!['1','0'].includes(tags.SetUp)||tags.FEN&&tags.SetUp!=='1')throw Error('INVALID_PGN_SETUP');
 let s=importFen(startFen),history=[s],uciMoves=[];
 for(const token of tokens){const normalized=token.replace(/[!?]+$/,'').replace(/0/g,'O');const available=legal(s);
 const matches=available.filter(m=>san(s,m)===normalized||san(s,m).replace(/[+#]$/,'')===normalized);
 if(matches.length!==1)throw Error('ILLEGAL_OR_AMBIGUOUS_PGN_MOVE');
 const m=matches[0];uciMoves.push(moveKey(m));s=apply(s,m);history.push(s);
 }
 const actual=result(history);
 if(actual && ((actual.includes('białe wygrywają')&&outcome!=='1-0')||(actual.includes('czarne wygrywają')&&outcome!=='0-1')||(actual.includes('remis')&&outcome!=='1/2-1/2')))throw Error('PGN_RESULT_MISMATCH');
 return {headers:tags,startFen,uciMoves,outcome,finalFen:exportFen(s)};
}
