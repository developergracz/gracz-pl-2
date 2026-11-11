// CHESS-TRANSFER-P1 acceptance in real Chromium: PGN/FEN export and import in the premium chess console.
// Local fixture only: the real chess console modules, no accounts, database or external services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {importPgn} from '../auth/chess-transfer.mjs';

const OPERA='[Event "Paris"]\n[White "Morphy"]\n[Black "Duke Karl / Count Isouard"]\n[Result "1-0"]\n\n'+
 '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5\n'+
 '10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0\n';
const index=s=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
const squares=page=>page.locator('#board .chess-square');
const position=page=>squares(page).evaluateAll(cells=>cells.map(c=>c.querySelector('svg')?.dataset.piece||'.'));
const moves=async page=>Number((await page.locator('#move-count').textContent()).replace(/\D+/g,''));
const waitMoves=(page,n)=>page.waitForFunction(n=>document.querySelector('#move-count').textContent==='Ruchy: '+n,n,{timeout:12000});
const status=page=>page.locator('#chess-transfer-status').textContent();
const statusMatches=(page,pattern)=>page.waitForFunction(source=>new RegExp(source).test(document.getElementById('chess-transfer-status').textContent),pattern.source);

function fixture(t){
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveChessConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,items:[],friends:[],challenges:[]}));
 });
 server.listen(0,'127.0.0.1');
 t.after(()=>{server.close();server.closeAllConnections();});
 return once(server,'listening').then(()=>'http://127.0.0.1:'+server.address().port);
}
async function open(browser,base,options={}){
 const context=await browser.newContext({viewport:{width:1600,height:900},acceptDownloads:true,...options});
 const page=await context.newPage(),errors=[];
 page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'/konto/szachy/');
 await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
 return {context,page,errors};
}
async function importText(page,text){
 await page.locator('#chess-import').click();
 await page.locator('#chess-transfer-input').fill(text);
 await page.locator('#chess-transfer-load').click();
}

test('premium tool buttons export the local game as PGN/FEN (copy and download)',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const {context,page,errors}=await open(browser,base);
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});

 // The two tools live in the existing premium tool row and stay inside it.
 const tools=page.locator('.side-dock .game-tools');
 for(const id of ['chess-export','chess-import']){
  const button=page.locator('#'+id);
  assert.equal(await button.isVisible(),true,id+' is visible');
  assert.equal(await button.evaluate(e=>e.classList.contains('tool-btn')&&!!e.dataset.tooltip),true,id+' uses the premium tool style');
  const box=await button.boundingBox(),row=await tools.boundingBox();
  assert.ok(box.x>=row.x-0.5&&box.x+box.width<=row.x+row.width+0.5&&box.height>=30,id+' fits the tool row');
 }
 assert.equal(await tools.locator('.tool-btn:visible').count(),7,'same seven tool slots as the shared premium console');
 assert.equal(await page.locator('#remove-player, #block-player').count(),0,'PGN/FEN replace the two disabled chess placeholders');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll');

 // Play 1. e4 against the computer, then export.
 await squares(page).nth(index('e2')).click();await squares(page).nth(index('e4')).click();
 await waitMoves(page,2);
 await page.locator('#chess-export').click();
 const modal=page.locator('#chess-transfer-modal');
 assert.equal(await modal.isVisible(),true);
 assert.equal(await page.locator('#chess-transfer-tab-export').evaluate(e=>document.activeElement===e),true,'focus moves into the dialog');
 const pgn=await page.locator('#chess-transfer-pgn').inputValue(),fen=await page.locator('#chess-transfer-fen').inputValue();
 assert.match(pgn,/^\[Event "GRACZ\.PL Szachy"\]\n\[Site "gracz\.pl"\]\n\[Date "\d{4}\.\d\d\.\d\d"\]\n\[Round "-"\]\n\[White "Gracz"\]\n\[Black "Komputer GRACZ\.PL"\]\n\[Result "\*"\]/);
 const game=importPgn(pgn);
 assert.equal(game.uciMoves.length,2);assert.equal(game.uciMoves[0],'e2e4');
 assert.equal(fen,game.finalFen,'FEN shows the position on the board');
 assert.match(fen,/ w KQkq - \d+ 2$/);

 await page.locator('#chess-transfer-copy-pgn').click();
 await statusMatches(page,/PGN skopiowany do schowka/);
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),pgn);
 await page.locator('#chess-transfer-copy-fen').click();
 await statusMatches(page,/FEN skopiowany do schowka/);
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),fen);

 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#chess-transfer-download').click()]);
 assert.match(download.suggestedFilename(),/^gracz-szachy-\d{4}-\d\d-\d\d\.pgn$/);
 assert.equal(await readFile(await download.path(),'utf8'),pgn);

 // Escape closes the dialog and returns focus to the tool that opened it; the game is untouched.
 await page.keyboard.press('Escape');
 assert.equal(await modal.isHidden(),true);
 assert.equal(await page.locator('#chess-export').evaluate(e=>document.activeElement===e),true);
 assert.equal(await moves(page),2);
 assert.deepEqual(errors,[]);
});

