export const checkersUiParityCss=String.raw`
/* Warcaby owner console visual parity — no alterations to chess or checkers rules. */
/* Owner dark Szachy canvas #002529 (the existing chess boot/page ink), NOT the
   pale mint/light console variant previously copied here. Scope to Warcaby.
   Never change board geometry, the separate ivory control rail, or chat. */
html:root,
html:root.checkers-shell-loading,
body.warcaby-console.chess-console.cc-owner,
body.warcaby-console.chess-console.cc-owner.checkers-shell-loading,
body.warcaby-console.chess-console.cc-owner:not(.checkers-shell-loading){
 background:#002529!important;
}
body.warcaby-console.chess-console.cc-owner::before,
body.warcaby-console.chess-console.cc-owner::after{
 background:none!important;box-shadow:none!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus),
body.warcaby-console.chess-console.cc-owner #game.game-focus{
 background:#002529!important;border:0!important;border-radius:0!important;
 box-shadow:none!important;text-shadow:none!important;
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea,
body.warcaby-console.chess-console.cc-owner #game.game-focus>.boardarea{
 background:#002529!important;border:0!important;border-radius:0!important;box-shadow:none!important
}
@media(max-width:800px){
 html:root,
 html:root.checkers-shell-loading,
 body.warcaby-console.chess-console.cc-owner,
 body.warcaby-console.chess-console.cc-owner.checkers-shell-loading,
 body.warcaby-console.chess-console.cc-owner:not(.checkers-shell-loading),
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus),
 body.warcaby-console.chess-console.cc-owner #game.game-focus,
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea,
 body.warcaby-console.chess-console.cc-owner #game.game-focus>.boardarea{
  background:#002529!important
 }
}
body.warcaby-console.chess-console.cc-owner #game::before,
body.warcaby-console.chess-console.cc-owner #game::after{
 content:none!important;display:none!important;background:none!important;box-shadow:none!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea::before,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea::after{
 display:none!important;content:none!important
}
@media(min-width:801px){
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.cc-site-nav a{
  color:#164c50!important
 }
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.cc-site-nav a:hover{
  color:#057a7e!important;border-bottom-color:#057a7e!important
 }
}
body.warcaby-console #board .square{position:relative!important}
body.warcaby-console #board .checkers-coordinate,
body.warcaby-console .checkers-replay-board .checkers-coordinate{
 position:absolute!important;z-index:4!important;pointer-events:none!important;user-select:none!important;
 font:750 clamp(10px,1vw,13px)/1 system-ui,sans-serif!important;
 text-shadow:0 1px 1px #ffffff66!important
}
body.warcaby-console .checkers-coordinate-rank{top:3px!important;left:4px!important}
body.warcaby-console .checkers-coordinate-file{right:4px!important;bottom:3px!important}
body.warcaby-console .square.light .checkers-coordinate{color:#216363!important}
body.warcaby-console .square.dark .checkers-coordinate{color:#fff8e8!important;text-shadow:0 1px 2px #082b30cc!important}

/* Chess-style compact message bubbles. Only Warcaby, never Gomoku/chess. */
body.warcaby-console.chess-console.cc-owner #game #chat-messages{
 display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:8px!important;
}
body.warcaby-console.chess-console.cc-owner #game #chat-messages .game-chat-message{
 box-sizing:border-box!important;display:block!important;
 flex:0 0 auto!important;align-self:flex-start!important;
 width:fit-content!important;min-width:0!important;
 max-width:min(88%,calc(100% - 12px))!important;
 margin:0!important;overflow-wrap:anywhere!important;word-break:normal!important
}
body.warcaby-console.chess-console.cc-owner #game #chat-messages .game-chat-message.own{
 align-self:flex-start!important
}
/* White compose field at rest AND during mouse/keyboard focus.
   Remove only the inherited red focus ring; preserve a muted neutral border
   and a visible caret for keyboard users. */
body.warcaby-console.chess-console.cc-owner #game #chat-input,
body.warcaby-console.chess-console.cc-owner #game #chat-input:focus,
body.warcaby-console.chess-console.cc-owner #game #chat-input:focus-visible{
 background:#fff!important;color:#17383b!important;caret-color:#00595d!important;
 border:1px solid #a5b5b5!important;border-radius:8px!important;
 outline:none!important;outline-offset:0!important;box-shadow:none!important
}

/* The mandatory-capture notice was physically overlaying some landing squares.
   Keep its dismiss button usable while allowing drags through the notification. */
body.warcaby-console #checkers-capture-notice:not([hidden]){
 pointer-events:none!important
}
body.warcaby-console #checkers-capture-notice #checkers-capture-dismiss{
 pointer-events:auto!important
}
@media(min-width:801px){
 body.warcaby-console #checkers-capture-notice:not([hidden]){
  left:auto!important;right:12px!important;bottom:14px!important;
  transform:none!important;max-width:min(29vw,370px)!important
 }
}

/* No yellow frame on selected pawns. Keyboard focus remains a subtle accessible line.
   The allowed-move dots stay visible, including during a fast drag. */
body.warcaby-console.chess-console.cc-owner #board.checkers-grid .square.selected{
 box-shadow:none!important
}
body.warcaby-console.chess-console.cc-owner #board.checkers-grid .square:focus-visible{
 outline:1px solid #25898c!important;outline-offset:-1px!important
}
/* Pointer drag is visual only; rules are enforced by choose()/destinations(). */
body.warcaby-console.chess-console.cc-owner #board .square{
 touch-action:none!important
}
body.warcaby-console #board .square .piece{touch-action:none!important;user-select:none!important;-webkit-user-select:none!important}
body.warcaby-console #board .square.checkers-drag-source .piece{opacity:0!important}
body.warcaby-console.chess-console.cc-owner #board .square.checkers-drag-target{
 box-shadow:none!important
}
body.warcaby-console.chess-console.cc-owner #board .square.checkers-drag-target::before{
 content:""!important;position:absolute!important;z-index:2!important;
 width:25%!important;height:25%!important;background:#ffd06aaa!important;
 border-radius:50%!important;pointer-events:none!important
}
body.warcaby-console.chess-console.cc-owner #board .square.checkers-drag-hover{
 box-shadow:none!important;filter:brightness(1.08)!important
}
body.warcaby-console .checkers-drag-ghost{
 position:fixed!important;left:0;top:0;z-index:99999!important;visibility:visible!important;
 transform:translate(-50%,-50%)!important;pointer-events:none!important;
 width:clamp(32px,4vw,74px)!important;height:clamp(32px,4vw,74px)!important;
 margin:0!important;opacity:.92!important;filter:drop-shadow(0 4px 7px #0008)!important;
 will-change:left,top!important;touch-action:none!important
}
body.warcaby-console .checkers-drag-ghost .crown{pointer-events:none!important}

/* Same move history structure as chess: numbered rows, two columns and playback. */
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #moves-panel:not([hidden]){
 display:flex!important;flex-direction:column!important;min-height:0!important
}
body.warcaby-console.chess-console.cc-owner #game #moves-panel .checkers-history-columns{
 display:grid!important;grid-template-columns:36px repeat(2,minmax(0,1fr))!important;
 align-items:center!important;gap:0!important;min-height:29px!important;padding:0 8px!important;
 color:#f9ffff!important;background:#087579!important;font:750 12px/1.4 system-ui,sans-serif!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #moves-panel #moves-list.checkers-history-list{
 display:block!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;
 overflow-y:auto!important;max-height:none!important;margin:0!important;padding:0!important;
 background:#e6f2ef!important;list-style:none!important
}
body.warcaby-console.chess-console.cc-owner #moves-list .checkers-history-turn{
 display:grid!important;grid-template-columns:36px repeat(2,minmax(0,1fr))!important;
 align-items:stretch!important;min-height:38px!important;border-bottom:1px solid #c5dbd6!important;
 background:transparent!important
}
body.warcaby-console.chess-console.cc-owner #moves-list .checkers-history-turn:nth-child(even){background:#d9eae5!important}
body.warcaby-console.chess-console.cc-owner #moves-list .checkers-history-number{
 display:flex;align-items:center;padding:7px;color:#3e6666;font:700 12px/1.4 system-ui,sans-serif
}
body.warcaby-console.chess-console.cc-owner #moves-list .checkers-history-move{
 display:flex!important;align-items:center!important;min-height:35px!important;
 width:100%!important;margin:0!important;padding:5px 8px!important;
 background:transparent!important;border:0!important;border-radius:0!important;
 color:#173f42!important;font:650 13px/1.4 system-ui,sans-serif!important;
 text-align:left!important;cursor:pointer!important
}
body.warcaby-console.chess-console.cc-owner #moves-list .checkers-history-move:disabled{
 opacity:.6!important;cursor:default!important
}
body.warcaby-console.chess-console.cc-owner #moves-list .checkers-history-move[aria-current="step"]{
 background:#f3e5bd!important;color:#073f45!important;font-weight:800!important
}
body.warcaby-console.chess-console.cc-owner #moves-list .checkers-history-move:hover:not(:disabled){
 background:#cde4dd!important
}
body.warcaby-console.chess-console.cc-owner #moves-list .checkers-history-blank{display:block}
body.warcaby-console.chess-console.cc-owner #moves-panel .checkers-history-nav{
 box-sizing:border-box!important;display:grid!important;
 grid-template-columns:repeat(4,34px) minmax(0,1fr) 57px!important;
 align-items:center!important;gap:3px!important;min-height:44px!important;
 padding:4px!important;border-top:1px solid #c5dbd6!important;background:#d9eae5!important;
 flex:0 0 auto!important
}
body.warcaby-console.chess-console.cc-owner #moves-panel .checkers-history-action{
 display:flex!important;align-items:center!important;justify-content:center!important;
 min-height:34px!important;padding:4px!important;
 border:0!important;border-radius:7px!important;background:#b8d8d1!important;
 color:#0d4d50!important;font:750 14px/1 system-ui,sans-serif!important;cursor:pointer!important
}
body.warcaby-console.chess-console.cc-owner #moves-panel .checkers-history-action:disabled{
 opacity:.38!important;cursor:default!important
}
body.warcaby-console.chess-console.cc-owner #moves-panel .checkers-history-live{
 background:#08767a!important;color:#fff!important;font:750 11px/1 system-ui,sans-serif!important
}
body.warcaby-console.chess-console.cc-owner #moves-panel .checkers-history-nav-status{
 min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;
 color:#315f5f!important;text-align:center!important;font:650 11px/1.3 system-ui,sans-serif!important
}
body.warcaby-console.chess-console.cc-owner #moves-panel .checkers-history-empty{
 margin:10px!important;color:#335f60!important;font:600 13px/1.5 system-ui,sans-serif!important
}
body.warcaby-console.chess-console.cc-owner #moves-panel .history-footer{
 flex:0 0 auto!important;background:#e6f2ef!important;color:#315f5f!important
}
/* Read-only overlay: the active #board and all its original listeners are retained. */
body.warcaby-console #game .boardframe{position:relative!important}
body.warcaby-console .checkers-replay-board{
 position:absolute!important;inset:0!important;z-index:10!important;
 display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;
 grid-template-rows:repeat(8,minmax(0,1fr))!important;
 width:100%!important;height:100%!important;aspect-ratio:1!important;
 padding:0!important;margin:0!important;pointer-events:auto!important;
 border:0!important;box-shadow:none!important;overflow:hidden!important
}
body.warcaby-console .checkers-replay-board[hidden]{display:none!important}
body.warcaby-console .checkers-replay-board .square{
 position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;
 margin:0!important;padding:0!important;border:0!important;pointer-events:none!important
}
body.warcaby-console .checkers-replay-board .square.light{background:#e9dfcc!important}
body.warcaby-console .checkers-replay-board .square.dark{background:#3b8084!important}
body.warcaby-console .checkers-replay-board .square .piece{pointer-events:none!important}
body.warcaby-console .checkers-replay-board .piece .crown{pointer-events:none!important}

/* Identical compact mobile topbar structure to the current chess console. */
body.warcaby-console .checkers-mobile-heading{display:none}
@media(max-width:800px){
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea{padding:0!important;gap:10px!important}
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.cc-site-nav{display:none!important}
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.checkers-mobile-heading{
  box-sizing:border-box!important;display:flex!important;order:0!important;
  align-items:center!important;justify-content:space-between!important;
  position:relative!important;z-index:50!important;
  width:100%!important;min-height:60px!important;height:60px!important;
  padding:5px 9px!important;margin:0!important;gap:5px!important;
  background:#00595d!important;color:#fff!important;border:0!important;border-radius:0!important;
  box-shadow:none!important
 }
 body.warcaby-console .checkers-mobile-brand-line{
  display:flex;flex:1 1 auto;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden
 }
 body.warcaby-console .checkers-mobile-brand-icon{display:flex;color:#fff;flex:0 0 auto}
 body.warcaby-console .checkers-mobile-brand-icon svg{
  display:block;width:26px;height:26px;fill:currentColor
 }
 body.warcaby-console .checkers-mobile-brand-link{
  flex:0 1 auto;min-width:0;color:#fff!important;text-decoration:none!important;
  font:800 clamp(13px,3.8vw,19px)/1.1 system-ui,sans-serif!important;white-space:nowrap!important
 }
 body.warcaby-console .checkers-mobile-brand-divider{
  flex:0 0 1px;height:27px;margin:0 3px;background:#bde4e0
 }
 body.warcaby-console .checkers-mobile-game-name{
  color:#fff!important;font:700 clamp(13px,3.8vw,18px)/1.1 system-ui,sans-serif!important
 }
 body.warcaby-console .checkers-mobile-menu{position:static;flex:0 0 35px}
 body.warcaby-console .checkers-mobile-menu-toggle{
  display:flex;align-items:center;justify-content:center;box-sizing:border-box;
  height:40px;width:35px;cursor:pointer;list-style:none;color:#fff;background:transparent;border:0
 }
 body.warcaby-console .checkers-mobile-menu-toggle::-webkit-details-marker{display:none}
 body.warcaby-console .checkers-mobile-menu-toggle svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.5}
 body.warcaby-console .checkers-mobile-menu-panel{
  position:absolute;top:100%;right:5px;z-index:110;display:grid;min-width:190px;
  padding:4px;background:#06454b;border:1px solid #337e7c;box-shadow:0 4px 12px #002c3033
 }
 body.warcaby-console .checkers-mobile-menu:not([open]) .checkers-mobile-menu-panel{display:none!important}
 body.warcaby-console .checkers-mobile-menu-panel a{
  display:block;min-height:37px;padding:10px 12px;
  color:#fff!important;text-decoration:none;font:600 13px/1.3 system-ui,sans-serif
 }
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.arena{order:3!important}
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.side-dock{order:4!important}
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .boardframe{
  width:min(100%,calc(100dvw - 16px))!important
 }
 body.warcaby-console.chess-console.cc-owner #moves-panel .checkers-history-nav{
  grid-template-columns:repeat(4,30px) minmax(0,1fr) 53px!important
 }
}

/* Real colour-coded miniature checkers sit to the LEFT of the existing clock.
   Positioning is absolute: no reflow and no changes to the clock/card dimensions. */
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .checkers-clock-wrap{
 position:relative!important;display:inline-block!important;flex:0 0 auto!important;
 width:clamp(75.9px,6.6vw,99px)!important;max-width:100%!important;
 min-width:0!important;margin:0!important;padding:0!important;line-height:1!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .checkers-clock-wrap:has(>.player-clock[hidden]){
 display:none!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .checkers-clock-wrap>.player-clock{
 display:block!important;max-width:100%!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .checkers-turn-token{
 position:absolute!important;left:-19px!important;top:50%!important;
 transform:translateY(-50%)!important;width:15px!important;height:15px!important;
 box-sizing:border-box!important;flex:none!important;border-radius:50%!important;
 border:1px solid #617a7a!important;outline:2.5px solid transparent!important;outline-offset:2px!important;
 pointer-events:none!important;z-index:1!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .checkers-turn-token.white{
 background:radial-gradient(circle at 34% 28%,#fff 0%,#f0f2ec 62%,#b8c3c0 100%)!important;
 box-shadow:inset 0 1px 2px #fff!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .checkers-turn-token.black{
 background:radial-gradient(circle at 34% 28%,#555 0%,#252525 46%,#080808 100%)!important;
 box-shadow:inset 0 1px 2px #8886!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .checkers-turn-token.is-turn{
 outline-color:#087d7e!important
}
/* Only clock typography and names: preserve the original clock boxes and player card dimensions. */
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .player-clock{
 /* Retain the prior 3.3em box width and original digit line-box height as pixels,
    calculated from its unchanged previous font clamp(23px,2vw,30px). */
 width:clamp(75.9px,6.6vw,99px)!important;
 min-width:clamp(75.9px,6.6vw,99px)!important;
 min-height:clamp(26.15px,calc(2.1vw + 2px),33.5px)!important;
 font-size:clamp(21px,1.7vw,27px)!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top .players>.player>.cc-side{
 display:block!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:0!important;
 overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:center!important;
 color:var(--cc-ink)!important;text-shadow:none!important;
 font:600 11px/1.1 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
`;
export const checkersUiParityJs=String.raw`
/* Warcaby owner parity: strictly presentation. Original match, moves and AI stay authoritative. */
(()=>{
 const $=id=>document.getElementById(id);
 const layout=$('game'),board=$('board'),area=typeof layout?.querySelector==='function'?layout.querySelector(':scope > .boardarea'):null;
 const panel=$('moves-panel'),list=$('moves-list'),dock=$('match-panel');
 if(!layout||!board||!area||!panel||!list||!dock||layout.dataset.checkersUiParity==='yes')return;
 layout.dataset.checkersUiParity='yes';
 const E=(tag,className,value)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(value!==undefined)node.textContent=value;
  return node;
 };
 const svg=(html)=>{
  const node=document.createElementNS('http://www.w3.org/2000/svg','svg');
  node.setAttribute('viewBox','0 0 24 24');node.setAttribute('aria-hidden','true');
  node.innerHTML=html;return node;
 };

 // Approved chess mobile topbar: brand, game name and working menu. No duplicate inbox badge.
 const header=E('header','checkers-mobile-heading chess-mobile-heading');
 const brandLine=E('div','checkers-mobile-brand-line');
 const logo=E('span','checkers-mobile-brand-icon');
 logo.setAttribute('aria-hidden','true');
 logo.append(svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5" fill="none" stroke="#00595d" stroke-width="1.5"/>'));
 const brand=E('a','checkers-mobile-brand-link','GRACZ.PL');brand.href='https://gracz.pl/';
 const divider=E('span','checkers-mobile-brand-divider');divider.setAttribute('aria-hidden','true');
 const title=E('strong','checkers-mobile-game-name','Warcaby');
 brandLine.append(logo,brand,divider,title);
 const menu=E('details','checkers-mobile-menu');
 const summary=E('summary','checkers-mobile-menu-toggle');
 summary.setAttribute('aria-label','Otwórz menu Warcabów');
 summary.append(svg('<path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round"/>'));
 const links=E('nav','checkers-mobile-menu-panel');links.setAttribute('aria-label','Menu Warcabów');
 for(const [name,url] of [
  ['Strona główna','https://gracz.pl/'],['Wszystkie gry','https://gracz.pl/gry/'],
  ['Mój panel','/konto/panel/'],['Wiadomości','/konto/panel/?sekcja=messages']
 ]){
  const a=E('a','',name);a.href=url;links.append(a);
 }
 menu.append(summary,links);header.append(brandLine,menu);
 area.insertBefore(header,area.firstChild);
 document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&menu.open){menu.open=false;summary.focus({preventScroll:true});}
 });

 // Numbered Warcaby notation with the same move-review interaction pattern as chess.
 const cols=E('div','checkers-history-columns');
 cols.setAttribute('aria-label','Numer posunięcia, białe, czarne');
 for(const label of ['Nr','Białe','Czarne'])cols.append(E('span','',label));
 panel.insertBefore(cols,list);
 list.classList.add('checkers-history-list');
 const nav=E('nav','checkers-history-nav');
 nav.setAttribute('aria-label','Przeglądanie ruchów Warcabów');
 const buttons={};
 for(const [id,label,title] of [
  ['first','⏮','Pierwsza pozycja'],['prev','‹','Poprzedni ruch'],
  ['next','›','Następny ruch'],['last','⏭','Ostatni ruch'],
  ['live','Do gry','Powrót do bieżącej partii']
 ]){
  const button=E('button','checkers-history-action'+(id==='live'?' checkers-history-live':''),label);
  button.type='button';button.title=title;button.setAttribute('aria-label',title);
  button.addEventListener('click',()=>navigate(id));buttons[id]=button;nav.append(button);
 }
 const navStatus=E('span','checkers-history-nav-status');
 navStatus.setAttribute('role','status');
 nav.insertBefore(navStatus,buttons.live);
 const info=$('history-info');panel.insertBefore(nav,info);

 // Preview is an isolated read-only layer. Never swap or modify the real #board.
 const frame=board.closest('.boardframe');
 const replay=E('div','board checkers-grid checkers-replay-board');
 replay.hidden=true;replay.setAttribute('role','img');replay.setAttribute('aria-label','Podgląd poprzedniej pozycji Warcabów');
 frame?.append(replay);
 let entries=[],positions=[],review=-1,version=0,lastMode='',ready=false,seq=0;
 const rules=import('/konto/warcaby/rules.mjs').catch(()=>null);
 const coord=i=>'abcdefgh'[i%8]+String(8-Math.floor(i/8));
 function addCoords(cell,i,rotated){
  if(i%8===(rotated?7:0)){
   const rank=E('span','checkers-coordinate checkers-coordinate-rank',String(8-Math.floor(i/8)));
   rank.setAttribute('aria-hidden','true');cell.append(rank);
  }
  if(Math.floor(i/8)===(rotated?0:7)){
   const file=E('span','checkers-coordinate checkers-coordinate-file','abcdefgh'[i%8]);
   file.setAttribute('aria-hidden','true');cell.append(file);
  }
 }
 function paintPreview(position,ply){
  if(!frame||!position||!Array.isArray(position.board)||position.board.length!==64)return;
  const flipped=board.dataset.checkersRotated==='true';
  const fragment=document.createDocumentFragment();
  for(let slot=0;slot<64;slot++){
   const i=flipped?63-slot:slot;
   const cell=E('div','square '+((Math.floor(i/8)+i%8)%2?'dark':'light'));
   const piece=position.board[i];
   if(piece){
    const node=E('span','piece '+((piece%2)?'white':'black')+(piece>=3?' king':''));
    if(piece>=3){
     const crown=document.createElementNS('http://www.w3.org/2000/svg','svg');
     crown.setAttribute('class','crown');crown.setAttribute('viewBox','0 0 100 100');
     crown.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');
     use.setAttribute('href','#checkers-crown');crown.append(use);node.append(crown);
    }
    cell.append(node);
   }
   addCoords(cell,i,flipped);fragment.append(cell);
  }
  replay.replaceChildren(fragment);
  replay.hidden=false;
  replay.setAttribute('aria-label','Warcaby, pozycja po '+ply+' posunięciach. Podgląd tylko do odczytu.');
 }
 function updateState(){
  const max=entries.length;
  const canReplay=ready&&positions.length===max+1;
  for(const id of ['first','prev','next','last'])buttons[id].disabled=!canReplay||max===0||
   (review>=0&&(id==='first'&&review===0||id==='prev'&&review===0||
      id==='next'&&review===max||id==='last'&&review===max));
  buttons.live.disabled=review<0;
  navStatus.textContent=review>=0?'Pozycja '+review+' / '+max:!canReplay&&max>0?'Zapis ruchów':'Bieżąca partia';
  for(const button of list.querySelectorAll('button[data-ply]')){
   const isCurrent=review===Number(button.dataset.ply);
   button.classList.toggle('checkers-history-selected',isCurrent);
   if(isCurrent)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
   button.disabled=!canReplay;
  }
  if(review>=0&&canReplay)paintPreview(positions[review],review);
  else replay.hidden=true;
 }
 function show(ply){
  if(!ready||positions.length!==entries.length+1)return;
  if(!Number.isInteger(ply)||ply<0||ply>entries.length)return;
  review=ply;updateState();
 }
 function navigate(action){
  if(action==='live'){review=-1;updateState();return;}
  if(!entries.length||!ready)return;
  if(action==='first')show(0);
  if(action==='last')show(entries.length);
  if(action==='prev')show(Math.max(0,(review<0?entries.length:review)-1));
  if(action==='next')show(Math.min(entries.length,(review<0?entries.length:review)+1));
 }
 function renderRows(){
  const fragment=document.createDocumentFragment();
  if(!entries.length)fragment.append(E('p','checkers-history-empty','Wybierz pionek i rozpocznij partię.'));
  for(let n=0;n<Math.ceil(entries.length/2);n++){
   const row=E('div','checkers-history-turn');
   row.append(E('span','checkers-history-number',String(n+1)+'.'));
   for(let j=0;j<2;j++){
    const ply=2*n+j,move=entries[ply];
    if(!move){row.append(E('span','checkers-history-blank'));continue;}
    const label=coord(move.from)+'–'+coord(move.to);
    const btn=E('button','checkers-history-move',label);
    btn.type='button';btn.dataset.ply=String(ply+1);
    btn.setAttribute('aria-label',String(ply+1)+'. '+(move.player===1?'Białe':'Czarne')+' '+label+' — pokaż pozycję');
    btn.addEventListener('click',()=>show(ply+1));row.append(btn);
   }
   fragment.append(row);
  }
  list.replaceChildren(fragment);
  $('history-count').textContent=String(entries.length);
  updateState();
 }
 async function onHistory(event){
  const data=event?.detail;if(!data||!Array.isArray(data.moves))return;
  if(data.moves.length>2048)return;
  const safe=data.moves.map(m=>({
   player:Number(m.player),from:Number(m.from),to:Number(m.to)
  })).filter(m=>[1,2].includes(m.player)&&Number.isInteger(m.from)&&m.from>=0&&m.from<64&&
   Number.isInteger(m.to)&&m.to>=0&&m.to<64);
  if(safe.length!==data.moves.length)return;
  const currentSeq=++seq;
  const changed=safe.length!==entries.length||safe.some((x,i)=>x.from!==entries[i]?.from||
    x.to!==entries[i]?.to||x.player!==entries[i]?.player)||lastMode!==data.mode;
  entries=safe;lastMode=data.mode;version=Number(data.version)||0;
  if(changed){review=-1;ready=false;positions=[];}
  renderRows();
  if(!changed&&ready)return;
  const mod=await rules;
  if(seq!==currentSeq||!mod)return;
  try{
   const result=[mod.initialGame('warcaby')];
   for(const entry of safe){
    const previous=result.at(-1);
    const next=mod.playMove('warcaby',previous,entry.player,{from:entry.from,to:entry.to});
    if(!next||next.error||!next.state)throw Error('Incomplete match history');
    result.push(next.state);
   }
   if(seq!==currentSeq)return;
   positions=result;ready=true;
  }catch{
   // Partial server snapshots may contain only the latest history suffix.
   // Keep readable notation; do not invent or display a false board state.
   positions=[];ready=false;review=-1;
  }
  updateState();
 }
 window.addEventListener('gracz:warcaby:history',onHistory);
 renderRows();
})();
`;
