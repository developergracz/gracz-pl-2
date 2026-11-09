/**
 * GRACZ.CONSOLE.PARITY — read-only geometry agent.
 * Gomoku is the runtime reference. No CSS or game state is modified.
 * Run from contact-api: node console-layout-agent/measure.mjs
 * Requires Playwright (installed by the companion workflow).
 */
import {createServer} from 'node:http';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveChessConsole} from '../auth/chess-console.mjs';

const GAMES = ['gomoku','warcaby','szachy'];
const VIEWPORTS = [
  [1920,1080],[1440,900],[1366,768],[1181,820],
  [1024,768],[768,1024],[390,844],[375,667]
];
const PARTS = [
  ['console', '.layout'], ['sidebar', '.sidebar'],
  ['sidebar-header', '.side-header'], ['game-mode', '.mode'],
  ['training-button', '#training-mode'], ['online-button', '#online-mode'],
  ['training-options', '#training-settings'], ['online-options', '#online-settings'],
  ['sidebar-footer', '.sidebar-footer'], ['game-area', '.boardarea'],
  ['game-heading', '.boardtop'], ['board-container', '.board-center'],
  ['board-frame', '.boardframe'], ['game-board', '#board'],
  ['chat-dock', '.side-dock'], ['match-panel', '.match-panel'],
  ['dock-header', '.dock-header'], ['dock-tabs', '.dock-tabs'],
  ['chat-tab', '#chat-tab'], ['moves-tab', '#history-tab'],
  ['chat-panel', '#chat-panel'], ['chat-messages', '#chat-messages'],
  ['chat-input', '#chat-input'], ['chat-send', '#chat-send'],
  ['chat-compose', '.chat-compose'], ['mini-chat', '.mini-chat'],
  ['toolbar', '.game-tools'], ['bottom-bar', '.bottom'],
  ['config-open', '#console-config-open'], ['clock-black', '#clock-1'],
  ['clock-white', '#clock-2']
];
const KEY_PARTS = new Set([
  'console','sidebar','game-area','board-container',
  'chat-dock','match-panel','dock-tabs','bottom-bar'
]);
const TOLERANCE = 2; // device pixels at DPR=1
const round = n => Math.round(n*100)/100;
const outDir = path.resolve(fileURLToPath(new URL('./reports/', import.meta.url)));
const externalBase = process.env.CONSOLE_LAYOUT_BASE_URL?.replace(/\/+$/, '') || '';
const strict = process.argv.includes('--strict');
const handlers = [serveGomokuConsole,serveCheckersConsole,serveChessConsole];

