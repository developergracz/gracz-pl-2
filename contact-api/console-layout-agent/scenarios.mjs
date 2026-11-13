import {analyseChessStep} from './chess-contract.mjs';
/**
 * GRACZ.CONSOLE.PARITY — dynamic interaction scenarios (CONSOLE-INTERACTION-1TO1-03).
 *
 * The static pass in measure.mjs compares only the freshly loaded consoles.
 * This module replays the same user journey in Gomoku, Warcaby and Szachy and
 * measures getBoundingClientRect() three times for every step:
 *   before   — the stable view just before the click,
 *   after    — two animation frames after the click (catches layout flashes),
 *   settled  — once the console is quiet (AI reply, async lists, modals).
 *
 * Read-only: scenarios only click real controls. AI chat replies are served by
 * a local route mock so the check never calls GroqCloud or any account API.
 */

// Shared console chrome that must keep Gomoku geometry in every state.
export const SHARED_PARTS = [
  'console','sidebar','game-area','board-container','chat-dock','match-panel',
  'dock-tabs','chat-tab','moves-tab','bottom-bar','players','versus','quick-links',
  'game-state','toolbar','chat-compose','chat-input','chat-send','clock-black','clock-white',
  'config-card','config-tiles','focus-nav'
];
// Overlap pairs that must never occur in Warcaby or Szachy (absolute rule, any step).
// The restore button (config-fab) has a game-specific placement (Warcaby: right edge,
// e2e/warcaby-layout.browser.mjs), so it is checked for collisions, not for Gomoku equality.
const NO_OVERLAP = [
  ['nav','p1'],['nav','p2'],['nav','vs'],['nav','c1'],['nav','c2'],['nav','status'],
  ['fab','nav'],['fab','c1'],['fab','c2'],['fab','p1'],['fab','p2'],['fab','status'],
  ['p1','vs'],['p2','vs'],['p1','p2']
];
// Left-panel footer (Jak grać?, links, console configurator launcher): same size as
// Gomoku; its vertical position follows the game's own settings, but it must never
// jump more than the Gomoku footer does on the same click, nor leave the panel.
export const FOOTER_PARTS = ['sidebar-footer','config-open'];
// Parts that are allowed to resize together with sidebar content (training vs online etc.).
const SIDEBAR_CONTENT = [
  'sidebar-header','game-mode','training-button','online-button','training-options',
  'online-options','sidebar-footer','config-open'
];
const CHAT_CONTENT = ['chat-panel','chat-messages','mini-chat','chat-compose','chat-input','chat-send'];
const CLOCKS = ['clock-black','clock-white'];
// The board itself must not shrink or grow during ordinary clicks either.
const BOARD_PARTS = ['board-frame','game-board'];
export const JUMP_TOLERANCE = 2;

const AI_REPLY = 'GRACZ AI: to jest długa, testowa odpowiedź pomiarowa, która musi zawinąć się '+
  'wewnątrz czatu bez poszerzania panelu. '+'Bardzo_długie_słowo_bez_spacji_'.repeat(6)+
  ' Kolejne zdanie sprawdza przewijanie w obrębie listy wiadomości. '.repeat(4);

/* ------------------------------------------------------------------ helpers */

