import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,legal,apply,coord,START_FEN} from '../auth/chess-rules.mjs';
import {exportFen,importFen,exportPgn,importPgn,importChessText,terminalOutcome,MAX_PLIES} from '../auth/chess-transfer.mjs';
const OPERA='[Event "Paris"]\n[White "Morphy"]\n[Black "Duke Karl / Count Isouard"]\n[Result "1-0"]\n\n'+
 '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5\n'+
 '10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0\n';
test('FEN roundtrip standard position',()=>{
 assert.equal(exportFen(initial()),START_FEN);
 assert.equal(exportFen(importFen(START_FEN)),START_FEN);
 assert.equal(exportFen(importFen('  '+START_FEN+'\n')),START_FEN);
 assert.equal(exportFen(importFen('4k3/8/8/8/8/8/8/4K2R w K -')),'4k3/8/8/8/8/8/8/4K2R w K - 0 1','EPD-style FEN gets 0 1 counters');
});
test('Reject castling rights inconsistent with the position',()=>{
 assert.throws(()=>importFen('4k3/8/8/8/8/8/8/4K3 w K - 0 1'),/INVALID_FEN_CASTLING/);
});
test('Reject illegal FEN positions the rules engine would otherwise accept',()=>{
 assert.throws(()=>importFen('4k3/8/8/8/8/8/8/K3R3 w - - 0 1'),/INVALID_FEN_CHECK/,'side not to move is in check');
 assert.throws(()=>importFen('4k3/8/8/8/4P3/8/8/4K3 w - e3 0 1'),/INVALID_FEN_EN_PASSANT/,'wrong rank for the side to move');
 assert.throws(()=>importFen('4k3/8/8/8/8/8/8/4K3 w - d6 0 1'),/INVALID_FEN_EN_PASSANT/,'no pawn behind the square');
 assert.equal(importFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1').ep>=0,true);
 assert.throws(()=>importFen('4k3/8/8/8/8/8/8/8 w - - 0 1'),/INVALID_FEN_KINGS/);
 assert.throws(()=>importFen('4k3/8/8/8/8/PPPPPPPP/P7/4K3 w - - 0 1'),/INVALID_FEN_MATERIAL/);
 assert.throws(()=>importFen('P3k3/8/8/8/8/8/8/4K3 w - - 0 1'),/INVALID_FEN_PAWN/);
 assert.throws(()=>importFen(START_FEN.replace(' 0 1',' 00 1')),/INVALID_FEN/);
 assert.throws(()=>importFen(42),/CHESS_TRANSFER_SIZE/);
 assert.throws(()=>exportFen({b:Array(128).fill('.'),t:1,c:0,ep:-1}),/INVALID_POSITION/,'no undefined counters in output');
});
test('Export and import legal SAN with checkmate, preserving UCI',()=>{
 const moves=['f2f3','e7e5','g2g4','d8h4'];
 const pgn=exportPgn(moves,{outcome:'0-1',headers:{White:'Tester',Black:'Komputer'}});
 assert.match(pgn,/Qh4#/);assert.deepEqual(importPgn(pgn).uciMoves,moves);
 assert.equal(importPgn(pgn).outcome,'0-1');
 assert.throws(()=>exportPgn(moves,{outcome:'*'}),/PGN_RESULT_MISMATCH/,'a mate cannot be exported as unfinished');
});
test('Import a real game with queenside castling, disambiguation and mate',()=>{
 const game=importPgn(OPERA);
 assert.equal(game.uciMoves.length,33);
 assert.equal(game.outcome,'1-0');
 assert.equal(game.sanMoves.at(-1),'Rd8#');
 assert.ok(game.uciMoves.includes('e1c1'));
 assert.equal(game.headers.White,'Morphy');
 assert.equal(terminalOutcome(game.states),'1-0');
 const again=importPgn(exportPgn(game.uciMoves,{outcome:game.outcome,headers:{White:'Morphy'}}));
 assert.deepEqual(again.uciMoves,game.uciMoves);assert.equal(again.finalFen,game.finalFen);
});
test('Parse castling, comments and variations without applying sidelines',()=>{
 const text='[Result "*"]\\n\\n1. e4 {hello} e5 (1... c5) 2. Nf3 Nc6 *'.replaceAll('\\n','\n');
 assert.deepEqual(importPgn(text).uciMoves,['e2e4','e7e5','g1f3','b8c6']);
 const noisy='\uFEFF[Event "x"]\r\n% escape line\r\n\r\n1. e4!? $1 {a; b (c} e5 ; rest of line {\r\n2. Nf3 (2. f4 exf4 (2... d5) 3. Nf3) 2... Nc6?! *';
 assert.deepEqual(importPgn(noisy).uciMoves,['e2e4','e7e5','g1f3','b8c6']);
});
test('Read the first game of a multi-game file and tolerate a missing termination marker',()=>{
 assert.deepEqual(importPgn('[Event "A"]\n[Result "*"]\n\n1. e4 *\n\n[Event "B"]\n\n1. d4 *\n').uciMoves,['e2e4']);
 assert.deepEqual(importPgn('[Event "A"]\n\n1. e4 e5\n\n[Event "B"]\n\n1. d4 *\n').uciMoves,['e2e4','e7e5']);
 const unmarked=importPgn('[Result "1-0"]\n\n1. e4 e5');
 assert.equal(unmarked.outcome,'1-0');
});
test('Accept common SAN variants written by other chess programs',()=>{
 assert.deepEqual(importPgn('1. f3 e5 2. g4 Qh4+ 0-1').uciMoves.at(-1),'d8h4','wrong check marker');
 assert.deepEqual(importPgn('1. Ngf3 *').uciMoves,['g1f3'],'over-disambiguated');
 assert.deepEqual(importPgn('1. e2e4 e7-e5 2. Ng1-f3 *').uciMoves,['e2e4','e7e5','g1f3'],'long algebraic');
 assert.deepEqual(importPgn('[FEN "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]\n\n1. 0-0 *').uciMoves,['e1g1'],'zero castling and FEN without SetUp');
 assert.deepEqual(importPgn('[SetUp "1"]\n[FEN "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. a8Q+ *').uciMoves,['a7a8q']);
 assert.deepEqual(importPgn('[SetUp "1"]\n[FEN "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"]\n\n1. exd6 e.p. *').uciMoves,['e5d6']);
});
test('Reject illegal, ambiguous or underspecified moves with the failing ply',()=>{
 assert.throws(()=>importPgn('1. e4 e5 2. Qh5 Qxe4 *'),error=>error.code==='ILLEGAL_OR_AMBIGUOUS_PGN_MOVE'&&error.ply===4&&error.token==='Qxe4');
 const knights='[FEN "4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1"]\n\n';
 assert.throws(()=>importPgn(knights+'1. Nd2 *'),error=>error.ambiguous===true);
 assert.deepEqual(importPgn(knights+'1. Nbd2 *').uciMoves,['b1d2']);
 assert.throws(()=>importPgn('[FEN "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. a8 *'),/ILLEGAL_OR_AMBIGUOUS/,'promotion piece is required');
 assert.throws(()=>importPgn('1. Nxf3 *'),/ILLEGAL_OR_AMBIGUOUS/,'capture marker on a quiet move');
});
test('Reject illegal PGN and inconsistent declared results',()=>{
 assert.throws(()=>importPgn('[Result "1-0"]\n\n1. e4 e5 0-1'),/PGN_RESULT_MISMATCH/);
 assert.throws(()=>importPgn('[Result "2-0"]\n\n1. e4 *'),/INVALID_PGN_RESULT/);
 assert.throws(()=>exportPgn(['a2a5']),/ILLEGAL_PGN_MOVE/);
 assert.throws(()=>importPgn('[SetUp "1"]\n\n1. e4 *'),/INVALID_PGN_SETUP/);
 assert.throws(()=>importPgn('[SetUp "0"]\n[FEN "'+START_FEN+'"]\n\n1. e4 *'),/INVALID_PGN_SETUP/);
 assert.throws(()=>importPgn('1. e4 {open *'),/INVALID_PGN_COMMENT/);
 assert.throws(()=>importPgn('1. e4 (1. d4 *'),/INVALID_PGN_VARIATION/);
 assert.throws(()=>importPgn('[White Morphy]\n\n1. e4 *'),/INVALID_PGN_TAG/);
});
test('Automatic draws use the engine result, including capitalised "Remis" reasons',()=>{
 const bare='[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/3r4/4K3 w - - 0 1"]\n\n1. Kxd2 ';
 assert.throws(()=>importPgn(bare+'1-0'),/PGN_RESULT_MISMATCH/,'king versus king cannot be won');
 assert.equal(importPgn(bare+'1/2-1/2').outcome,'1/2-1/2');
 assert.equal(importPgn(bare+'*').outcome,'1/2-1/2','an unfinished marker is normalised to the automatic draw');
 assert.throws(()=>exportPgn(['e1d2'],{startFen:'4k3/8/8/8/8/8/3r4/4K3 w - - 0 1',outcome:'1-0'}),/PGN_RESULT_MISMATCH/);
 assert.match(exportPgn(['e1d2'],{startFen:'4k3/8/8/8/8/8/3r4/4K3 w - - 0 1',outcome:'1/2-1/2'}),/Kxd2 1\/2-1\/2/);
});
test('Export follows the PGN standard: tag order, escaping, move numbers and line length',()=>{
 const pgn=exportPgn(['e7e5','g1f3'],{startFen:'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',headers:{White:'A "B" [C]',Black:'D\\E',Date:'2026.11.11'}});
 const tags=[...pgn.matchAll(/^\[(\w+) /gm)].map(m=>m[1]);
 assert.deepEqual(tags,['Event','Site','Date','Round','White','Black','Result','SetUp','FEN']);
 assert.match(pgn,/\[White "A \\"B\\" \[C\]"\]/);assert.match(pgn,/\[Black "D\\\\E"\]/);
 assert.match(pgn,/\n\n1\.\.\. e5 2\. Nf3 \*\n$/);
 assert.equal(importPgn(pgn).headers.White,'A "B" [C]');
 assert.throws(()=>exportPgn([],{headers:{Result:'1-0'}}),/RESERVED_PGN_TAG/);
 assert.throws(()=>exportPgn([],{headers:{White:'a\nb'}}),/INVALID_PGN_TAG/);
 const long=importPgn(OPERA);
 for(const line of exportPgn(long.uciMoves,{outcome:'1-0'}).split('\n'))assert.ok(line.length<=80,line);
});
test('Long games round-trip and inputs stay bounded',()=>{
 let seed=7,s=initial();const uci=[],states=[s];
 const random=n=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed%n;};
 while(uci.length<300){
  const options=legal(s).filter(m=>!terminalOutcome([apply(s,m)]));if(!options.length)break;
  const m=options[random(options.length)];s=apply(s,m);states.push(s);uci.push(coord(m[0])+coord(m[1])+m[2]);
 }
 assert.ok(uci.length>=200);
 const game=importPgn(exportPgn(uci,{outcome:terminalOutcome(states)||'*'}));
 assert.deepEqual(game.uciMoves,uci);assert.equal(game.finalFen,exportFen(s));
 assert.throws(()=>exportPgn(Array(MAX_PLIES+1).fill('e2e4')),/INVALID_PGN/);
 assert.throws(()=>importPgn('1. Nf3 Nf6 2. Ng1 Ng8 '.repeat(501)),/CHESS_TRANSFER_SIZE/);
});
test('Console entry point detects FEN or PGN text',()=>{
 const fen=importChessText(' 7k/5Q2/6K1/8/8/8/8/8 b - - 0 1 ');
 assert.equal(fen.kind,'fen');assert.equal(fen.uciMoves.length,0);assert.equal(fen.outcome,'1/2-1/2','stalemate');
 const pgn=importChessText(OPERA);
 assert.equal(pgn.kind,'pgn');assert.equal(pgn.states.length,34);
 assert.throws(()=>importChessText('   '),/EMPTY_CHESS_TRANSFER/);
});
test('Do not accept noncanonical FEN or unbounded PGN',()=>{
 assert.throws(()=>importFen('bad fen'),/INVALID_FEN/);
 assert.throws(()=>importPgn('x'.repeat(200001)),/CHESS_TRANSFER_SIZE/);
});
