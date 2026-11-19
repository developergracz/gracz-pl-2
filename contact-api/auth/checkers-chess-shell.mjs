export const checkersChessShellCss=String.raw`
/* Warcaby in the owner's chess console. Chess game and checkers engine stay isolated. */
/* Modern Warcaby: both announcements fill the chat content region, not the board. */
body.warcaby-console.chess-console.cc-owner #chat-panel{
 position:relative!important;
}
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-color-confirmation:not([hidden]),
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-capture-notice:not([hidden]){
 position:absolute!important;inset:0!important;left:0!important;right:0!important;
 top:0!important;bottom:0!important;transform:none!important;box-sizing:border-box!important;
 width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;
 margin:0!important;padding:18px 20px!important;border:0!important;border-radius:12px!important;
 display:flex!important;align-items:center!important;justify-content:center!important;
 text-align:center!important;flex-wrap:wrap!important;gap:12px!important;
 background:#006e71!important;color:#fff!important;box-shadow:none!important;
 overflow:auto!important;backdrop-filter:none!important;
}
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-color-confirmation:not([hidden]){
 z-index:3!important;pointer-events:none!important;font:800 clamp(17px,1.5vw,21px)/1.45 system-ui,sans-serif!important;
}
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-capture-notice:not([hidden]){
 z-index:4!important;pointer-events:auto!important;align-content:center!important;
}
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-capture-notice .capture-notice-icon{
 color:#fff!important;background:#005c60!important;border:1px solid #8de1d7!important;
}
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-capture-notice .capture-notice-copy{
 flex:0 1 100%!important;min-width:0!important;text-align:center!important;
}
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-capture-notice .capture-notice-copy strong{
 color:#fff!important;font:800 clamp(18px,1.6vw,22px)/1.3 system-ui,sans-serif!important;
}
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-capture-notice .capture-notice-copy p{
 color:#fff!important;font:600 clamp(13px,1.2vw,16px)/1.5 system-ui,sans-serif!important;margin:8px 0 0!important;
}
/* The capture instruction must remain until the mandatory capture is played. */
body.warcaby-console.chess-console.cc-owner #chat-panel #checkers-capture-dismiss{display:none!important}
/* The two numerals progress from muted red at 00:30 to pure red at 00:01. */
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top #clock-1.checkers-clock-critical,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .cc-top #clock-2.checkers-clock-critical,
body.warcaby-console.chess-console.cc-owner #clock-1.checkers-clock-critical,
body.warcaby-console.chess-console.cc-owner #clock-2.checkers-clock-critical{
 color:var(--checkers-clock-shade,#5f2b32)!important;
 transition:color .2s linear;
 transform-origin:center;
}
body.warcaby-console .checkers-clock-pulse-twice{
 animation:checkers-clock-double-pulse 1s ease-in-out 1;
}
body.warcaby-console .checkers-clock-pulse-once{
 animation:checkers-clock-single-pulse .56s ease-in-out 1;
}
@keyframes checkers-clock-double-pulse{
 0%,35%,70%,100%{transform:scale(1);text-shadow:none}
 18%,53%{transform:scale(1.16);text-shadow:0 0 7px currentColor}
}
@keyframes checkers-clock-single-pulse{
 0%,100%{transform:scale(1);text-shadow:none}
 50%{transform:scale(1.16);text-shadow:0 0 7px currentColor}
}
@media(prefers-reduced-motion:reduce){
 body.warcaby-console .checkers-clock-pulse-twice,
 body.warcaby-console .checkers-clock-pulse-once{animation:none!important}
}
/* Seat-to-play dialog is independent of board and clock geometry. */
body.warcaby-console .checkers-newgame-blocker[hidden]{display:none!important}
body.warcaby-console .checkers-newgame-blocker{
 position:fixed;inset:0;z-index:100120;display:grid;place-items:center;
 padding:18px;background:rgba(0,25,30,.77)
}
body.warcaby-console .checkers-newgame-card{
 width:min(470px,100%);box-sizing:border-box;padding:28px 24px;
 border-radius:18px;border:1px solid #d8c9a9;
 background:#fff8ea;color:#073f43;text-align:center;
 box-shadow:0 22px 75px #00191e8c;font:15px/1.6 system-ui,sans-serif
}
body.warcaby-console .checkers-newgame-card h2{
 margin:0 0 12px;font:800 23px/1.3 system-ui,sans-serif;color:#073f43
}
body.warcaby-console .checkers-newgame-card p{margin:0 0 24px;font-weight:650}
body.warcaby-console .checkers-newgame-close{
 min-height:42px;border:0;border-radius:9px;padding:9px 28px;
 background:#006d6c;color:#fff;font:750 14px system-ui,sans-serif;cursor:pointer
}
body.warcaby-console .checkers-newgame-close:focus-visible{outline:3px solid #eaa83a;outline-offset:3px}
body.warcaby-console.chess-console.cc-owner .checkers-color-confirmation[hidden]{display:none!important}
body.warcaby-console.chess-console.cc-owner .checkers-color-confirmation:not([hidden]){
 position:fixed;z-index:100011;left:50%;bottom:clamp(20px,6vh,60px);
 transform:translateX(-50%);width:max-content;max-width:calc(100vw - 32px);
 box-sizing:border-box;padding:11px 20px;border-radius:12px;border:1px solid #a5d6d1;
 box-shadow:0 8px 25px #001e233d;background:#075c5f;color:white;
 font:700 14px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;
 pointer-events:none;text-align:center
}

body.warcaby-console.chess-console.cc-owner .checkers-start-colors{
 display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:12px
}
body.warcaby-console.chess-console.cc-owner .checkers-start-colors button{
 display:flex;flex-direction:column;align-items:center;justify-content:center;
 gap:9px;min-height:104px;border:1px solid #d2c2a2;border-radius:12px;
 background:#f2e9d6;color:#103f43;cursor:pointer;
 font:750 15px system-ui,-apple-system,'Segoe UI',sans-serif
}
body.warcaby-console.chess-console.cc-owner .checkers-start-colors button:hover{
 border-color:#087d7e;background:#e3f1ed
}
body.warcaby-console.chess-console.cc-owner .checkers-start-colors button:focus-visible{
 outline:3px solid #087d7e;outline-offset:2px
}
body.warcaby-console.chess-console.cc-owner .checkers-choice-pawn{
 display:block;width:48px;height:48px;box-sizing:border-box;border-radius:50%;
 border:3px solid #7c9999;
 box-shadow:0 3px 6px #002e3036,inset 0 0 0 5px #ffffff55,inset 0 0 0 7px #496e6e66
}
body.warcaby-console.chess-console.cc-owner .checkers-choice-pawn.white{
 background:radial-gradient(circle at 35% 26%,#fff 0%,#f1f4f2 58%,#c1cecc 100%)
}
body.warcaby-console.chess-console.cc-owner .checkers-choice-pawn.black{
 background:radial-gradient(circle at 35% 26%,#555 0%,#252626 54%,#0a0b0d 100%);
 border-color:#45585b;box-shadow:0 3px 6px #002e3036,inset 0 0 0 5px #9db5b522,inset 0 0 0 7px #293536
}

body.warcaby-console.chess-console.cc-owner .checkers-start-gate[hidden]{display:none!important}
body.warcaby-console.chess-console.cc-owner .checkers-start-gate:not([hidden]){
 position:fixed;inset:0;z-index:100010;display:grid;place-items:center;
 padding:16px;box-sizing:border-box;background:rgba(0,23,26,.58);
}
body.warcaby-console.chess-console.cc-owner .checkers-start-card{
 width:min(440px,100%);max-height:calc(100dvh - 32px);overflow:auto;
 box-sizing:border-box;border:1px solid #d3c6a6;border-radius:18px;
 background:#fff7e7;color:#0a3a3d;
 box-shadow:0 20px 60px rgba(0,17,20,.38);padding:clamp(22px,4vw,36px);
 text-align:center;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
}
body.warcaby-console.chess-console.cc-owner .checkers-start-card h2{
 margin:0 0 12px;font-weight:800;font-size:clamp(19px,2.6vw,26px);line-height:1.25;
}
body.warcaby-console.chess-console.cc-owner .checkers-start-card p{
 margin:0 0 22px;font-weight:450;font-size:14px;line-height:1.55;color:#375556;
}
body.warcaby-console.chess-console.cc-owner #checkers-start-button{
 min-height:44px;padding:12px 24px;border:0;border-radius:10px;
 background:#006d71;color:#fff;font:750 15px system-ui,-apple-system,'Segoe UI',sans-serif;
 cursor:pointer;
}
body.warcaby-console.chess-console.cc-owner #checkers-start-button:hover{background:#005b5e}
body.warcaby-console.chess-console.cc-owner #checkers-start-button:focus-visible{
 outline:2px solid #083c42;outline-offset:3px
}

html:root.checkers-shell-loading,body.warcaby-console.checkers-shell-loading{background:#002529!important}
body.warcaby-console.checkers-shell-loading>#game{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
body.warcaby-console #checkers-shell-fallback{display:none!important}
body.warcaby-console.checkers-shell-loading #checkers-shell-fallback{
 position:fixed;inset:0;z-index:10000;display:flex!important;align-items:center;justify-content:center;
 visibility:visible!important;opacity:0;animation:checkers-shell-timeout 1ms steps(1,end) 12s forwards;
 padding:20px;background:#002529;color:#f8f4e6;font:600 16px/1.45 system-ui,sans-serif;text-align:center
}
@keyframes checkers-shell-timeout{to{opacity:1}}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus){
 display:block!important;box-sizing:border-box!important;width:100%!important;max-width:none!important;
 min-height:100dvh!important;height:100dvh!important;overflow:hidden!important;background:#002529!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea{
 display:grid!important;box-sizing:border-box!important;width:100%!important;height:100%!important;
 min-height:0!important;margin:0!important;max-width:none!important;overflow:hidden!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.sidebar{display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.players,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.premium-quick-links,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.state,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.bottom{display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.arena{
 display:flex!important;min-width:0!important;min-height:0!important;align-items:stretch!important;justify-content:center!important;
 width:100%!important;height:100%!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .board-center{
 display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;
 width:100%!important;height:100%!important;max-width:none!important;min-width:0!important;min-height:0!important;
 margin:0!important;padding:0!important;box-sizing:border-box!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .boardtop{display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .boardframe{
 flex:0 1 auto!important;aspect-ratio:1!important;width:100%!important;max-width:100%!important;height:auto!important;
 max-height:100%!important;min-width:0!important;margin:0 auto!important;padding:0!important;
 border:0!important;border-radius:0!important;box-shadow:none!important;overflow:hidden!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #board.checkers-grid{
 width:100%!important;height:100%!important;aspect-ratio:1!important;margin:0!important;padding:0!important;
 border:0!important;border-radius:0!important;box-shadow:none!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.sidebar{
 display:block!important;position:static!important;flex:0 0 auto!important;order:1!important;
 width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;
 margin:0!important;padding:0!important;background:none!important;border:0!important;box-shadow:none!important;
 overflow:visible!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.sidebar>*:not(.mode){display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus):not(.console-hide-mode) .side-dock .checkers-owner-mode{
 display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;
 margin:0!important;padding:4px!important;border:1px solid var(--cc-line)!important;
 border-radius:15px!important;background:var(--cc-soft)!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .checkers-owner-mode>.mode-choice{
 display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;
 height:48px!important;min-height:48px!important;min-width:0!important;margin:0!important;padding:2px 2px!important;
 color:var(--cc-ink)!important;background:transparent!important;border:0!important;border-radius:10px!important;
 box-shadow:none!important;font:700 11px/1.1 system-ui,sans-serif!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .checkers-owner-mode>.mode-choice.active{
 background:var(--cc-accent)!important;color:#fff!important
}
/* Bot mode runs on the Computer engine, but only the selected UI button is highlighted. */
body.warcaby-console.chess-console.cc-owner[data-checkers-bot-selected="true"] #game:not(.game-focus) .checkers-owner-mode>#training-mode.mode-choice.active,
body.warcaby-console.chess-console.cc-owner[data-checkers-bot-selected="true"] #game:not(.game-focus) .checkers-owner-mode>#online-mode.mode-choice.active{
 background:transparent!important;color:var(--cc-ink)!important
}
body.warcaby-console.chess-console.cc-owner .checkers-owner-mode .cc-mode-label{font:inherit;white-space:normal;text-align:center;overflow-wrap:normal}
body.warcaby-console.chess-console.cc-owner .checkers-owner-mode svg{width:17px;height:17px;flex:0 0 auto;stroke:currentColor;fill:none;stroke-width:1.7}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .checkers-owner-mode>.mode-choice:focus-visible{outline:2px solid var(--cc-accent)!important;outline-offset:-3px!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .checkers-owner-mode>.mode-choice:hover:not(.active){background:var(--cc-surface)!important}
@media(max-width:380px){
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .checkers-owner-mode>.mode-choice{font-size:11px!important}
 body.warcaby-console.chess-console.cc-owner .checkers-owner-mode svg{width:17px;height:17px}
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.cc-top .players{display:grid!important;position:static!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.cc-top .players .player .cc-side{
 display:block;font-size:13px;font-weight:650;color:var(--cc-ink)
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.cc-top .players .player strong:not(.player-clock){
 position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.cc-top .player-clock{
 display:block!important;font-variant-numeric:tabular-nums;font-weight:800!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.cc-top .player-clock[hidden]{display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions{
 display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;order:2!important;
 padding:5px 0!important;margin:0!important;gap:0!important;border:0!important;box-shadow:none!important;background:none!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .checkers-owner-action{
 display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
 min-width:0;gap:5px;padding:8px 2px;border:0;border-right:1px solid var(--cc-line);background:none;
 color:var(--cc-ink);font:650 13px/1.2 system-ui,sans-serif;cursor:pointer
}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-action:last-child{border-right:0}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-action svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-action:disabled{opacity:.42;cursor:not-allowed}
/* Split only the fourth existing action column: Cofnij above Remis. */
body.warcaby-console.chess-console.cc-owner #game .checkers-undo-draw{
 display:grid;grid-template-rows:1fr 1fr;min-width:0;min-height:0
}
body.warcaby-console.chess-console.cc-owner #game .checkers-undo-draw .checkers-owner-action{
 display:flex!important;flex-direction:row!important;gap:4px!important;
 padding:3px 1px!important;border:0!important;font-size:11px!important;min-height:28px
}
body.warcaby-console.chess-console.cc-owner #game .checkers-undo-draw .checkers-owner-action+.checkers-owner-action{
 border-top:1px solid var(--cc-line)!important
}
body.warcaby-console.chess-console.cc-owner #game .checkers-undo-draw .checkers-owner-action svg{
 width:17px!important;height:17px!important;flex:none!important
}
body.warcaby-console.chess-console.cc-owner #game .checkers-draw-banner:not([hidden]){
 order:3;display:grid;gap:5px;padding:7px 10px;border:1px solid var(--cc-line);
 border-radius:8px;background:var(--cc-soft);color:var(--cc-ink);font:600 12px/1.3 system-ui,sans-serif
}
body.warcaby-console.chess-console.cc-owner #game .checkers-draw-banner[hidden]{display:none!important}
body.warcaby-console.chess-console.cc-owner #game .checkers-draw-banner .checkers-draw-choices{display:flex;gap:6px}
body.warcaby-console.chess-console.cc-owner #game .checkers-draw-banner .checkers-draw-choices[hidden]{display:none!important}
body.warcaby-console.chess-console.cc-owner #game .checkers-draw-banner button{
 flex:1;min-height:30px;border:1px solid var(--cc-line);border-radius:6px;
 background:var(--cc-bg);color:var(--cc-ink);font:700 12px system-ui,sans-serif;cursor:pointer
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.checkers-owner-status{
 order:3!important;min-height:0!important;margin:0!important;padding:4px 2px!important;
 background:transparent!important;border:0!important;box-shadow:none!important;color:var(--cc-muted)!important;
 font:550 12px/1.35 system-ui,sans-serif!important;text-align:center!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #match-panel{
 order:4!important;position:relative!important;display:flex!important;flex-direction:column!important;min-height:215px!important;
 background:var(--cc-surface)!important;border:1px solid var(--cc-line)!important;border-radius:13px!important;overflow:hidden!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #match-panel>.dock-header,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #match-panel>.replay-shortcut{display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .dock-tabs{
 display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;flex:0 0 auto!important;
 width:100%!important;margin:0!important;padding:0!important;gap:0!important;
 background:var(--cc-surface)!important;border-bottom:1px solid var(--cc-line)!important;border-radius:0!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .dock-tab,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .checkers-info-tab{
 display:flex!important;align-items:center!important;justify-content:center!important;gap:7px;
 width:100%!important;height:48px!important;margin:0!important;padding:4px 6px!important;
 background:transparent!important;color:var(--cc-ink)!important;border:0!important;border-radius:0!important;
 font:700 15px/1.15 system-ui,sans-serif!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .dock-tab.active,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .checkers-info-tab.active{background:var(--cc-accent)!important;color:white!important}
body.warcaby-console.chess-console.cc-owner .dock-tab .chat-led{display:none!important}
body.warcaby-console.chess-console.cc-owner .checkers-info-tab svg{height:20px;width:20px;fill:none;stroke:currentColor;stroke-width:1.8}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #moves-panel,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #chat-panel,
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #checkers-owner-info{
 flex:1 1 auto!important;min-height:0!important;margin:0!important;padding:10px!important;overflow:auto!important;
 background:var(--cc-surface)!important;color:var(--cc-ink)!important;border:0!important;box-shadow:none!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #moves-panel[hidden],
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #chat-panel[hidden],
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #checkers-owner-info[hidden]{display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #moves-list{
 display:block!important;overflow:auto!important;margin:0!important;padding:0 6px!important;
 max-height:100%!important;list-style:decimal inside!important;text-align:left!important;color:var(--cc-ink)!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #moves-list li{
 padding:8px;border-bottom:1px solid var(--cc-line);font:550 13px/1.4 system-ui,sans-serif;color:var(--cc-ink)
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #match-panel>.mini-chat{
 flex:0 0 auto!important;min-height:0!important;margin:0!important;padding:7px!important;background:var(--cc-surface)!important
}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) #match-panel>.mini-chat[hidden]{display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.game-tools.checkers-toolbar{display:none!important}
body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .side-dock>.cc-tools{order:5!important}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-sheet #training-settings,
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-sheet #online-settings{
 display:block!important;position:static!important;box-sizing:border-box!important;
 width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;
 margin:0!important;padding:0!important;overflow:visible!important;background:transparent!important;
 border:0!important;box-shadow:none!important;color:var(--cc-ink)!important
}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-sheet :is(label,select,input,button){
 max-width:100%!important;box-sizing:border-box!important
}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-sheet :is(input,select){
 width:100%!important;min-height:40px!important;margin:4px 0 8px!important;padding:6px 8px!important;
 background:var(--cc-surface)!important;color:var(--cc-ink)!important;border:1px solid var(--cc-line)!important;border-radius:8px!important
}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-sheet :is(#training-settings,#online-settings)[hidden]{display:none!important}
body.warcaby-console.chess-console.cc-owner #game #cc-sheet-online :is(label[for="create-room-friend"],#create-room-friend){display:block!important}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-sheet .cc-sheet-body{overflow:auto!important}
body.warcaby-console.chess-console.cc-owner #game .checkers-owner-sheet .cc-sheet-body>*{flex-shrink:0!important}
body.warcaby-console.chess-console.cc-owner #game .cc-tool svg{fill:none}
body.warcaby-console.chess-console.cc-owner[data-checkers-board="wood"] #board .square.light{background:#e9d3ac!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-board="wood"] #board .square.dark{background:#a37b55!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-board="slate"] #board .square.light{background:#dfe3e1!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-board="slate"] #board .square.dark{background:#74848a!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-board="azure"] #board .square.light{background:#e3edf0!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-board="azure"] #board .square.dark{background:#689bae!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-pieces="flat"] #board .piece{box-shadow:none!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-pieces="flat"] #board .piece:before{background:none!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-pieces="wood"] #board .piece.white{background:#f2d0a3!important}
body.warcaby-console.chess-console.cc-owner[data-checkers-pieces="wood"] #board .piece.black{background:#574537!important}
body.warcaby-console.chess-console.cc-owner #game.game-focus>.boardarea>.side-dock{display:none!important}
@media(max-width:800px){
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus){height:auto!important;overflow:visible!important}
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea{
  display:flex!important;flex-direction:column!important;align-items:stretch!important;height:auto!important;
  padding:8px!important;gap:10px!important;overflow:visible!important
 }
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.arena{order:3!important;min-height:0!important;height:auto!important}
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .board-center{height:auto!important;min-height:0!important}
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus) .boardframe{width:min(100%,calc(100dvw - 16px))!important;height:auto!important}
 body.warcaby-console.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.side-dock{order:4!important}
}
`;
export const checkersChessShellJs=String.raw`
/* Presentation-only chess console adapter for the existing Warcaby controller.
   Do not replace original IDs, listeners, game state, network calls or engine rules. */
(()=>{
 const $=id=>document.getElementById(id);
 const E=(tag,cls,text)=>{
  const element=document.createElement(tag);
  if(cls)element.className=cls;
  if(text!==undefined)element.textContent=text;
  return element;
 };
 const icons={
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21v-2c0-3.5 3-5.5 7.5-5.5s7.5 2 7.5 5.5v2"/>',
  computer:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>',
  online:'<circle cx="9" cy="8" r="3"/><circle cx="18" cy="9" r="2.5"/><path d="M3 20v-2c0-4 3-6 6-6s6 2 6 6v2M15.5 15c3 0 5.5 2 5.5 5"/>',
  bot:'<rect x="4" y="7" width="16" height="13" rx="3"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17h6M12 7V4m-2 0h4"/>',
  new:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  rematch:'<path d="M20 10A8 8 0 0 0 6 6L4 9V4h5M4 14a8 8 0 0 0 14 4l2-3v5h-5"/>',
  invite:'<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  undo:'<path d="m9 14-5-5 5-5M4 9h9a7 7 0 0 1 0 14"/>',
  draw:'<path d="M4 8h16M4 16h16M7 5h10M7 19h10"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
  board:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h18M12 3v18"/>',
  pieces:'<circle cx="12" cy="8" r="4"/><ellipse cx="12" cy="15" rx="7" ry="4"/><path d="M4 21h16"/>',
  theme:'<circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3M8 16l-3 3"/>',
  fullscreen:'<path d="M4 9V4h5m6 0h5v5M20 15v5h-5M9 20H4v-5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  close:'<path d="M5 5l14 14M19 5 5 19"/>',
  send:'<path d="M21 3 3 10l7 3 3 7 8-17Z"/><path d="m10 13 5-5"/>'
 };
 const icon=name=>{
  const node=document.createElementNS('http://www.w3.org/2000/svg','svg');
  node.setAttribute('viewBox','0 0 24 24');node.setAttribute('aria-hidden','true');
  node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');node.setAttribute('stroke','currentColor');
  node.setAttribute('fill','none');node.innerHTML=icons[name]||'';return node;
 };
 const game=$('game');
 if(!game||typeof game.querySelector!=='function')return; // isolated legacy controller test harnesses
 const area=game.querySelector(':scope > .boardarea'),arena=area?.querySelector('.arena');
 const dock=arena?.querySelector(':scope > .side-dock'),sidebar=game?.querySelector(':scope > .sidebar');
 const board=$('board'),players=area?.querySelector(':scope > .players'),match=$('match-panel');
 const mode=sidebar?.querySelector('.mode'),chat=$('chat-tab'),moves=$('history-tab');
 if(!game||!area||!arena||!dock||!sidebar||!players||!match||!mode||!board||!chat||!moves)return;
 if(game.dataset.checkersChessShell==='yes')return;
 game.dataset.checkersChessShell='yes';
 const body=document.body;
 // Presentation must never block original Warcaby moves, even if fonts or
 // enhanced controls initialize slowly or throw after the board is mounted.
 const showPlayableBoard=()=>{
  document.documentElement.classList.remove('checkers-shell-loading');
  body.classList.remove('checkers-shell-loading');
 };
 const bootFailsafe=window.setTimeout(showPlayableBoard,2200);
 // Keep the existing Warcaby board, clock nodes, buttons, settings and controller untouched.
 arena.removeChild(dock);area.append(dock);
 dock.insertBefore(sidebar,match);
 const top=E('div','cc-top'),account=E('div','cc-account');
 const mail=E('a','cc-icon-link cc-mail'),badge=E('span','cc-mail-badge');
 mail.href='/konto/panel/?sekcja=messages';mail.title='Wiadomości';mail.setAttribute('aria-label','Wiadomości');
 badge.hidden=true;badge.setAttribute('aria-hidden','true');mail.append(icon('mail'),badge);
 const profile=E('a','cc-icon-link cc-profile');profile.href='/konto/panel/?sekcja=profile';
 profile.title='Mój profil';profile.setAttribute('aria-label','Mój profil');profile.append(icon('profile'));
 account.append(mail,profile);top.append(players,account);dock.insertBefore(top,sidebar);
 // The original clock boxes and their dimensions stay intact.
 // Display-only nick comes from the authenticated session; never trust a typed name.
 let sessionNickname='';
 const clockNameLabels=[];
 const clockTurnTokens=[];
 const refreshClockTurnTokens=(snapshot=null)=>{
  const activeTurn=Number(snapshot?.turn??board.dataset.checkersTurn);
  const winner=Number(snapshot?.winner??board.dataset.checkersWinner);
  const playable=(snapshot?.playable??(board.dataset.checkersPlayable==='true'))===true;
  for(const [side,token] of clockTurnTokens){
   const active=playable&&!winner&&activeTurn===side;
   token.classList.toggle('is-turn',active);
   token.title=active?'Teraz ruch '+(side===1?'białych':'czarnych'):'';
  }
 };
 const refreshClockNameLabels=()=>{
  const training=$('training-mode')?.classList.contains('active');
  const humanSide=board.dataset.checkersHumanSide==='2'?2:1;
  for(const [id,label] of clockNameLabels){
   const source=$(id)?.textContent?.trim()||'';
   const value=training
    ?((id==='black-name'?2:1)===humanSide?(sessionNickname||'Gość'):(document.body.dataset.checkersBotName||'Komputer'))
    :(source==='Ty'?(sessionNickname||'Gość'):source||(id==='black-name'?'Czarne':'Białe'));
   if(label.textContent!==value)label.textContent=value;
   label.title=value;
  }
 };
 for(const [id,side] of [['black-name',2],['white-name',1]]){
  const title=$(id),card=title?.closest('.player'),clock=card?.querySelector('.player-clock');
  if(!title||!card||!clock)continue;
  const label=card.querySelector('.cc-side')||E('span','cc-side');
  const wrapper=E('span','checkers-clock-wrap');
  const pawn=E('span','checkers-turn-token '+(side===1?'white':'black'));
  pawn.setAttribute('aria-hidden','true');
  clock.insertAdjacentElement('beforebegin',wrapper);
  wrapper.append(pawn,clock);
  wrapper.insertAdjacentElement('afterend',label);
  clockTurnTokens.push([side,pawn]);
  clockNameLabels.push([id,label]);
  new MutationObserver(refreshClockNameLabels).observe(title,{childList:true,characterData:true,subtree:true});
 }
 // Rendered board state is the single source of truth. Never infer a turn
 // from a running clock (clocks may be disabled or paused).
 window.addEventListener('gracz:warcaby:position',event=>{refreshClockTurnTokens(event.detail);refreshClockNameLabels();});
 refreshClockTurnTokens();
 for(const id of ['training-mode','online-mode']){
  const control=$(id);
  if(control)new MutationObserver(refreshClockNameLabels).observe(control,{attributes:true,attributeFilter:['class']});
 }
 refreshClockNameLabels();
 async function readClockSession(){
  try{
   const response=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok){sessionNickname='';refreshClockNameLabels();return;}
   const data=await response.json();
   sessionNickname=data?.ok===true&&data.loggedIn===true&&typeof data.nickname==='string'
    ?data.nickname.trim().slice(0,32):'';
  }catch(_error){sessionNickname='';}
  refreshClockNameLabels();
 }
 void readClockSession();
 window.addEventListener('pageshow',event=>{if(event.persisted)void readClockSession();});
 const nav=E('nav','cc-site-nav');nav.setAttribute('aria-label','GRACZ.PL');
 for(const [label,href] of [['Start','https://gracz.pl/'],['Nasze gry','https://gracz.pl/gry/'],
  ['Poradnik','https://gracz.pl/poradniki/'],['Blog','https://gracz.pl/#aktualnosci'],
  ['Newsletter','https://gracz.pl/newsletter/'],['Mój panel','/konto/panel/']]){
  const link=E('a','',label);link.href=href;nav.append(link);
 }
 area.insertBefore(nav,area.firstChild);
 mode.classList.add('checkers-owner-mode');
 const botMode=E('button','mode-choice checkers-bots-mode');
 botMode.type='button';botMode.id='checkers-bots-mode';
 botMode.setAttribute('aria-haspopup','dialog');
 botMode.setAttribute('aria-controls','checkers-bots-overlay');
 botMode.setAttribute('aria-expanded','false');
 mode.insertBefore(botMode,$('online-mode'));
 for(const [id,label,name] of [
  ['training-mode','Komputer','computer'],
  ['checkers-bots-mode','Graj z botem','bot'],
  ['online-mode','Graj ze znajomym','online']
 ]){
  const button=$(id);if(button)button.replaceChildren(icon(name),E('span','cc-mode-label',label));
 }
 const status=$('game-state');status.classList.add('checkers-owner-status');dock.insertBefore(status,match);
 const actions=E('nav','chess-reference-actions');actions.setAttribute('aria-label','Akcje Warcabów');
 function action(label,name){
  const button=E('button','checkers-owner-action');button.type='button';
  button.append(icon(name),E('span','',label));button.setAttribute('aria-label',label);actions.append(button);return button;
 }
 const newGame=action('Nowa gra','new'),rematch=action('Rewanż','rematch');
 const invite=action('Zaproś','invite'),undo=action('Cofnij','undo'),draw=action('Remis','draw');
 const undoDraw=E('div','checkers-undo-draw');undoDraw.append(undo,draw);actions.append(undoDraw);
 draw.id='checkers-offer-draw';undo.id='checkers-owner-undo';
 dock.insertBefore(actions,status);
 const drawBanner=E('div','checkers-draw-banner');drawBanner.hidden=true;
 drawBanner.setAttribute('role','status');drawBanner.setAttribute('aria-live','polite');
 const drawText=E('span','checkers-draw-text');drawBanner.append(drawText);
 const drawChoices=E('div','checkers-draw-choices');
 const acceptDraw=E('button','','Przyjmij'),rejectDraw=E('button','','Odrzuć');
 acceptDraw.type='button';rejectDraw.type='button';drawChoices.append(acceptDraw,rejectDraw);
 drawBanner.append(drawChoices);dock.insertBefore(drawBanner,status);
 const infoTab=E('button','checkers-info-tab');infoTab.type='button';
 infoTab.setAttribute('role','tab');infoTab.setAttribute('aria-selected','false');
 infoTab.append(icon('info'),E('span','','Info'));match.querySelector('.dock-tabs')?.append(infoTab);
 const info=E('section','checkers-owner-info');info.id='checkers-owner-info';info.hidden=true;
 info.setAttribute('role','tabpanel');
 const detail=E('dl','cc-info-list');
 const fields={};
 for(const [name,label] of [['mode','Tryb'],['opponent','Przeciwnik'],['state','Stan'],['clock','Czas'],['moves','Ruchy']]){
  const value=E('dd','','—');fields[name]=value;detail.append(E('dt','',label),value);
 }
 const rules=E('a','','Zasady gry w warcaby');
 rules.href='https://gracz.pl/gry/warcaby/zasady/';
 const panel=E('a','','Moje partie i zaproszenia');panel.href='/konto/panel/?sekcja=play';
 const classic=E('a','','Wróć do klasycznej konsoli');classic.href='/konto/warcaby/?konsola=klasyczna';
 classic.title='Awaryjny powrót do poprzedniego układu bez zmiany zasad ani partii';
 const refresh=E('button','','Odśwież partię online');refresh.type='button';
 refresh.addEventListener('click',()=>{$('refresh-match')?.click();});
 const links=E('ul','cc-info-links');
 for(const node of [rules,panel,classic,refresh]){const li=E('li');li.append(node);links.append(li);}
 info.append(E('h3','cc-info-heading','Bieżąca partia'),detail,E('h3','cc-info-heading','Zasady i pomoc'),links);
 match.insertBefore(info,match.querySelector('.mini-chat'));
 function showInfo(){
  for(const node of [chat,moves]){node.classList.remove('active');node.setAttribute('aria-selected','false');}
  infoTab.classList.add('active');infoTab.setAttribute('aria-selected','true');
  $('chat-panel').hidden=true;$('moves-panel').hidden=true;
  const preview=$('chat-preview');if(preview)preview.hidden=true;
  info.hidden=false;sync();
 }
 infoTab.addEventListener('click',showInfo);
 for(const tab of [chat,moves])tab.addEventListener('click',()=>{
  info.hidden=true;infoTab.classList.remove('active');infoTab.setAttribute('aria-selected','false');
 });
 function makeSheet(name,title){
  const sheet=E('section','cc-sheet checkers-owner-sheet');sheet.id='cc-sheet-'+name;sheet.hidden=true;
  sheet.setAttribute('role','region');sheet.setAttribute('aria-label',title);
  const head=E('header','cc-sheet-head');const heading=E('h2','cc-sheet-title',title);
  const close=E('button','cc-sheet-close');close.type='button';close.setAttribute('aria-label','Zamknij '+title);
  close.append(icon('close'));head.append(heading,close);
  const content=E('div','cc-sheet-body');sheet.append(head,content);match.append(sheet);
  close.addEventListener('click',()=>closeSheet());
  return {sheet,content};
 }
 const sheets={},triggers=new Map();let opened=null,opener=null;
 function closeSheet(){
  if(!opened)return;
  sheets[opened].sheet.hidden=true;
  for(const item of [...match.children])if(!item.classList.contains('cc-sheet'))item.inert=false;
  for(const [name,button] of triggers)button.setAttribute('aria-expanded','false');
  const last=opener;opened=null;opener=null;
  last?.focus({preventScroll:true});
 }
 function openSheet(name,source){
  if(opened===name){closeSheet();return;}
  closeSheet();opened=name;opener=source||null;
  for(const item of [...match.children])if(!item.classList.contains('cc-sheet'))item.inert=true;
  sheets[name].sheet.hidden=false;
  if(source)source.setAttribute('aria-expanded','true');
  sheets[name].sheet.querySelector('.cc-sheet-close')?.focus({preventScroll:true});
 }
 for(const [key,title] of [['settings','Ustawienia gry'],['online','Partie online'],
  ['board','Wygląd planszy'],['pieces','Wygląd pionków'],['theme','Motyw panelu']]){
  sheets[key]=makeSheet(key,title);
 }
 const training=$('training-settings'),online=$('online-settings');
 if(training)sheets.settings.content.append(training);
 if(online)sheets.online.content.append(online);
 const infoLine=E('p','cc-note','Obowiązkowe i wielokrotne bicie oraz damki działają według aktualnych zasad Warcabów.');
 sheets.online.content.prepend(infoLine);
 const studio=E('button','cc-button','Układ konsoli');studio.type='button';
 studio.addEventListener('click',()=>{closeSheet();$('console-config-open')?.click();});
 sheets.settings.content.append(studio);
 const accessories=E('div','cc-group');
 const rotate=E('button','cc-button','Obróć planszę');rotate.type='button';
 rotate.addEventListener('click',()=>{$('rotate-board')?.click();closeSheet();});
 const hint=E('button','cc-button','Podpowiedź ruchu');hint.type='button';
 hint.addEventListener('click',()=>{$('training-hint')?.click();closeSheet();});
 accessories.append(rotate,hint);sheets.settings.content.append(accessories);
 // Appearance choices are strictly visual; the original checker engine is never modified.
 const PREF='gracz-warcaby-chess-shell-style-v1';
 const defaults={board:'original',pieces:'original',theme:'light'};
 const choices={board:['original','wood','slate','azure'],pieces:['original','flat','wood'],theme:['light','dark']};
 let prefs={...defaults};
 try{const value=JSON.parse(localStorage.getItem(PREF)||'null');if(value&&typeof value==='object')
  for(const key of Object.keys(defaults))if(choices[key].includes(value[key]))prefs[key]=value[key];}catch{}
 function applyPrefs(save){
  for(const key of Object.keys(defaults)){
   const attr=key==='theme'?'ccTheme':key==='board'?'checkersBoard':'checkersPieces';
   if(prefs[key]===defaults[key])delete body.dataset[attr];else body.dataset[attr]=prefs[key];
   for(const input of sheets[key].content.querySelectorAll('input[type=radio]'))input.checked=input.value===prefs[key];
  }
  if(save)try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}
 }
 for(const [key,legend,labels] of [
  ['board','Kolory pól',[['original','Oryginalna GRACZ.PL'],['wood','Orzech'],['slate','Grafit'],['azure','Lazur']]],
  ['pieces','Wygląd pionków',[['original','Oryginalne pionki'],['flat','Kontrastowe'],['wood','Drewniane']]],
  ['theme','Motyw konsoli',[['light','Jasny'],['dark','Ciemny']]]]){
  const field=E('fieldset','cc-group');field.append(E('legend','',legend));
  for(const [value,label] of labels){
   const option=E('label','cc-option'),input=E('input');input.type='radio';input.name='checkers-'+key;
   input.value=value;input.addEventListener('change',()=>{prefs[key]=value;applyPrefs(true);});
   option.append(input,E('span','',label));field.append(option);
  }
  sheets[key].content.append(field);
  const reset=E('button','cc-button','Przywróć oryginalny wygląd');reset.type='button';
  reset.addEventListener('click',()=>{prefs={...defaults};applyPrefs(true);});
  sheets[key].content.append(reset);
 }
 applyPrefs(false);
 const tools=E('nav','cc-tools');tools.setAttribute('aria-label','Ustawienia i widok gry');
 function tool(kind,label,name){
  const button=E('button','cc-tool');button.type='button';button.dataset.tool=kind;
  button.title=label;button.setAttribute('aria-label',label);
  button.append(icon(name),E('span','cc-tool-label',label));tools.append(button);return button;
 }
 for(const [name,label,ico] of [['settings','Ustawienia','settings'],['board','Plansza','board'],
  ['pieces','Pionki','pieces'],['theme','Motyw','theme']]){
  const button=tool(name,label,ico);
  button.setAttribute('aria-controls','cc-sheet-'+name);button.setAttribute('aria-expanded','false');
  triggers.set(name,button);button.addEventListener('click',()=>openSheet(name,button));
 }
 const fullscreen=tool('fullscreen','Pełny ekran','fullscreen');
 fullscreen.addEventListener('click',()=>{$('fullscreen-game')?.click();});
 dock.append(tools);
 $('chat-send')?.replaceChildren(icon('send'));
 let lastResult=null,drawBusy=false,drawMessage='';
 const blocker=E('div','checkers-newgame-blocker');blocker.hidden=true;
 blocker.setAttribute('role','dialog');blocker.setAttribute('aria-modal','true');
 blocker.setAttribute('aria-labelledby','checkers-newgame-title');
 blocker.setAttribute('aria-describedby','checkers-newgame-description');
 const blockerCard=E('section','checkers-newgame-card');
 const blockerTitle=E('h2','','Nowa gra jest niedostępna');blockerTitle.id='checkers-newgame-title';
 const blockerText=E('p','','Nie możesz rozpocząć nowej gry podczas trwania obecnej rozgrywki.');
 blockerText.id='checkers-newgame-description';
 const blockerClose=E('button','checkers-newgame-close','Zamknij');blockerClose.type='button';
 blockerCard.append(blockerTitle,blockerText,blockerClose);blocker.append(blockerCard);
 document.body.append(blocker);
 const hideNewGameBlocker=()=>{blocker.hidden=true;newGame.focus({preventScroll:true})};
 blockerClose.addEventListener('click',hideNewGameBlocker);
 blocker.addEventListener('click',e=>{if(e.target===blocker)hideNewGameBlocker()});
 blocker.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();hideNewGameBlocker()}
  else if(e.key==='Tab'){e.preventDefault();blockerClose.focus()}
 });
 function isCheckersGameInProgress(snapshot){
  if(!snapshot||snapshot.winner)return false;
  if(snapshot.mode==='online')return !!snapshot.matchId&&!!snapshot.playable;
  return snapshot.mode==='training'&&!!snapshot.playable;
 }
 newGame.addEventListener('click',()=>{
  if(isCheckersGameInProgress(lastResult)){
   closeSheet();blocker.hidden=false;blockerClose.focus({preventScroll:true});return;
  }
  if($('training-mode')?.classList.contains('active')){
   $('restart')?.click();
   window.dispatchEvent(new Event('gracz:warcaby:new-game-seat'));
  }else openSheet('online',newGame);
 });
 invite.addEventListener('click',()=>{
  if(!$('online-mode')?.classList.contains('active'))$('online-mode')?.click();
  openSheet('online',invite);
  $('create-room-friend')?.focus({preventScroll:true});
 });
 function updateDraw(){
  const active=$('online-mode')?.classList.contains('active');
  const offer=active?lastResult?.drawOffer:null;
  const mine=!!offer&&offer.requester===lastResult?.player;
  const incoming=!!offer&&!mine;
  draw.disabled=drawBusy||!!lastResult?.winner;
  draw.title=!active?'W treningu remis następuje automatycznie zgodnie z zasadami':
    !lastResult?.matchId?'Najpierw dołącz do partii online':
    mine?'Kliknij, aby wycofać propozycję remisu':
    incoming?'Odpowiedz na propozycję przeciwnika':'Zaproponuj remis przeciwnikowi';
  drawBanner.hidden=!incoming&&!mine&&!drawMessage;
  if(drawMessage)drawText.textContent=drawMessage;
  else if(mine)drawText.textContent='Propozycja remisu wysłana. Czekamy na odpowiedź przeciwnika.';
  else if(incoming)drawText.textContent='Przeciwnik proponuje remis. Przyjmujesz?';
  drawChoices.hidden=!incoming;
  acceptDraw.disabled=rejectDraw.disabled=drawBusy;
 }
 async function sendDraw(action){
  if(drawBusy)return;
  const old=lastResult;
  if(!old?.matchId||old.mode!=='online'||!old.playable||old.winner){
   drawMessage='Najpierw rozpocznij aktywną partię online.';updateDraw();return;
  }
  drawBusy=true;drawMessage='';updateDraw();
  try{
   const payload={id:old.matchId,version:old.version,action};
   if(action!=='offerDraw')payload.offerId=old.drawOffer?.id;
   const response=await fetch('/auth/match',{method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||data.ok!==true||!data.match)throw Error(
    response.status===409?'Partia zmieniła się. Odśwież i spróbuj ponownie.':
    'Nie udało się obsłużyć propozycji remisu.');
   lastResult={...old,version:data.match.version,winner:data.match.state.winner,
    drawOffer:data.match.state.drawOffer||null,moves:data.match.state.moves,playable:data.match.playable};
   window.dispatchEvent(new Event('gracz:warcaby:refresh-requested'));
  }catch(error){drawMessage=error.message||'Nie udało się obsłużyć propozycji.';}
  finally{drawBusy=false;updateDraw();}
 }
 draw.addEventListener('click',()=>{
  if(!$('online-mode')?.classList.contains('active')){
   drawMessage='W treningu z komputerem remis następuje automatycznie z zasad gry.';
   updateDraw();return;
  }
  if(lastResult?.drawOffer?.requester===lastResult?.player)void sendDraw('cancelDraw');
  else if(lastResult?.drawOffer){drawMessage='Wybierz Przyjmij albo Odrzuć.';updateDraw();}
  else if(window.confirm('Czy zaproponować przeciwnikowi remis?'))void sendDraw('offerDraw');
 });
 acceptDraw.addEventListener('click',()=>void sendDraw('acceptDraw'));
 rejectDraw.addEventListener('click',()=>void sendDraw('rejectDraw'));
 function updateRewind(){
  const local=$('training-mode')?.classList.contains('active');
  undo.disabled=!local;undo.title=local?'Cofnij ostatnią pełną turę':'W rozgrywce online cofanie nie jest dostępne';
  const finished=lastResult?.winner>0||!$('game-result-modal')?.hidden;
  rematch.disabled=!finished;
  updateDraw();
 }
 undo.addEventListener('click',()=>{if(!undo.disabled)$('training-undo')?.click();});
 rematch.addEventListener('click',()=>{
  if(rematch.disabled)return;
  if($('training-mode')?.classList.contains('active'))$('restart')?.click();
  else{
   if(lastResult?.players&&lastResult?.player){
    const opponent=lastResult.players[2-lastResult.player];
    if(opponent&&$('create-room-friend'))$('create-room-friend').value=opponent;
   }
   openSheet('online',rematch);
  }
 });
 for(const name of ['training-mode','online-mode']){
  $(name)?.addEventListener('click',()=>{lastResult=null;drawMessage='';closeSheet();updateRewind();});
 }
 window.addEventListener('gracz:warcaby:position',event=>{
  lastResult=event.detail||null;updateRewind();sync();
 });
 function sync(){
  const local=$('training-mode')?.classList.contains('active');
  refresh.disabled=local;
  fields.mode.textContent=local?'Komputer':'Online';
  fields.opponent.textContent=local?(document.body.dataset.checkersBotName||'Komputer'):($('room-select')?.selectedOptions?.[0]?.textContent||'Zaproś znajomego');
  fields.state.textContent=$('game-state')?.textContent?.trim()||'—';
  fields.clock.textContent=local?($('training-time')?.selectedOptions?.[0]?.textContent||'Bez limitu'):($('create-room-time')?.selectedOptions?.[0]?.textContent||'—');
  fields.moves.textContent=$('move-count')?.textContent?.trim()||'0';
 }
 const update=()=>{sync();updateRewind();};
 if($('game-state'))new MutationObserver(update).observe($('game-state'),{subtree:true,childList:true,characterData:true});
 if($('moves-list'))new MutationObserver(sync).observe($('moves-list'),{subtree:true,childList:true});
 if($('game-result-modal'))new MutationObserver(updateRewind).observe($('game-result-modal'),{attributes:true,attributeFilter:['hidden']});
 update();
 async function unread(){
  if(document.hidden)return;
  try{
   const response=await fetch('/auth/message-center',{credentials:'same-origin',cache:'no-store'});
   if(response.status===401||response.status===403){badge.hidden=true;return;}
   if(!response.ok)return;
   const data=await response.json();
   if(data?.ok!==true||!Array.isArray(data.conversations))return;
   const total=data.conversations.reduce((sum,row)=>sum+(!row||row.archived?0:Math.max(0,Math.floor(Number(row.unread)||0))),0);
   badge.hidden=total===0;badge.textContent=total>99?'99+':String(total);
   mail.title=total?'Wiadomości — '+total+' nieprzeczytanych':'Wiadomości';
  }catch{}
 }
 void unread();const timer=setInterval(()=>void unread(),50000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void unread();});
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 // The original Warcaby training engine initializes asynchronously.
 // Reveal the shared chrome only when its real 64-square board is present.
 let checks=0;
 const ready=()=>{
  if(board.querySelectorAll('.square').length===64&&dock.contains(mode)&&dock.contains(match)&&dock.contains(tools)){
   window.clearTimeout(bootFailsafe);
   showPlayableBoard();
  }else if(++checks<120){
   requestAnimationFrame(ready);
  }else{
   // Keep the original game interactive if presentation readiness fails.
   showPlayableBoard();
  }
 };
 // Never await potentially delayed web fonts before permitting moves.
 requestAnimationFrame(()=>requestAnimationFrame(ready));
})();
`;