test('import replays PGN/FEN into the local game only, with clear errors and undo/export round trip',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const {page,errors}=await open(browser,base);

 // 1. A finished master game against the computer: final position, history, no loss dialog, no new score.
 const before=await position(page);
 await importText(page,OPERA);
 await waitMoves(page,33);
 assert.equal(await page.locator('#chess-transfer-modal').isHidden(),true,'dialog closes after import');
 const board=await position(page);
 assert.notDeepEqual(board,before);
 assert.equal(board[index('d8')],'R');assert.equal(board[index('e8')],'k');assert.equal(board[index('c1')],'K');
 assert.match(await page.locator('#game-state').textContent(),/Mat — białe wygrywają/);
 assert.equal(await page.locator('#moves-panel').isVisible(),true,'the move list is shown');
 assert.equal(await page.locator('#moves-list .chess-move-row').last().textContent(),'17. Rd8#');
 assert.equal(await page.locator('#history-info').textContent(),'Wczytano PGN · półruchy: 33 · wynik 1-0');
 assert.equal(await page.locator('#game-result-modal').isHidden(),true);
 assert.equal(await page.locator('#record-total').textContent(),'0','an imported record is not a new local result');

 // Export of the imported game is the same game.
 await page.locator('#chess-export').click();
 const again=importPgn(await page.locator('#chess-transfer-pgn').inputValue());
 assert.deepEqual(again.uciMoves,importPgn(OPERA).uciMoves);assert.equal(again.outcome,'1-0');
 await page.locator('#chess-transfer-close').click();

 // 2. Invalid text: precise Polish error, dialog stays open, the game is unchanged.
 await importText(page,'1. e4 e5 2. Qh5 Qxe4 *');
 assert.match(await status(page),/Nielegalny lub niejednoznaczny ruch\. Półruch 4: „Qxe4”\./);
 assert.equal(await page.locator('#chess-transfer-modal').isVisible(),true);
 await page.locator('#chess-transfer-input').fill('4k3/8/8/8/8/8/8/K3R3 w - - 0 1');
 await page.locator('#chess-transfer-load').click();
 assert.match(await status(page),/nie może być w szachu/);
 assert.equal(await moves(page),33);

 // 3. A FEN with black to move: the computer (black) answers, numbering starts at "N...", undo returns to the FEN.
 const start='r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 3 3';
 await page.locator('#chess-transfer-input').fill(start);
 await page.locator('#chess-transfer-load').click();
 await waitMoves(page,1);
 assert.match(await page.locator('#moves-list .chess-move-row').first().textContent(),/^3\.\.\. /);
 assert.equal(await page.locator('#history-info').textContent(),'Wczytano pozycję FEN');
 await page.locator('#undo-move').click();
 await page.locator('#chess-export').click();
 assert.equal(await page.locator('#chess-transfer-fen').inputValue(),start);
 assert.match(await page.locator('#chess-transfer-pgn').inputValue(),/\[SetUp "1"\]\n\[FEN "r1bqkbnr\/pppp1ppp\/2n5\/4p3\/4P3\/5N2\/PPPP1PPP\/RNBQKB1R b KQkq - 3 3"\]\n\n\*\n$/);
 await page.locator('#chess-transfer-close').click();

 // 4. File picker fills the text box; "Nowa partia lokalna" returns to the standard start.
 await page.locator('#chess-import').click();
 await page.locator('#chess-transfer-file').setInputFiles({name:'partia.pgn',mimeType:'application/x-chess-pgn',buffer:Buffer.from(OPERA)});
 await statusMatches(page,/Wczytano plik/);
 assert.equal(await page.locator('#chess-transfer-input').inputValue(),OPERA);
 assert.match(await status(page),/Wczytano plik „partia\.pgn”/);
 await page.keyboard.press('Escape');
 await page.locator('#restart').click();
 assert.equal(await moves(page),0);
 assert.deepEqual(await position(page),before);
 assert.equal(await page.locator('#history-info').textContent(),'Historia partii szachowej');
 assert.deepEqual(errors,[]);
});

test('online mode never accepts an import and the dialog fits a phone screen',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const {page,errors}=await open(browser,base);
 await page.locator('#online-mode').click();
 const before=await position(page);
 await page.locator('#chess-import').click();
 assert.equal(await page.locator('#chess-transfer-load').isDisabled(),true);
 assert.equal(await page.locator('#chess-transfer-input').isDisabled(),true);
 assert.equal(await page.locator('#chess-transfer-file').isDisabled(),true);
 assert.match(await status(page),/Partii online nie można podmienić/);
 await page.locator('#chess-transfer-tab-export').click();
 assert.equal(await page.locator('#chess-transfer-fen').inputValue(),'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
 await page.keyboard.press('Escape');
 assert.deepEqual(await position(page),before);

 const phone=await open(browser,base,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await phone.page.locator('#chess-import').scrollIntoViewIfNeeded();
 await phone.page.locator('#chess-import').click();
 const card=await phone.page.locator('.chess-transfer-popup').boundingBox();
 assert.ok(card.x>=0&&card.x+card.width<=390+0.5,'dialog fits the phone width');
 assert.ok(await phone.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll');
 const load=await phone.page.locator('#chess-transfer-load').boundingBox();
 assert.ok(load.height>=44,'touch target');
 assert.deepEqual(errors,[]);assert.deepEqual(phone.errors,[]);
});
