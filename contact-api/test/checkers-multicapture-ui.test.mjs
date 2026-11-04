import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {playMove} from '../auth/game-engine.mjs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';

function asset(path){
 let status=0,body='';
 const res={writeHead(code){status=code},end(value){body=String(value)}};
 serveCheckersConsole({method:'GET'},res,new URL('https://example.com'+path));
 assert.equal(status,200,path);
 return body;
}
function scenario(piece,enemy,from,first,second){
 const board=Array(64).fill(0);
 board[from]=piece;
 for(const n of enemy)board[n]=piece===1?2:1;
 const turn=piece===1?1:2;
 const s={board,turn,winner:0,moves:0,forced:null,quiet:0};
 const step=playMove('warcaby',s,turn,{from,to:first});
 assert.equal(step.error,undefined);
 assert.equal(step.state.forced,first,'capture sequence must remain forced');
 assert.equal(step.state.turn,turn,'turn must not pass after first capture');
 assert.equal(playMove('warcaby',step.state,turn,{from:first,to:first+7}).error,'BICIE_OBOWIAZKOWE');
 const last=playMove('warcaby',step.state,turn,{from:first,to:second});
 assert.equal(last.error,undefined);
 assert.equal(last.state.forced,null);
 return {s,after:step.state,done:last.state};
}

test('server forces two white captures and cannot end the turn after one',()=>{
 const {s,after,done}=scenario(1,[26,44],17,35,53);
 assert.equal(after.board[26],0);
 assert.equal(after.board[44],2);
 assert.equal(done.board[44],0);
 assert.equal(s.board[26],2,'original state not mutated');
});
test('server forces two black captures too',()=>{
 const {after,done}=scenario(2,[37,19],46,28,10);
 assert.equal(after.board[37],0);
 assert.equal(after.board[19],1);
 assert.equal(done.board[19],0);
});

test('UI offers capture dots, a red forced piece, and an accessible Premium warning',()=>{
 const html=asset('/konto/warcaby/'),css=asset('/konto/warcaby/styl.css'),js=asset('/konto/warcaby/app.js');
 assert.doesNotThrow(()=>new Script(js));
 for(const id of ['checkers-capture-notice','checkers-capture-title','checkers-capture-text','checkers-capture-dismiss'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/aria-live="polite"/);
 assert.match(css,/\.square\.capture-target::after/);
 assert.match(css,/\.piece\.must-continue/);
 assert.match(css,/\.checkers-capture-notice\[hidden\]/);
 assert.match(js,/capture-target/);
 assert.match(js,/syncCaptureNotice\(true\)/);
 assert.match(js,/if\(active&&s\.forced===i\)/);
 assert.match(js,/if\(mode==='training'\)\{playTrainingMove/);
 assert.match(js,/version:current\.version/);
});

test('UI computes the remaining forced chain without confusing alternatives',()=>{
 const js=asset('/konto/warcaby/app.js');
 const from=js.indexOf('function captureOptions('),to=js.indexOf('let captureNoticeKey=');
 assert.ok(from>0&&to>from);
 const guide=new Script(js.slice(from,to)+'\n({captureOptions,captureTargets,captureRange,captureSources})').runInNewContext();
 const board=Array(64).fill(0);
 board[17]=1;board[26]=2;board[44]=2;
 assert.equal(guide.captureRange(board,17,1).min,2);
 assert.equal(guide.captureRange(board,17,1).max,2);
 assert.deepEqual(Array.from(guide.captureTargets(board,17,1)),[35]);
 const start={board,turn:1,winner:0,moves:0,forced:null,quiet:0};
 const after=playMove('warcaby',start,1,{from:17,to:35}).state;
 assert.equal(guide.captureRange(after.board,35,1).min,1);
 assert.deepEqual(Array.from(guide.captureTargets(after.board,35,1)),[53]);
 assert.deepEqual(Array.from(guide.captureSources(after,1)),[35]);
 const black=Array(64).fill(0);black[46]=2;black[37]=1;black[19]=1;
 assert.equal(guide.captureRange(black,46,2).max,2);
 // Long-range kings can land on more than one square after the captured checker.
 const king=Array(64).fill(0);king[42]=3;king[35]=2;
 assert.deepEqual(Array.from(guide.captureTargets(king,42,1)).sort((a,b)=>a-b),[7,14,21,28]);
});