function localServer() {
  return createServer((req,res) => {
    const url = new URL(req.url,'http://127.0.0.1');
    try {
      for(const handler of handlers) if(handler(req,res,url))return;
      const isApi = url.pathname.startsWith('/auth/');
      res.writeHead(isApi ? 401 : 404, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'
      });
      res.end(JSON.stringify({error:isApi?'LOGIN_REQUIRED':'NOT_FOUND'}));
    } catch(e) {
      if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain'});
      res.end('LOCAL_FIXTURE_ERROR');
      process.stderr.write(String(e)+'\n');
    }
  });
}
async function snapshot(page) {
  return page.evaluate((parts) => {
    const measure=(selector)=>{
      const el=document.querySelector(selector);
      if(!el)return {exists:false,visible:false};
      const style=getComputedStyle(el), r=el.getBoundingClientRect();
      const visible=style.display!=='none' && style.visibility!=='hidden' && r.width>0 && r.height>0 && !el.hidden;
      return {
        exists:true,visible,
        rect:visible?{x:+r.x.toFixed(2),y:+r.y.toFixed(2),width:+r.width.toFixed(2),height:+r.height.toFixed(2)}:null,
        css:{
          display:style.display,position:style.position,
          gridColumns:style.gridTemplateColumns,gridRows:style.gridTemplateRows,
          padding:style.padding,gap:style.gap,
          fontSize:style.fontSize,lineHeight:style.lineHeight,
          overflowX:style.overflowX,overflowY:style.overflowY
        },
        scroll:{width:el.scrollWidth,height:el.scrollHeight,clientWidth:el.clientWidth,clientHeight:el.clientHeight},
        horizontalOverflow:visible && el.scrollWidth>el.clientWidth+2 && !['auto','scroll'].includes(style.overflowX),
        clippedInViewport:visible && (r.left < -2 || r.right>innerWidth+2 || r.top < -2 || r.bottom>innerHeight+2)
      };
    };
    return {
      url:location.pathname,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      documentOverflow:document.documentElement.scrollWidth>innerWidth+2,
      documentScrollWidth:document.documentElement.scrollWidth,
      viewportClientWidth:document.documentElement.clientWidth,
      horizontalOverflowElements:[...document.querySelectorAll('body *')].filter(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && (r.left < -2 || r.right > innerWidth+2);
      }).slice(0,30).map(el=>({selector:el.id?'#'+el.id:(el.classList.length?'.'+el.classList[0]:el.tagName.toLowerCase()),right:+el.getBoundingClientRect().right.toFixed(2)})),
      parts:Object.fromEntries(parts.map(([name,selector])=>[name,measure(selector)]))
    };
  },PARTS);
}
function compare(base,target,game,viewport){
  const mobile=Number(viewport.split('x')[0])<=800;
  const differences=[], missing=[], missingInReference=[];
  for(const [name] of PARTS){
    const a=base.parts[name],b=target.parts[name];
    if(!a?.visible){if(b?.visible)missingInReference.push(name);continue;}
    if(!b?.visible){missing.push(name);continue;}
    const delta={};
    for(const property of ['x','y','width','height']){
      const v=round(b.rect[property]-a.rect[property]);
      if(Math.abs(v)>TOLERANCE)delta[property]=v;
    }
    if(Object.keys(delta).length)differences.push({
      part:name,reference:a.rect,actual:b.rect,delta,
      critical:KEY_PARTS.has(name)&&(!mobile||'x' in delta||'width' in delta)
    });
  }
  return {
    game,viewport,
    differences,missing,missingInReference,
    criticalDifferences:differences.filter(x=>x.critical).length,
    documentOverflow:target.documentOverflow,
    documentScrollWidth:target.documentScrollWidth,
    horizontalOverflowElements:target.horizontalOverflowElements,
    boardContained:(()=>{
      const f=target.parts['board-frame']?.rect,b=target.parts['board-container']?.rect;
      return !!(f&&b&&f.x>=b.x-2&&f.y>=b.y-2&&f.x+f.width<=b.x+b.width+2&&f.y+f.height<=b.y+b.height+2);
    })(),
    boardSquare:target.parts['game-board']?.rect
      ? target.parts['game-board'].rect.width>=80 && target.parts['game-board'].rect.height>=80 &&
        Math.abs(target.parts['game-board'].rect.width-target.parts['game-board'].rect.height)<=2
      : false
  };
}
function markdown(report) {
  const text=[
    '# GRACZ.PL — agent geometrii konsol (Gomoku → Warcaby / Szachy)',
    '',
    '- Referencja: **renderowana konsola Gomoku**, przy tym samym viewport, DPR=1 i stanie początkowym.',
    '- Źródło: '+(report.source==='local'?'lokalne strony generowane bezpośrednio z aktualnego kodu':'zewnętrzny adres '+report.baseUrl)+'.',
    '- Tolerancja: **±'+TOLERANCE+' px** dla wspólnego układu konsoli. Wewnętrzna rama/plansza są diagnostyczne: plansze 8×8 muszą być kwadratowe i mieścić się w obszarze Gomoku, który bywa prostokątny.',
    '- Pomiary w CSS-pikselach są odczytywane z getBoundingClientRect(), a nie zgadywane z wartości CSS.',
    '- Mobile (≤800px): układ pionowy dostosowuje wysokość do liczby ustawień danej gry. Krytyczne porównanie 1:1 obejmuje x i szerokość wspólnych elementów; różnice y i wysokości raportujemy diagnostycznie bez ukrywania funkcji.',
    '',
    '| Okno | Gra | Odchylenia wspólnej geometrii | Odchylenia łącznie | Poziomy overflow | Plansza w obszarze | Kwadratowa |',
    '|---|---|---:|---:|---|---|---|'
  ];
  for(const entry of report.comparisons){
    text.push('| '+entry.viewport+' | '+entry.game+' | '+entry.criticalDifferences+
      ' | '+entry.differences.length+' | '+(entry.documentOverflow?'TAK ('+entry.documentScrollWidth+'px)':'nie')+
      ' | '+(entry.boardContained?'tak':'NIE')+' | '+(entry.boardSquare?'tak':'NIE')+' |');
  }
  for(const entry of report.comparisons){
    text.push('','## '+entry.game+' / '+entry.viewport);
    if(entry.documentOverflow && entry.horizontalOverflowElements?.length)text.push('Elementy poza viewportem: '+entry.horizontalOverflowElements.map(x=>x.selector+' (right '+x.right+'px)').join(', ')+'.');
    if(!entry.boardContained)text.push('UWAGA: rama planszy wychodzi poza przeznaczony obszar gry.');
    if(!entry.differences.length && !entry.missing.length) text.push('Brak odchyleń > '+TOLERANCE+' px w widocznych elementach.');
    else {
      if(entry.missing.length)text.push('Elementy widoczne w Gomoku, niewidoczne tutaj: '+entry.missing.join(', ')+'.');
      text.push('','| Element | Gomoku (x, y, w, h) | Aktualne (x, y, w, h) | Różnice w px (x, y, w, h) |','|---|---|---|---|');
      for(const x of entry.differences){
        const r=a=>['x','y','width','height'].map(k=>a?.[k]??'—').join(', ');
        text.push('| '+(x.critical?'**'+x.part+'**':x.part)+' | '+r(x.reference)+' | '+r(x.actual)+' | '+r(x.delta)+' |');
      }
    }
  }
  text.push('','## Mandat korygujący','',
    '1. Utrzymaj układ, szerokości kolumn, obszary planszy, dock czatu, paski, marginesy i responsywność identyczne z **renderowaną** konsolą Gomoku.',
    '2. Koryguj wyłącznie CSS/strukturę wizualną Warcabów i Szachów; nie kopiuj planszy 15×15, nie zmieniaj zasad, AI, czatu, autoryzacji ani protokołów.',
    '3. Jeśli odchylenie wynika z ukrycia elementu przez funkcję gry, udokumentuj wyjątek; nie dodawaj fikcyjnych elementów.',
    '4. Po poprawkach uruchom agenta ponownie. Kryterium: 0 odchyleń wspólnej geometrii > 2 px, brak poziomego overflow, kwadratowa plansza 8×8 w granicach obszaru gry. Rama nie musi być identycznie prostokątna jak w Gomoku.',
    '5. Do raportu dołącz porównawcze zrzuty ekranu; różne treści plansz są zamierzone.',
    ''
  );
  return text.join('\n');
}
async function main(){
  await mkdir(outDir,{recursive:true});
  const {chromium}=await import('playwright').catch(()=>{
    throw Error('Playwright missing: install it in contact-api (npm install --no-save --no-package-lock playwright@1.58.2).');
  });
  const server=externalBase?null:localServer();
  let browser;
  try{
    if(server) await new Promise((resolve,reject)=>{
      server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
    });
    const base=externalBase||('http://127.0.0.1:'+server.address().port);
    browser=await chromium.launch({headless:true});
    const measurements=[],comparisons=[],focusMeasurements=[];
    for(const [width,height] of VIEWPORTS){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'pl-PL',reducedMotion:'reduce'});
      const byGame={};
      for(const game of GAMES){
        const page=await context.newPage();
        if(!externalBase) await page.route('**/*', route=>{
          const reqUrl=new URL(route.request().url());
          return reqUrl.hostname==='127.0.0.1'?route.continue():route.abort();
        });
        const response=await page.goto(base+'/konto/'+game+'/',{waitUntil:'domcontentloaded',timeout:20000});
        if(!response||response.status()!==200)throw Error(game+' '+width+'x'+height+' returned HTTP '+response?.status());
        await page.locator('.layout').waitFor({state:'visible',timeout:10000});
        await page.evaluate(()=>document.fonts?.ready);
        await page.waitForTimeout(200);
        const measurement=await snapshot(page);
        byGame[game]=measurement;
        measurements.push({game,viewport:width+'x'+height,...measurement});
        await page.screenshot({path:path.join(outDir,game+'-'+width+'x'+height+'.png'),animations:'disabled',fullPage:false});
        // A maximized 16:9 browser uses the game's Focus / Full Screen control.
        // Record its REAL click behavior, not a synthetic CSS-only class toggle.
        const focusAction=await page.evaluate(()=>{
          const button=document.getElementById('focus-game');
          if(!button)return {controlFound:false};
          button.click();
          return {controlFound:true};
        });
        await page.waitForTimeout(180);
        const focus=await snapshot(page);
        const focusEnabled=await page.evaluate(()=>document.querySelector('.layout')?.classList.contains('game-focus')||false);
        const frame=focus.parts['board-frame']?.rect;
        const board=focus.parts['game-board']?.rect;
        const center=focus.parts['board-container']?.rect;
        const sq=r=>!!r&&r.width>=80&&r.height>=80&&Math.abs(r.width-r.height)<=2;
        const contained=!!frame&&!!center&&frame.x>=center.x-2&&frame.y>=center.y-2&&frame.x+frame.width<=center.x+center.width+2&&frame.y+frame.height<=center.y+center.height+2;
        focusMeasurements.push({
          game,viewport:width+'x'+height,controlFound:focusAction.controlFound,
          focusEnabled,frameSquare:sq(frame),boardSquare:sq(board),
          contained,documentOverflow:focus.documentOverflow,
          documentScrollWidth:focus.documentScrollWidth,
          frame,board,center
        });
        if(focusEnabled)await page.screenshot({path:path.join(outDir,game+'-focus-'+width+'x'+height+'.png'),animations:'disabled',fullPage:false});
        await page.close();
      }
      for(const game of ['warcaby','szachy'])
        comparisons.push(compare(byGame.gomoku,byGame[game],game,width+'x'+height));
      await context.close();
    }
    const report={
      generatedAt:new Date().toISOString(),
      source:externalBase?'external':'local',
      baseUrl:externalBase||'local fixture',
      reference:'Gomoku',tolerancePx:TOLERANCE,
      measurements,comparisons,focusMeasurements
    };
    await writeFile(path.join(outDir,'measurements.json'),JSON.stringify(report,null,2)+'\n');
    await writeFile(path.join(outDir,'report.md'),markdown(report));
    const failures=comparisons.filter(x=>x.criticalDifferences||x.documentOverflow||!x.boardSquare||!x.boardContained);
    const referenceOverflow=measurements.filter(x=>x.game==='gomoku'&&x.documentOverflow).map(x=>x.viewport.width+'x'+x.viewport.height);
    const focusFailures=focusMeasurements.filter(x=>!x.focusEnabled||!x.frameSquare||!x.boardSquare||!x.contained||x.documentOverflow);
    console.log('CONSOLE_PARITY '+JSON.stringify({
      tested:measurements.length,comparisons:comparisons.length,
      divergentViewports:failures.length,
      referenceOverflow,
      focusFailures:focusFailures.map(x=>x.game+' '+x.viewport+' '+JSON.stringify({enabled:x.focusEnabled,frameSquare:x.frameSquare,boardSquare:x.boardSquare,contained:x.contained,overflow:x.documentOverflow})),
      report:path.join(outDir,'report.md'),
      json:path.join(outDir,'measurements.json')
    }));
    if(strict&&(failures.length||referenceOverflow.length||focusFailures.length))process.exitCode=1;
  } finally {
    await browser?.close();
    if(server)await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(err=>{console.error('CONSOLE_PARITY_ERROR',err);process.exitCode=1;});
