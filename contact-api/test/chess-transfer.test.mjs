import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,START_FEN} from '../auth/chess-rules.mjs';
import {exportFen,importFen,exportPgn,importPgn} from '../auth/chess-transfer.mjs';
test('FEN roundtrip standard position',()=>{
 assert.equal(exportFen(initial()),START_FEN);
 assert.equal(exportFen(importFen(START_FEN)),START_FEN);
});
test('Reject castling rights inconsistent with the position',()=>{
 assert.throws(()=>importFen('4k3/8/8/8/8/8/8/4K3 w K - 0 1'),/INVALID_FEN_CASTLING/);
});
test('Export and import legal SAN with checkmate, preserving UCI',()=>{
 const moves=['f2f3','e7e5','g2g4','d8h4'];
 const pgn=exportPgn(moves,{outcome:'0-1',headers:{White:'Tester',Black:'Komputer'}});
 assert.match(pgn,/Qh4#/);assert.deepEqual(importPgn(pgn).uciMoves,moves);
 assert.equal(importPgn(pgn).outcome,'0-1');
});
test('Parse castling, comments and variations without applying sidelines',()=>{
 const text='[Result "*"]\\n\\n1. e4 {hello} e5 (1... c5) 2. Nf3 Nc6 *'.replaceAll('\\n','\n');
 assert.deepEqual(importPgn(text).uciMoves,['e2e4','e7e5','g1f3','b8c6']);
});
test('Reject illegal PGN and inconsistent declared results',()=>{
 assert.throws(()=>importPgn('1. e4 e5 2. Qh5 Qxe4 *'),/ILLEGAL_OR_AMBIGUOUS/);
 assert.throws(()=>importPgn('[Result "1-0"]\n\n1. e4 e5 0-1'),/PGN_RESULT_MISMATCH/);
 assert.throws(()=>exportPgn(['a2a5']),/ILLEGAL_PGN_MOVE/);
});
test('Do not accept noncanonical FEN or unbounded PGN',()=>{
 assert.throws(()=>importFen('bad fen'),/INVALID_FEN/);
 assert.throws(()=>importPgn('x'.repeat(200001)),/CHESS_TRANSFER_SIZE/);
});