async function frames(page){
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
// Wait until the console stops mutating (ticking clocks are ignored).
async function quiet(page,{idle=320,max=6000}={}){
  await page.evaluate(({idle,max})=>new Promise(resolve=>{
    const root=document.body,start=performance.now();let last=performance.now();
    const ignore=n=>{for(let e=n.nodeType===1?n:n.parentElement;e;e=e.parentElement){
      if(e.classList?.contains('player-clock'))return true;
      if(e.id==='chess-invite-overlay'||e.id==='chess-invite-received')return false;
    }return false;};
    const obs=new MutationObserver(list=>{if(list.some(m=>!ignore(m.target)))last=performance.now();});
    obs.observe(root,{subtree:true,childList:true,attributes:true,characterData:true});
    const tick=()=>{const now=performance.now();
      if(now-last>=idle||now-start>=max){obs.disconnect();resolve();}else setTimeout(tick,60);};
    setTimeout(tick,60);
  }),{idle,max});
  await frames(page);
}
const visible=async (page,selector)=>page.evaluate(s=>{
  const el=document.querySelector(s);if(!el)return false;const r=el.getBoundingClientRect(),st=getComputedStyle(el);
  return r.width>0&&r.height>0&&st.visibility!=='hidden'&&st.display!=='none';
},selector);
async function clickIfVisible(page,selector){
  if(!await visible(page,selector))return false;
  await page.locator(selector).first().click({timeout:3000});
  return true;
}
// Make one legal human move with real pointer clicks (keeps user activation semantics).
async function humanMove(page,game){
  if(game==='gomoku'){
    const index=await page.evaluate(()=>{
      const cells=[...document.querySelectorAll('#board > .cell')];
      const prefer=[112,113,111,97,127,98,126,96,128,82,142];
      for(const i of prefer.concat(cells.map((_,i)=>i)))if(cells[i]&&!cells[i].classList.contains('occupied')&&!cells[i].disabled)return i;
      return -1;
    });
    if(index<0)return false;
    await page.locator('#board > .cell').nth(index).click();
    return true;
  }
  if(game==='warcaby'){
    const sources=await page.evaluate(()=>[...document.querySelectorAll('#board > .square')]
      .map((b,i)=>b.querySelector('.piece.white')?i:-1).filter(i=>i>=0).reverse());
    for(const from of sources){
      await page.locator('#board > .square').nth(from).click();
      const to=await page.evaluate(()=>[...document.querySelectorAll('#board > .square')].findIndex(b=>b.classList.contains('possible')));
      if(to>=0){await page.locator('#board > .square').nth(to).click();return true;}
    }
    return false;
  }
  const order=[52,51,53,50,54,49,55,48,57,62,58,61,59,60,56,63];
  for(const from of order){
    const ok=await page.evaluate(i=>{const c=document.querySelectorAll('#board > .chess-square')[i];
      return !!c&&c.classList.contains('white-piece')&&!c.disabled;},from);
    if(!ok)continue;
    await page.locator('#board > .chess-square').nth(from).click();
    const to=await page.evaluate(()=>[...document.querySelectorAll('#board > .chess-square')].findIndex(c=>c.classList.contains('chess-target')));
    if(to>=0){await page.locator('#board > .chess-square').nth(to).click();return true;}
  }
  return false;
}
async function sendChat(page,text){
  if(await page.locator('#chat-input').isDisabled())return false;
  await page.locator('#chat-input').fill(text);
  await page.locator('#chat-send').click();
  return true;
}
// Toggle a configurator tile by role. Gomoku and Warcaby render the 15 tile
// buttons; legacy chess layout tiles are matched by their data attribute.
async function toggleTile(page,key){
  const legacy={sidebar:'left',dock:'right'}[key];
  const selector=await page.evaluate(({key,legacy})=>{
    const tile=[...document.querySelectorAll('#console-config-tiles .console-config-tile')]
      .find(card=>card.dataset.part===key||card.querySelector('.console-tile-action')?.getAttribute('aria-label')?.match(key==='sidebar'?/Panel lewy/:/Panel prawy/));
    if(tile){tile.querySelector('.console-tile-action').setAttribute('data-agent-tile',key);return '[data-agent-tile="'+key+'"]';}
    const chess=document.querySelector('#console-config-tiles [data-chess-layout="'+legacy+'"]');
    if(chess){chess.setAttribute('data-agent-tile',key);return '[data-agent-tile="'+key+'"]';}
    return null;
  },{key,legacy});
  if(!selector)return false;
  await page.locator(selector).click();
  return true;
}
async function expandChessMoreIfNeeded(page){
  const details=page.locator('body.chess-console .chess-minimal-more');
  if(await details.count()&&!(await details.evaluate(el=>el.open)))await details.locator('summary').click();
}
async function closeDialogs(page){
  for(const s of ['#player-actions-close','#chess-invite-close','#chat-settings-close','#howto-close'])
    if(await clickIfVisible(page,s))return true;
  await page.keyboard.press('Escape'); // consoles without an invitation dialog only refocus a field
  return true;
}

/* --------------------------------------------------------------- scenarios */
/*
 * kind:
 *   click   — ordinary click: shared chrome must not jump (>2px) and must match Gomoku.
 *   state   — deliberate layout change (hide panel, focus, fullscreen): must match Gomoku.
 *   restore — leaves a deliberate state: must return to the initial geometry and match Gomoku.
 * allow: parts whose geometry legitimately follows the functional change.
 */
export const SCENARIOS = [
  {id:'move-1',label:'Pierwszy ruch gracza i odpowiedź komputera',kind:'click',run:(p,g)=>humanMove(p,g)},
  {id:'move-2',label:'Drugi ruch gracza',kind:'click',run:(p,g)=>humanMove(p,g)},
  {id:'move-3',label:'Trzeci ruch gracza',kind:'click',run:(p,g)=>humanMove(p,g)},
  {id:'tab-history',label:'Zakładka Historia ruchów',kind:'click',allow:CHAT_CONTENT,run:p=>p.locator('#history-tab').click()},
  {id:'tab-chat',label:'Powrót do zakładki Czat',kind:'click',allow:CHAT_CONTENT,run:p=>p.locator('#chat-tab').click()},
  {id:'chat-send',label:'Wiadomości i odpowiedzi GRACZ AI (×4)',kind:'click',run:async p=>{
    let sent=false;
    for(let i=0;i<4;i++){sent=await sendChat(p,'Wiadomość testowa '+(i+1)+' — '+'długi tekst gracza '.repeat(5))||sent;await quiet(p,{idle:200,max:2500});}
    return sent;
  }},
  {id:'undo',label:'Cofnięcie ruchu',kind:'click',run:async (p,g)=>p.locator(g==='warcaby'?'#checkers-refresh':'#undo-move').click()},
  {id:'undo-empty',label:'Kolejne cofnięcie (komunikat)',kind:'click',run:async (p,g)=>{
    await p.locator(g==='warcaby'?'#checkers-refresh':'#undo-move').click({force:true});
  }},
  {id:'restart',label:'Nowa rozgrywka',kind:'click',run:p=>p.locator('#restart').click()},
  {id:'ai-level',label:'Zmiana poziomu komputera',kind:'click',allow:['training-options'],run:p=>p.selectOption('#ai-level','expert')},
  {id:'time-unlimited',label:'Czas: bez limitu',kind:'click',allow:['training-options',...CLOCKS],run:p=>p.selectOption('#training-time','0')},
  {id:'time-bonus',label:'Czas 5 min + bonus 3 s',kind:'click',allow:['training-options',...CLOCKS],run:async p=>{
    await p.selectOption('#training-time','5');await quiet(p,{idle:150,max:1500});
    await expandChessMoreIfNeeded(p);await p.selectOption('#training-increment','3');
  }},
  {id:'online',label:'Przełączenie do gry online',kind:'click',allow:[...SIDEBAR_CONTENT,...CHAT_CONTENT,...CLOCKS],run:p=>p.locator('#online-mode').click()},
  {id:'online-time',label:'Ustawienie czasu pokoju online',kind:'click',allow:[...SIDEBAR_CONTENT,...CLOCKS],run:p=>p.selectOption('#create-room-time','10')},
  {id:'invite',label:'Otwarcie zaproszeń',kind:'click',allow:[...SIDEBAR_CONTENT],run:p=>p.locator('#invite-friend').click()},
  {id:'invite-close',label:'Zamknięcie zaproszeń',kind:'click',allow:[...SIDEBAR_CONTENT],run:p=>closeDialogs(p)},
  {id:'training',label:'Powrót do gry z komputerem',kind:'click',allow:[...SIDEBAR_CONTENT,...CHAT_CONTENT,...CLOCKS],run:p=>p.locator('#training-mode').click()},
  {id:'tooltip',label:'Tooltip ikon górnych i narzędzi',kind:'click',run:async p=>{
    if(await p.locator('.premium-quick-links > .premium-mini-link:visible').count()){
      await p.locator('.premium-quick-links > .premium-mini-link:visible').first().hover();await frames(p);
    }
    await p.locator('.side-dock .game-tools .tool-btn').first().hover();
  }},
  {id:'config-open',label:'Otwarcie konfiguratora',kind:'click',run:async p=>{await expandChessMoreIfNeeded(p);await p.locator('#console-config-open').click();}},
  {id:'hide-sidebar',label:'Ukrycie lewego panelu',kind:'state',run:p=>toggleTile(p,'sidebar')},
  {id:'hide-dock',label:'Ukrycie prawego panelu',kind:'state',run:p=>toggleTile(p,'dock')},
  {id:'show-dock',label:'Ponowne dodanie prawego panelu',kind:'state',run:p=>toggleTile(p,'dock')},
  {id:'show-sidebar',label:'Ponowne dodanie lewego panelu',kind:'restore',run:p=>toggleTile(p,'sidebar')},
  {id:'config-close',label:'Zamknięcie konfiguratora',kind:'restore',run:p=>p.locator('#console-config-done').click()},
  {id:'focus',label:'Tryb „Sama gra”',kind:'state',ownState:true,run:async p=>{await expandChessMoreIfNeeded(p);await p.locator('#focus-game').click();}},
  {id:'focus-exit',label:'Wyjście z trybu „Sama gra”',kind:'restore',run:p=>p.locator('#focus-exit').click()},
  {id:'fullscreen',label:'Pełny ekran (okno powiększone do ekranu)',kind:'state',ownState:true,run:async (p,g,ctx)=>{
    await p.locator('#fullscreen-game').click();
    await p.waitForFunction(()=>!!document.fullscreenElement,null,{timeout:3000}).catch(()=>{});
    // Real browsers enlarge the viewport to the screen when entering fullscreen.
    // Headless windows cannot be resized while fullscreen, so emulate the bigger viewport.
    const cdp=await p.context().newCDPSession(p);
    await cdp.send('Emulation.setDeviceMetricsOverride',{...ctx.fullscreenSize,deviceScaleFactor:1,mobile:false});
    await cdp.detach();
  }},
  {id:'fullscreen-exit',label:'Wyjście z pełnego ekranu',kind:'restore',run:async (p,g,ctx)=>{
    await p.evaluate(()=>document.fullscreenElement?document.exitFullscreen():null);
    await p.waitForFunction(()=>!document.fullscreenElement,null,{timeout:3000}).catch(()=>{});
    await p.setViewportSize(ctx.viewport);
  }},
  {id:'resize',label:'Zmiana szerokości okna i powrót',kind:'restore',run:async (p,g,ctx)=>{
    for(const width of ctx.resizeWidths){await p.setViewportSize({width,height:ctx.viewport.height});await quiet(p,{idle:120,max:1200});}
    await p.setViewportSize(ctx.viewport);
  }}
];

/* ---------------------------------------------------------------- analysis */

export async function dynamicProbe(page){
  return page.evaluate(OVERLAP_PAIRS=>{
    const out={fullscreenElement:document.fullscreenElement?(document.fullscreenElement===document.documentElement?'html':document.fullscreenElement.tagName.toLowerCase()+(document.fullscreenElement.className?'.'+[...document.fullscreenElement.classList].join('.'):'')):null};
    const layout=document.querySelector('.layout');
    out.layoutClasses=[...(layout?.classList||[])].filter(c=>c!=='layout');
    // Chat must wrap and scroll internally, never widen the dock.
    const box=document.getElementById('chat-messages'),dock=document.querySelector('.side-dock');
    if(box&&dock){
      const b=box.getBoundingClientRect(),d=dock.getBoundingClientRect();
      const wide=[...box.children].filter(c=>{const r=c.getBoundingClientRect();return r.width>0&&(r.right>b.right+1||r.left<b.left-1);}).length;
      out.chat={messages:box.children.length,scrollable:box.scrollHeight>box.clientHeight+1,overflowY:getComputedStyle(box).overflowY,
        horizontalOverflow:box.scrollWidth>box.clientWidth+1,widerChildren:wide,insideDock:b.width===0||(b.left>=d.left-1&&b.right<=d.right+1)};
    }
    // Controls hidden by a non-scrollable clipping ancestor (cut buttons/inputs).
    const clipped=[];
    const isScroll=v=>v==='auto'||v==='scroll';
    for(const el of document.querySelectorAll('.layout button, .layout select, .layout input, .layout a[href], .layout [role="tab"]')){
      const st=getComputedStyle(el),r=el.getBoundingClientRect();
      if(st.display==='none'||st.visibility==='hidden'||r.width===0||r.height===0||el.closest('[hidden]'))continue;
      if(el.closest('.sr-only'))continue;
      for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){
        const s=getComputedStyle(a);
        const clipX=s.overflowX!=='visible',clipY=s.overflowY!=='visible';
        if(!clipX&&!clipY)continue;
        const ar=a.getBoundingClientRect();
        const outX=clipX&&!isScroll(s.overflowX)&&(r.left<ar.left-2||r.right>ar.right+2);
        const outY=clipY&&!isScroll(s.overflowY)&&(r.top<ar.top-2||r.bottom>ar.bottom+2);
        if(outX||outY){
          clipped.push({control:el.id?'#'+el.id:(el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:el.tagName.toLowerCase()),
            by:a.id?'#'+a.id:'.'+(a.classList[0]||a.tagName.toLowerCase()),overflowPx:Math.round(Math.max(ar.left-r.left,r.right-ar.right,ar.top-r.top,r.bottom-ar.bottom))});
          break;
        }
        if(isScroll(s.overflowX)||isScroll(s.overflowY))break;
      }
    }
    out.clippedControls=clipped.slice(0,20);
    const board=document.getElementById('board')?.getBoundingClientRect();
    out.boardInViewport=!!board&&board.width>0&&board.left>=-2&&board.right<=innerWidth+2&&(innerWidth<=800||(board.top>=-2&&board.bottom<=innerHeight+2));
    const side=document.querySelector('.layout:not(.game-focus):not(.console-hide-sidebar) > .sidebar');
    if(side&&side.getClientRects().length){
      // How far the panel content (incl. the configurator launcher) runs past the visible panel.
      out.sidebar={scrollHeight:side.scrollHeight,clientHeight:side.clientHeight,overflowPx:Math.max(0,side.scrollHeight-side.clientHeight)};
    }
    const rectOf=sel=>{const e=document.querySelector(sel);if(!e||e.closest('[hidden]'))return null;
      const st=getComputedStyle(e),r=e.getBoundingClientRect();
      return st.display==='none'||st.visibility==='hidden'||r.width<=0||r.height<=0?null:{left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
    const R={nav:rectOf('.premium-quick-links'),p1:rectOf('.players .player.first'),p2:rectOf('.players .player.second'),
      vs:rectOf('.players .versus'),c1:rectOf('#clock-1'),c2:rectOf('#clock-2'),status:rectOf('#game-state'),
      fab:rectOf('#console-config-fab'),players:rectOf('.players')};
    const hit=(a,b)=>!!a&&!!b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    out.overlaps=OVERLAP_PAIRS.filter(([a,b])=>hit(R[a],R[b])).map(([a,b])=>a+'×'+b);
    // Whenever the players row is shown, the VS emblem must have a box between both cards.
    out.versusMissing=!!R.players&&!!R.p1&&!!R.p2&&!R.vs&&
      !(document.body.classList.contains('chess-console')&&layout?.dataset.referenceLayout==='yes'&&!layout.classList.contains('game-focus'));
    out.clockOutsideCard=[['c1','p1'],['c2','p2']].filter(([c,p])=>R[c]&&R[p]&&(R[c].left<R[p].left-1||R[c].right>R[p].right+1)).map(([c])=>c);
    out.modal=[...document.querySelectorAll('[role="dialog"],.premium-modal,.chess-invite-overlay,#console-config-modal,#player-actions-modal')]
      .filter(m=>!m.hidden&&m.getClientRects().length&&getComputedStyle(m).display!=='none').map(m=>m.id||m.className).slice(0,4);
    return out;
  },NO_OVERLAP);
}

function rectDelta(a,b,props){
  const delta={};
  for(const k of props){const v=Math.round((b[k]-a[k])*100)/100;if(Math.abs(v)>JUMP_TOLERANCE)delta[k]=v;}
  return delta;
}
function partDeltas(from,to,names,props){
  const out=[];
  for(const name of names){
    const a=from.parts[name],b=to.parts[name];
    if(!a?.visible||!b?.visible)continue;
    const delta=rectDelta(a.rect,b.rect,props);
    if(Object.keys(delta).length)out.push({part:name,from:a.rect,to:b.rect,delta});
  }
  return out;
}
function visibilityChanges(from,to,names){
  return names.filter(n=>!!from.parts[n]?.visible!==!!to.parts[n]?.visible)
    .map(n=>({part:n,before:!!from.parts[n]?.visible,after:!!to.parts[n]?.visible}));
}
// A jump is accepted only where the Gomoku reference performs the same jump.
function unexplained(target,reference){
  return target.filter(t=>{
    const r=reference.find(x=>x.part===t.part);
    if(!r)return true;
    return ['x','y','width','height'].some(k=>Math.abs((t.delta[k]??0)-(r.delta[k]??0))>JUMP_TOLERANCE);
  });
}

// Footer may follow the game's own settings height, but never jump more than Gomoku's.
function footerJumps(target,reference,mobile){
  const out=[];
  for(const name of FOOTER_PARTS){
    const a=target.before.parts[name],b=target.settled.parts[name];
    const ra=reference?.before.parts[name],rb=reference?.settled.parts[name];
    if(!a?.visible||!b?.visible)continue;
    const dy=b.rect.y-a.rect.y,ry=ra?.visible&&rb?.visible?rb.rect.y-ra.rect.y:0;
    const other=['x','width','height'].filter(k=>!mobile||k!=='height').some(k=>Math.abs(b.rect[k]-a.rect[k])>JUMP_TOLERANCE);
    if(other||(!mobile&&Math.abs(dy)>Math.abs(ry)+JUMP_TOLERANCE))
      out.push({part:name,from:a.rect,to:b.rect,delta:{y:Math.round(dy*100)/100,referenceY:Math.round(ry*100)/100}});
  }
  return out;
}

export function analyseStep({step,viewport,game,mobile,records,reference,initial,referenceInitial}){
  if(game==='szachy')return analyseChessStep({step,viewport,records,initial,reference});
  const props=mobile?['x','width']:['x','y','width','height'];
  const checked=SHARED_PARTS.concat(BOARD_PARTS).filter(p=>!(step.allow||[]).includes(p));
  const result={id:step.id,label:step.label,kind:step.kind,game,viewport,performed:records.performed,error:records.error};
  const issues=[];
  if(!records.performed)issues.push('akcja niedostępna w tej konsoli'+(records.error?' ('+records.error+')':''));
  if(step.kind==='click'){
    const after=partDeltas(records.before,records.after,checked,props);
    const settled=partDeltas(records.before,records.settled,checked,props);
    result.jumpAfter=after;result.jumpSettled=settled;
    if(reference){
      const refAfter=partDeltas(reference.before,reference.after,checked,props);
      const refSettled=partDeltas(reference.before,reference.settled,checked,props);
      result.unexplainedAfter=unexplained(after,refAfter);
      result.unexplainedSettled=unexplained(settled,refSettled);
      if(result.unexplainedAfter.length)issues.push('skok tuż po kliknięciu: '+result.unexplainedAfter.map(d=>d.part).join(', '));
      if(result.unexplainedSettled.length)issues.push('skok po ustabilizowaniu: '+result.unexplainedSettled.map(d=>d.part).join(', '));
    } else {
      result.unexplainedAfter=after;result.unexplainedSettled=settled;
    }
    result.footerJumps=footerJumps(records,reference,mobile);
    if(reference&&result.footerJumps.length)issues.push('stopka lewego panelu przesuwa się bardziej niż w Gomoku: '+result.footerJumps.map(d=>d.part+' Δy='+d.delta.y+' (Gomoku '+d.delta.referenceY+')').join(', '));
    // Clock visibility is a game function (e.g. chess shows ∞ / room preview), not layout.
    const visParts=checked.filter(p=>!CLOCKS.includes(p));
    const vis=visibilityChanges(records.before,records.settled,visParts);
    const refVis=reference?visibilityChanges(reference.before,reference.settled,visParts):[];
    result.visibility=vis.filter(v=>!refVis.some(r=>r.part===v.part&&r.after===v.after));
    if(reference&&result.visibility.length)issues.push('zmiana widoczności inna niż w Gomoku: '+result.visibility.map(v=>v.part+(v.after?'+':'-')).join(', '));
  }
  if(step.kind==='restore'&&initial){
    const names=SHARED_PARTS.concat(BOARD_PARTS,FOOTER_PARTS);
    result.restore=partDeltas(initial,records.settled,names,props);
    if(referenceInitial){
      const ref=partDeltas(referenceInitial,reference.settled,names,props);
      result.restore=unexplained(result.restore,ref);
    }
    if(result.restore.length)issues.push('brak powrotu do geometrii początkowej: '+result.restore.map(d=>d.part).join(', '));
  }
  // Gomoku's "Sama gra"/fullscreen is its own Gomoku-only board-only view (gomoku-board-only,
  // never applied to Warcaby/Szachy), i.e. a different functional state: no 1:1 comparison there.
  const sameState=!step.ownState;
  if(reference&&game!=='gomoku'&&sameState){
    // Same functional state, same viewport: shared chrome must match Gomoku.
    // A fixed 100dvh composition (focus) compares y/height on phones too.
    const fixed=records.settledProbe.layoutClasses?.includes('game-focus')&&reference.settledProbe.layoutClasses?.includes('game-focus');
    const refProps=fixed?['x','y','width','height']:props;
    // Where Gomoku itself floats its top navigation over a player card or clock (hidden-dock
    // preset), its navigation position is not a valid reference; the status row sharing the
    // navigation track keeps x, y and height. Collisions are checked separately below.
    const refDefect=(reference.settledProbe.overlaps||[]).some(o=>o.startsWith('nav×')&&o!=='nav×status');
    result.referenceDefect=refDefect?reference.settledProbe.overlaps:undefined;
    const parts=SHARED_PARTS.filter(p=>!(refDefect&&(p==='quick-links'||p==='game-state')));
    result.reference=partDeltas(reference.settled,records.settled,parts,refProps)
      .concat(refDefect?partDeltas(reference.settled,records.settled,['game-state'],mobile?['x']:['x','y','height']):[])
      .concat(partDeltas(reference.settled,records.settled,FOOTER_PARTS,mobile?['x','width']:['x','width','height']));
    if(result.reference.length)issues.push('odchylenie od Gomoku: '+result.reference.map(d=>d.part).join(', '));
    const keys=SHARED_PARTS.filter(p=>!CLOCKS.includes(p)).concat(FOOTER_PARTS);
    const refShown=keys.filter(k=>reference.settled.parts[k]?.visible&&!records.settled.parts[k]?.visible);
    const extra=keys.filter(k=>!reference.settled.parts[k]?.visible&&records.settled.parts[k]?.visible);
    result.missingVsReference=refShown;result.extraVsReference=extra;
    if(refShown.length)issues.push('widoczne w Gomoku, ukryte tutaj: '+refShown.join(', '));
    if(extra.length)issues.push('ukryte w Gomoku, widoczne tutaj: '+extra.join(', '));
  }
  if(reference&&game!=='gomoku'){
    const fs=reference.settledProbe.fullscreenElement,fsHere=records.settledProbe.fullscreenElement;
    if(fs!==fsHere)issues.push('inny element pełnego ekranu ('+fsHere+' zamiast '+fs+')');
    // Desktop: controls pushed out of the left panel where Gomoku keeps them in view.
    const side=records.settledProbe.sidebar,refSide=reference.settledProbe.sidebar;
    if(!mobile&&side&&refSide&&side.overflowPx>JUMP_TOLERANCE&&side.overflowPx>refSide.overflowPx+JUMP_TOLERANCE)
      issues.push('lewy panel wypycha kontrolki poza widok ('+side.overflowPx+'px, Gomoku '+refSide.overflowPx+'px)');
  }
  const s=records.settled;
  if(s.documentOverflow)issues.push('poziome przewijanie dokumentu ('+s.documentScrollWidth+'px)');
  const board=s.parts['game-board']?.rect;
  const square=board&&board.width>=80&&Math.abs(board.width-board.height)<=2;
  if(game!=='gomoku'&&!square)issues.push('plansza nie jest kwadratowa lub zwinięta');
  if(!records.settledProbe.boardInViewport)issues.push('plansza nie jest w pełni widoczna');
  if(game!=='gomoku'){
    const pr=records.settledProbe;
    if(pr.overlaps?.length)issues.push('nakładające się elementy: '+pr.overlaps.join(', '));
    if(pr.versusMissing)issues.push('znacznik VS bez pudełka przy widocznym pasku graczy');
    if(pr.clockOutsideCard?.length)issues.push('zegar wystaje poza kartę gracza: '+pr.clockOutsideCard.join(', '));
    if(step.ownState&&step.id==='focus'){
      const g=s.parts;
      if(!pr.layoutClasses?.includes('game-focus'))issues.push('tryb „Sama gra” nie został włączony');
      if(g.sidebar?.visible||g['chat-dock']?.visible)issues.push('w trybie „Sama gra” widoczny jest boczny panel');
    }
  }
  result.overlaps=records.settledProbe.overlaps;
  const chat=records.settledProbe.chat;
  if(chat&&(chat.horizontalOverflow||chat.widerChildren||!chat.insideDock))issues.push('wiadomości czatu wychodzą poza panel');
  const refClipped=new Set((reference?.settledProbe.clippedControls||[]).map(c=>c.control));
  result.clipped=records.settledProbe.clippedControls.filter(c=>!refClipped.has(c.control));
  if(result.clipped.length)issues.push('obcięte kontrolki: '+result.clipped.map(c=>c.control+' przez '+c.by+' ('+c.overflowPx+'px)').join(', '));
  result.chat=chat;result.fullscreenElement=records.settledProbe.fullscreenElement;
  result.sidebar=records.settledProbe.sidebar;
  result.layoutClasses=records.settledProbe.layoutClasses;
  // Compact settled geometry of the shared chrome for the evidence JSON.
  result.geometry=Object.fromEntries(SHARED_PARTS.concat(BOARD_PARTS,SIDEBAR_CONTENT).map(n=>{
    const r=records.settled.parts[n]?.rect;return [n,r?[r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10):null];
  }));
  result.issues=issues;result.pass=!issues.length;
  return result;
}

export async function runScenarios({page,game,viewport,snapshot,onStep}){
  const ctx={
    viewport,
    fullscreenSize:viewport.width>800?{width:viewport.width,height:viewport.height+Math.round(viewport.height*0.1)}:{width:viewport.width,height:viewport.height+56},
    resizeWidths:viewport.width>800?[Math.max(801,viewport.width-260),viewport.width+120]:[Math.max(320,viewport.width-55),Math.min(800,viewport.width+40)]
  };
  await page.route('**/ai-chat',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,answer:AI_REPLY})}));
  await quiet(page);
  const initial=await snapshot(page);
  const initialProbe=await dynamicProbe(page);
  const steps=[];
  for(const step of SCENARIOS){
    const before=await snapshot(page);
    let performed=true,error=null;
    try{const r=await step.run(page,game,ctx);if(r===false)performed=false;}
    catch(e){performed=false;error=String(e.message||e).split('\n')[0];}
    await frames(page);
    const after=await snapshot(page);
    await quiet(page);
    const settled=await snapshot(page);
    const settledProbe=await dynamicProbe(page);
    const record={step,before,after,settled,settledProbe,performed,error};
    steps.push(record);
    await onStep?.(record);
  }
  return {initial,initialProbe,steps};
}
