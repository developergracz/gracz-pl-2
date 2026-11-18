import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSOLE,isTargetedCheckersChange,normalizedCaption} from './checkers-change-scope.mjs';

const browser='contact-api/scaling/checkers-chess-shell.browser.test.mjs';
const unit='contact-api/test/checkers-console.test.mjs';
const caption=s=>'<p id="checkers-start-detail">'+s+'</p>';
const old=caption('Jakim kolorem chcesz grać? Zegar ruszy dopiero po pierwszym prawidłowym ruchu.');
const next=caption('Jakim kolorem chcesz grać? Gra rozpocznie się po wybraniu koloru.');

test('caption-only change may skip unrelated whole-platform jobs',()=>{
 assert.equal(isTargetedCheckersChange([{status:'M',path:CONSOLE}],old,next),true);
});
test('caption plus dedicated checkers tests remains targeted',()=>{
 assert.equal(isTargetedCheckersChange([{status:'M',path:CONSOLE},{status:'M',path:browser}],old,next),true);
});
test('tests-only changes are covered by checkers acceptance',()=>{
 assert.equal(isTargetedCheckersChange([{status:'M',path:unit},{status:'A',path:browser}]),true);
});
test('all other Warcaby controller changes fail closed to full CI',()=>{
 assert.equal(isTargetedCheckersChange([{status:'M',path:CONSOLE}],old+'function choose(){return 1}',next+'function choose(){return 2}'),false);
});
test('mutating backend or shared code fails closed',()=>{
 assert.equal(isTargetedCheckersChange([{status:'M',path:'contact-api/auth/checkers-tables.mjs'}]),false);
 assert.equal(isTargetedCheckersChange([{status:'M',path:'contact-api/server.mjs'}]),false);
});
test('workflow and classifier changes require full CI',()=>{
 assert.equal(isTargetedCheckersChange([{status:'M',path:'.github/workflows/multiplayer-scaling.yml'}]),false);
 assert.equal(isTargetedCheckersChange([{status:'M',path:'scripts/ci/checkers-change-scope.mjs'}]),false);
});
test('unknown status, deletion, duplicated path and empty diff require full CI',()=>{
 assert.equal(isTargetedCheckersChange([]),false);
 assert.equal(isTargetedCheckersChange([{status:'D',path:unit}]),false);
 assert.equal(isTargetedCheckersChange([{status:'D',path:CONSOLE}],old,next),false);
 assert.equal(isTargetedCheckersChange([{status:'M',path:unit},{status:'M',path:unit}]),false);
});
test('dynamic markup, backslashes and duplicate captions are not eligible',()=>{
 assert.equal(normalizedCaption(caption('<script>alert(1)</script>')),null);
 assert.equal(normalizedCaption(caption('Test \\n escape')),null);
 assert.equal(normalizedCaption(old+next),null);
 assert.equal(isTargetedCheckersChange([{status:'M',path:CONSOLE}],old,caption('$'+'{danger}')),false);
});
test('different static sections cannot be bypassed by copy normalization',()=>{
 assert.equal(isTargetedCheckersChange([{status:'M',path:CONSOLE}],old+'const js=1',next+'const js=2'),false);
});
