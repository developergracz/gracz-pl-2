import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {withChessFeedbackController,chessFeedbackJs,chessFeedbackCss} from '../auth/chess-feedback.mjs';

function load(path){
 let code=0,headers={},body='';
 const served=serveChessConsole({method:'GET'},{writeHead(status,h){code=status;headers=h},end(value){body=String(value)}},new URL('https://example.com'+path));
 return {served,code,headers,body};
}
test('CHESS-002 status and outcome are injected only as independent surfaces',()=>{
 const page=load('/konto/szachy/'),css=load('/konto/szachy/styl.css'),app=load('/konto/szachy/app.js');
 assert.equal(page.code,200);
 assert.match(page.body,/id="chess-feedback-pill"/);
 assert.match(page.body,/id="chess-feedback-overlay"/);
 assert.match(page.body,/role="dialog" aria-modal="true"/);
 assert.match(page.body,/id="board"/);
 assert.match(page.body,/id="game-result-modal"/);
 assert.match(css.body,/\.chess-feedback-pill\[hidden\]/);
 assert.match(css.body,/\.chess-feedback-overlay\[hidden\]/);
 assert.match(css.body,/\.side-dock>#game-state:not\(:has\(\.chess-promote\)\)/,'approved right console CSS is untouched');
 assert.match(app.body,/dataset\.chessFeedbackOutcome/);
 assert.match(app.body,/Twój ruch — białe/);
 assert.match(app.body,/check\(state\)\?' · SZACH'/);
 assert.match(app.body,/Ruch nieprzyjęty/);
 assert.match(app.body,/MutationObserver/);
 assert.match(app.body,/Zwycięstwo!/);
 assert.match(app.body,/Remis/);
 assert.equal(css.headers['Content-Length'],Buffer.byteLength(css.body));
 assert.equal(app.headers['Content-Length'],Buffer.byteLength(app.body));
 assert.doesNotThrow(()=>new Script(chessFeedbackJs));
 // Only the new feedback selectors are modified by the additive stylesheet.
 assert.doesNotMatch(chessFeedbackCss,/\.chess-board|\.chess-square|\.side-dock|\.player-clock/);
});
test('CHESS-002 source hooks fail closed if the engine changes',()=>{
 assert.throws(()=>withChessFeedbackController('const game=1;'),/CHESS_002_CONTROLLER_HOOK_MISSING/);
});
