// CHESS-CONSOLE-OWNER-P1 (#814): the owner-approved right console of /konto/szachy/.
// Presentation and wiring only. It re-composes the EXISTING clocks, mode switch, actions,
// chat/moves dock, layout configurator, invitation window and fullscreen flow, and adds:
// - a live unread-message badge from GET /auth/message-center (no invented numbers),
// - five working configuration icons (settings, board, pieces, panel theme, fullscreen).
// The board squares, coordinates, SVG pieces, rules engine and realtime client are not
// touched; appearance variants apply only after an explicit user choice and are
// stored locally (validated). Structural rules are gated by body.cc-owner, which the
// script sets only after a successful mount, so a failed mount keeps the old console.
// Both strings are appended to the existing same-origin styl.css / app.js bundles.

export const chessOwnerConsoleCss = String.raw`
/* ===== CHESS-CONSOLE-OWNER-P1 (#814) ===== */
body.chess-console.cc-owner #game .side-dock{
  --cc-bg:#faf3e1;--cc-surface:#fffdf7;--cc-soft:#f1e7cf;--cc-line:#e0d4b8;
  --cc-ink:#0a3a3d;--cc-muted:#526e6c;--cc-accent:#006b6a;--cc-accent-hover:#005857;
  --cc-on-accent:#ffffff;--cc-focus:#c8891a;--cc-badge:#d92633;--cc-shadow:#00191b33;color-scheme:light
}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock{
  --cc-bg:#0f2a2d;--cc-surface:#163538;--cc-soft:#1d4145;--cc-line:#2c5155;
  --cc-ink:#e8f2ef;--cc-muted:#a5c1bd;--cc-accent:#1c7a75;--cc-accent-hover:#22908a;
  --cc-on-accent:#ffffff;--cc-focus:#f0c25a;--cc-badge:#e3404c;--cc-shadow:#0006;color-scheme:dark
}
/* Small text navigation above the board (desktop); phones keep the existing top bar menu. */
body.chess-console.cc-owner #game>.boardarea>.cc-site-nav{display:none}
body.chess-console.cc-owner #game.game-focus .cc-site-nav{display:none!important}
@media (min-width:801px){
  body.chess-console.cc-owner #game:not(.game-focus){
    --cc-panel:clamp(372px,29vw,440px);
    --cc-board:max(240px,min(calc(100vh - 56px),calc(100vw - var(--cc-panel) - 56px)))
  }
  body.chess-console.cc-owner #game:not(.game-focus)>.boardarea{
    display:grid!important;box-sizing:border-box!important;
    grid-template-columns:minmax(0,var(--cc-board)) var(--cc-panel)!important;
    grid-template-rows:28px minmax(0,1fr)!important;
    justify-content:center!important;align-content:stretch!important;
    column-gap:22px!important;row-gap:8px!important;
    width:100%!important;height:100%!important;padding:6px 17px 14px!important
  }
  body.chess-console.cc-owner #game.console-hide-dock:not(.game-focus)>.boardarea{
    grid-template-columns:minmax(0,min(calc(100vh - 56px),calc(100vw - 34px)))!important
  }
  body.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.cc-site-nav{
    display:flex;grid-column:1;grid-row:1;align-self:center;align-items:center;
    gap:clamp(14px,2.2vw,34px);min-width:0;overflow:hidden;white-space:nowrap
  }
  body.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.arena{
    grid-column:1!important;grid-row:2!important;width:100%!important;height:100%!important;
    min-width:0!important;min-height:0!important
  }
  body.chess-console.cc-owner #game:not(.game-focus) .boardframe{margin:0 auto!important}
  body.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.side-dock{
    grid-column:2!important;grid-row:2!important;width:100%!important;height:100%!important;
    max-height:100%!important;min-height:0!important;margin:0!important;
    overflow-x:hidden!important;overflow-y:auto!important;align-self:stretch!important
  }
  body.chess-console.cc-owner #game:not(.game-focus) .side-dock>#match-panel{
    flex:1 1 0!important;height:auto!important;min-height:250px!important;max-height:none!important
  }
}
body.chess-console.cc-owner .cc-site-nav a{
  color:#f3ead3;text-decoration:none;font:600 15px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;
  padding:4px 0;border-bottom:2px solid transparent
}
body.chess-console.cc-owner .cc-site-nav a:hover{border-bottom-color:#e8c46b;color:#fff}
body.chess-console.cc-owner .cc-site-nav a:focus-visible{outline:2px solid #e8c46b;outline-offset:3px;border-radius:2px}
@media (max-width:800px){
  body.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.chess-mobile-heading{order:0!important}
  body.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.arena{order:3!important}
  body.chess-console.cc-owner #game:not(.game-focus)>.boardarea>.side-dock{
    order:4!important;align-self:stretch!important;width:auto!important;max-width:none!important;
    height:auto!important;max-height:none!important;margin:10px 8px 16px!important;overflow:visible!important
  }
  body.chess-console.cc-owner #game:not(.game-focus) .side-dock>#match-panel{
    flex:0 0 340px!important;height:340px!important;min-height:340px!important;max-height:340px!important
  }
}
/* ---- one coherent panel ---- */
body.chess-console.cc-owner #game:not(.game-focus):not(.console-hide-dock)>.boardarea>.side-dock{
  display:flex!important;flex-direction:column!important;gap:10px!important;
  box-sizing:border-box!important;padding:14px!important;position:relative!important;
  background:var(--cc-bg)!important;color:var(--cc-ink)!important;border:0!important;
  border-radius:18px!important;box-shadow:0 10px 28px var(--cc-shadow)!important;scrollbar-width:thin
}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.cc-top{order:0}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.sidebar{order:1!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions{order:2!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-owner-claim-draw{order:3!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>#game-state{order:3!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>#match-panel{order:4!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.cc-tools{order:5}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock :focus-visible{outline:2px solid var(--cc-focus)!important;outline-offset:2px!important}
/* Top row: Czarne | Białe clocks, envelope with live badge, profile. */
body.chess-console.cc-owner #game .side-dock>.cc-top{
  display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;
  flex:0 0 auto;min-height:58px
}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top>.players{
  display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-template-rows:auto!important;
  align-items:center!important;gap:0!important;position:static!important;order:0!important;
  width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;
  margin:0!important;padding:0!important;background:transparent!important;border:0!important;
  border-radius:0!important;box-shadow:none!important;overflow:visible!important
}
body.chess-console.cc-owner #game.console-hide-players:not(.game-focus) .cc-top>.players{display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .players>.versus,
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player>.stone,
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player>.player-icon,
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player small{display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .players>.player{
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
  gap:3px!important;min-width:0!important;width:auto!important;height:auto!important;min-height:54px!important;
  max-height:none!important;margin:0!important;padding:2px 6px!important;background:transparent!important;
  border:0!important;border-radius:0!important;box-shadow:none!important;color:var(--cc-ink)!important
}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .players>.player.second{border-left:1px solid var(--cc-line)!important}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player>div{
  display:block!important;min-width:0!important;max-width:100%!important;width:auto!important;
  margin:0!important;padding:0!important;text-align:center!important
}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player strong{
  display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;
  white-space:nowrap!important;color:var(--cc-ink)!important;text-shadow:none!important;
  font:600 13px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player-clock{
  display:block!important;position:static!important;box-sizing:border-box!important;
  width:3.3em!important;min-width:3.3em!important;max-width:100%!important;height:auto!important;min-height:0!important;
  margin:0!important;padding:0 4px 2px!important;background:transparent!important;border:0!important;
  border-radius:4px!important;box-shadow:none!important;color:var(--cc-ink)!important;text-shadow:none!important;
  font:800 clamp(23px,2vw,30px)/1.05 system-ui,-apple-system,'Segoe UI',sans-serif!important;
  font-variant-numeric:tabular-nums!important;letter-spacing:0!important;text-align:center!important
}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player-clock.clock-running{
  color:var(--cc-accent)!important;box-shadow:inset 0 -3px 0 var(--cc-accent)!important
}
body.chess-console.cc-owner[data-cc-theme="dark"] #game:not(.game-focus) .cc-top .player-clock.clock-running{color:#7fd6cf!important}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player-clock.clock-warning{color:#b25f00!important}
body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player-clock.clock-critical{color:#c4232d!important}
body.chess-console.cc-owner .cc-account{display:flex;align-items:center;gap:2px}
body.chess-console.cc-owner #game.game-focus .cc-account{display:none!important}
body.chess-console.cc-owner .cc-icon-link{
  position:relative;display:inline-flex;align-items:center;justify-content:center;
  width:44px;height:44px;border-radius:10px;color:var(--cc-ink);text-decoration:none
}
body.chess-console.cc-owner .cc-icon-link:hover{background:var(--cc-soft)}
body.chess-console.cc-owner .cc-icon-link svg{width:30px;height:30px}
body.chess-console.cc-owner .cc-mail-badge{
  position:absolute;top:0;right:-1px;box-sizing:border-box;min-width:20px;height:20px;padding:0 5px;
  border-radius:999px;border:2px solid var(--cc-bg);background:var(--cc-badge);color:#fff;
  font:750 11px/16px system-ui,-apple-system,'Segoe UI',sans-serif;text-align:center;pointer-events:none
}
body.chess-console.cc-owner .cc-mail-badge[hidden]{display:none!important}
/* Mode switch: Komputer | Online, the active choice filled with the accent. */
body.chess-console.cc-owner #game:not(.game-focus):not(.console-hide-sidebar) .side-dock>.sidebar{
  display:block!important;flex:0 0 auto!important;position:static!important;width:auto!important;
  height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;
  background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important
}
/* :not(#cc-none) lifts specificity above the older :has(#online-mode.active) rules. */
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.sidebar>:not(.mode):not(#cc-none){display:none!important}
body.chess-console.cc-owner #game:not(.game-focus):not(.console-hide-mode) .side-dock .mode{
  display:grid!important;grid-template-columns:1fr 1fr!important;gap:4px!important;
  width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:4px!important;
  border:1px solid var(--cc-line)!important;border-radius:14px!important;background:var(--cc-soft)!important;
  box-shadow:none!important;overflow:visible!important
}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock .mode-choice{
  display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;
  gap:9px!important;box-sizing:border-box!important;width:auto!important;height:48px!important;min-height:48px!important;
  margin:0!important;padding:0 10px!important;border:0!important;border-radius:10px!important;
  background:transparent!important;color:var(--cc-ink)!important;box-shadow:none!important;cursor:pointer;
  font:700 16px/1 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock .mode-choice:hover:not(.active){background:var(--cc-surface)!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock .mode-choice.active{background:var(--cc-accent)!important;color:var(--cc-on-accent)!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock .mode-choice :is(.mode-icon,.mode-arrow,small){display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock .mode-choice>span:not([class]){display:inline!important;padding:0!important;margin:0!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock .mode-choice strong{color:inherit!important;font:inherit!important;text-shadow:none!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock .mode-choice .chess-mobile-mode-symbol{
  display:inline-flex!important;flex:0 0 24px!important;width:24px!important;height:24px!important;align-items:center!important;justify-content:center!important
}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock .mode-choice .chess-mobile-mode-symbol svg{display:block!important;width:24px!important;height:24px!important;fill:none!important}
/* Three discreet actions: icon + short name, thin separators. */
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions{
  display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important;
  flex:0 0 auto!important;margin:0!important;padding:0!important
}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions>button{
  position:relative!important;display:flex!important;flex-direction:column!important;align-items:center!important;
  justify-content:center!important;gap:5px!important;box-sizing:border-box!important;width:auto!important;min-width:0!important;
  height:auto!important;min-height:62px!important;margin:0!important;padding:6px 4px!important;border:0!important;
  border-radius:10px!important;background:transparent!important;color:var(--cc-ink)!important;box-shadow:none!important;
  cursor:pointer;font:650 15px/1.15 system-ui,-apple-system,'Segoe UI',sans-serif!important;text-shadow:none!important
}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions>button[hidden]{display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions>button:not([hidden])~button:not([hidden])::before{
  content:'';position:absolute;left:0;top:14px;bottom:14px;border-left:1px solid var(--cc-line)
}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions>button:hover:not(:disabled){background:var(--cc-soft)!important}
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions>button:disabled{opacity:.42!important;cursor:not-allowed!important}
body.chess-console.cc-owner .cc-action-icon{width:28px;height:28px;flex:none}
body.chess-console.cc-owner #game .chess-reference-actions .cc-action-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit!important;color:inherit!important}
/* Tabs Czat | Ruchy | Info and the shared content area (same height for every tab). */
body.chess-console.cc-owner #game:not(.game-focus) .side-dock>#match-panel{
  display:flex!important;flex-direction:column!important;gap:8px!important;position:relative!important;
  box-sizing:border-box!important;margin:0!important;padding:0!important;overflow:hidden!important;
  background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important
}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel>.dock-header{display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel>.dock-tabs{
  display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important;
  flex:0 0 auto!important;box-sizing:border-box!important;height:auto!important;min-height:48px!important;max-height:none!important;
  margin:0!important;padding:0!important;border:1px solid var(--cc-line)!important;
  border-radius:12px!important;overflow:hidden!important;background:var(--cc-surface)!important;box-shadow:none!important
}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel .dock-tab{
  display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;
  box-sizing:border-box!important;width:auto!important;min-width:0!important;height:46px!important;min-height:46px!important;
  margin:0!important;padding:0 8px!important;border:0!important;border-radius:0!important;background:transparent!important;
  color:var(--cc-ink)!important;box-shadow:none!important;cursor:pointer;text-shadow:none!important;
  font:700 16px/1 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel .dock-tab+.dock-tab{border-left:1px solid var(--cc-line)!important}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel .dock-tab:hover:not(.active){background:var(--cc-soft)!important}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel .dock-tab.active{background:var(--cc-accent)!important;color:var(--cc-on-accent)!important}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel .dock-tab :is(.dock-tab-icon,.chat-led){display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel .dock-tab .dock-tab-text{display:inline!important;color:inherit!important;font:inherit!important}
body.chess-console.cc-owner .cc-tab-icon{width:21px;height:21px;flex:none}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel>.replay-shortcut{display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) #match-panel>.dock-content:not([hidden]),
body.chess-console.cc-owner #game:not(.game-focus) #match-panel>#chess-final-info-panel:not([hidden]){
  flex:1 1 0!important;min-height:0!important;height:auto!important;max-height:none!important;
  margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important
}
body.chess-console.cc-owner #game:not(.game-focus) #chat-panel>.dock-title,
body.chess-console.cc-owner #game:not(.game-focus) #moves-panel>.dock-title{display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) #chat-panel:not([hidden]){display:flex!important;flex-direction:column!important}
body.chess-console.cc-owner #game:not(.game-focus):not(.console-hide-chat-history) #chat-messages{
  flex:1 1 0!important;min-height:0!important;max-height:none!important;overflow:auto!important;
  background:transparent!important;border:0!important;padding:4px 2px!important
}
body.chess-console.cc-owner #game:not(.game-focus) #chat-messages:has(>.dock-empty:only-child){
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important
}
body.chess-console.cc-owner #game:not(.game-focus) #chat-messages>.dock-empty{
  margin:0!important;padding:0 12px 18px!important;text-align:center!important;color:var(--cc-muted)!important;
  font:500 15px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif!important;background:transparent!important
}
body.chess-console.cc-owner #game:not(.game-focus) #chat-messages>.dock-empty::before{
  content:'';display:block;width:46px;height:34px;margin:0 auto 14px;box-sizing:border-box;
  border:2.5px solid var(--cc-muted);border-radius:20px 20px 20px 5px;opacity:.75
}
body.chess-console.cc-owner #game:not(.game-focus):not(.console-hide-chat-input) #match-panel:not(.moves-only)>.mini-chat{
  display:block!important;flex:0 0 auto!important;margin:0!important;padding:0!important;
  background:transparent!important;border:0!important;box-shadow:none!important
}
body.chess-console.cc-owner #game:not(.game-focus) .mini-chat>.chat-preview,
body.chess-console.cc-owner #game:not(.game-focus) .mini-chat>.chat-footnote{display:none!important}
body.chess-console.cc-owner #game:not(.game-focus) .mini-chat .chat-form{margin:0!important;padding:0!important;background:transparent!important;border:0!important}
body.chess-console.cc-owner #game:not(.game-focus) .mini-chat .chat-compose{
  display:flex!important;align-items:stretch!important;gap:8px!important;margin:0!important;padding:0!important;
  background:transparent!important;border:0!important;box-shadow:none!important
}
body.chess-console.cc-owner #game:not(.game-focus) #chat-input{
  flex:1 1 auto!important;box-sizing:border-box!important;width:auto!important;min-width:0!important;height:48px!important;
  margin:0!important;padding:0 14px!important;border:1px solid var(--cc-line)!important;border-radius:12px!important;
  background:var(--cc-surface)!important;color:var(--cc-ink)!important;box-shadow:none!important;
  font:500 15px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
body.chess-console.cc-owner #game:not(.game-focus) #chat-input::placeholder{color:var(--cc-muted)!important;opacity:1}
body.chess-console.cc-owner #game:not(.game-focus) #chat-send{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;
  flex:0 0 54px!important;width:54px!important;min-width:54px!important;height:48px!important;margin:0!important;padding:0!important;
  border:0!important;border-radius:12px!important;background:var(--cc-accent)!important;color:var(--cc-on-accent)!important;
  box-shadow:none!important;cursor:pointer
}
body.chess-console.cc-owner #game:not(.game-focus) #chat-send:hover:not(:disabled){background:var(--cc-accent-hover)!important}
body.chess-console.cc-owner #game:not(.game-focus) :is(#chat-send,#chat-input):disabled{opacity:.55!important;cursor:not-allowed!important}
body.chess-console.cc-owner #chat-send svg{width:24px;height:24px}
/* Info: real data about the current game and rules links only. */
body.chess-console.cc-owner #game:not(.game-focus) #chess-final-info-panel{
  overflow:auto!important;padding:6px 4px!important;color:var(--cc-ink)!important;
  font:500 14px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
body.chess-console.cc-owner .cc-info-heading{margin:0 0 8px;font:750 13px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--cc-muted)}
body.chess-console.cc-owner .cc-info-list{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px 14px;margin:0 0 16px}
body.chess-console.cc-owner .cc-info-list dt{color:var(--cc-muted);font-weight:600}
body.chess-console.cc-owner .cc-info-list dd{margin:0;color:var(--cc-ink);font-weight:650;overflow-wrap:anywhere}
body.chess-console.cc-owner .cc-info-links{display:grid;gap:6px;margin:0;padding:0;list-style:none}
body.chess-console.cc-owner #game #chess-final-info-panel .cc-info-links :is(a,button){
  display:inline;padding:0;margin:0;border:0;background:none;box-shadow:none;cursor:pointer;text-align:left;
  color:var(--cc-accent)!important;text-decoration:underline;text-underline-offset:2px;font:650 14px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif
}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #chess-final-info-panel .cc-info-links :is(a,button){color:#8fdcd5!important}
/* Five configuration icons under the conversation. */
body.chess-console.cc-owner #game.game-focus .cc-tools{display:none!important}
body.chess-console.cc-owner #game .side-dock>.cc-tools{
  display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;flex:0 0 auto;
  margin:0;padding:10px 0 0;border-top:1px solid var(--cc-line)
}
body.chess-console.cc-owner #game .cc-tool{
  display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:5px;min-width:0;min-height:60px;
  margin:0;padding:6px 2px;border:0;border-radius:10px;background:transparent;color:var(--cc-ink);box-shadow:none;cursor:pointer;
  font:600 12px/1.15 system-ui,-apple-system,'Segoe UI',sans-serif;text-align:center
}
@media (min-width:1300px){body.chess-console.cc-owner #game .cc-tool{font-size:13px}}
body.chess-console.cc-owner #game .cc-tool svg{width:28px;height:28px;flex:none}
body.chess-console.cc-owner #game .cc-tool:hover{background:var(--cc-soft)}
body.chess-console.cc-owner #game .cc-tool:is([aria-expanded="true"],[aria-pressed="true"]){
  background:var(--cc-soft);color:var(--cc-accent);box-shadow:inset 0 -3px 0 var(--cc-accent)
}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .cc-tool:is([aria-expanded="true"],[aria-pressed="true"]){color:#8fdcd5}
body.chess-console.cc-owner .cc-tool-label{display:block;max-width:100%;overflow-wrap:normal;word-break:normal;hyphens:none}
/* In-panel sheets (settings, board, pieces, theme, online games): cover only the content area. */
body.chess-console.cc-owner #game .cc-sheet{
  position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;box-sizing:border-box;
  background:var(--cc-bg);color:var(--cc-ink);border:1px solid var(--cc-line);border-radius:14px;
  box-shadow:0 8px 22px #00262a24;overflow:hidden
}
body.chess-console.cc-owner #game .cc-sheet[hidden]{display:none!important}
body.chess-console.cc-owner #game .cc-sheet-head{
  display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;
  padding:8px 8px 8px 14px;border-bottom:1px solid var(--cc-line);background:var(--cc-surface)
}
body.chess-console.cc-owner #game .cc-sheet-title{margin:0;color:var(--cc-ink);font:750 16px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;text-shadow:none}
body.chess-console.cc-owner #game .cc-sheet-close{
  display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;margin:0;padding:0;
  border:0;border-radius:10px;background:transparent;color:var(--cc-ink);box-shadow:none;cursor:pointer
}
body.chess-console.cc-owner #game .cc-sheet-close:hover{background:var(--cc-soft)}
body.chess-console.cc-owner #game .cc-sheet-close svg{width:22px;height:22px}
body.chess-console.cc-owner #game .cc-sheet-body{
  display:flex;flex-direction:column;gap:12px;flex:1 1 auto;min-height:0;overflow:auto;
  padding:12px 14px 14px;scrollbar-width:thin
}
body.chess-console.cc-owner #game .cc-sheet-body>*{flex-shrink:0!important}
body.chess-console.cc-owner #game .cc-note{margin:0;color:var(--cc-muted);font:500 13px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif}
body.chess-console.cc-owner #game .cc-sheet-status:empty{display:none}
body.chess-console.cc-owner #game .cc-group{display:grid;gap:8px;margin:0;padding:0;border:0;min-width:0}
body.chess-console.cc-owner #game .cc-group[hidden]{display:none!important}
body.chess-console.cc-owner #game .cc-group>legend,body.chess-console.cc-owner #game .cc-group-title{
  margin:0 0 2px;padding:0;color:var(--cc-muted);font:750 12px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;
  letter-spacing:.05em;text-transform:uppercase
}
body.chess-console.cc-owner #game .cc-option{
  display:flex;align-items:center;gap:12px;box-sizing:border-box;min-height:52px;margin:0;padding:8px 12px;
  border:1px solid var(--cc-line);border-radius:12px;background:var(--cc-surface);color:var(--cc-ink);cursor:pointer;
  font:650 14px/1.25 system-ui,-apple-system,'Segoe UI',sans-serif
}
body.chess-console.cc-owner #game .cc-option:has(input:checked){border-color:var(--cc-accent);box-shadow:inset 0 0 0 1px var(--cc-accent)}
body.chess-console.cc-owner #game .side-dock .cc-option input{flex:none!important;width:18px!important;height:18px!important;margin:0!important;padding:0!important;appearance:auto!important;accent-color:var(--cc-accent)!important;box-shadow:none!important}
body.chess-console.cc-owner #game .cc-option-text{display:grid;gap:2px;min-width:0}
body.chess-console.cc-owner #game .cc-option-text small{color:var(--cc-muted);font:500 12px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif}
body.chess-console.cc-owner #game .cc-swatch{display:grid;grid-template-columns:repeat(2,15px);grid-template-rows:repeat(2,15px);flex:none;margin-left:auto;border-radius:3px;overflow:hidden;box-shadow:0 0 0 1px #00000026}
body.chess-console.cc-owner #game .cc-swatch>i:nth-child(1),body.chess-console.cc-owner #game .cc-swatch>i:nth-child(4){background:var(--sw-l)}
body.chess-console.cc-owner #game .cc-swatch>i:nth-child(2),body.chess-console.cc-owner #game .cc-swatch>i:nth-child(3){background:var(--sw-d)}
body.chess-console.cc-owner #game .cc-swatch[data-variant="original"]{--sw-l:#e3d8bd;--sw-d:#479b99}
body.chess-console.cc-owner #game .cc-swatch[data-variant="walnut"]{--sw-l:#ecd8b6;--sw-d:#a77a52}
body.chess-console.cc-owner #game .cc-swatch[data-variant="slate"]{--sw-l:#dfe3e1;--sw-d:#6b7b80}
body.chess-console.cc-owner #game .cc-swatch[data-variant="azure"]{--sw-l:#e2eaee;--sw-d:#6a95ae}
body.chess-console.cc-owner #game .cc-swatch[data-variant="light"]{--sw-l:#faf3e1;--sw-d:#006b6a}
body.chess-console.cc-owner #game .cc-swatch[data-variant="dark"]{--sw-l:#0f2a2d;--sw-d:#1c7a75}
body.chess-console.cc-owner #game .cc-preview{display:flex;gap:2px;flex:none;margin-left:auto;padding:2px 4px;border-radius:8px;background:#e3d8bd}
body.chess-console.cc-owner #game .cc-preview .chess-piece{display:block;width:34px;height:34px}
body.chess-console.cc-owner #game .cc-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
body.chess-console.cc-owner #game .side-dock .cc-button{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;
  box-sizing:border-box!important;width:auto!important;min-height:40px!important;height:auto!important;margin:0!important;
  padding:8px 12px!important;border:1px solid var(--cc-line)!important;border-radius:10px!important;
  background:var(--cc-surface)!important;color:var(--cc-ink)!important;box-shadow:none!important;cursor:pointer;
  text-align:center!important;text-shadow:none!important;font:650 13px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
body.chess-console.cc-owner #game .side-dock .cc-button:hover{background:var(--cc-soft)!important}
body.chess-console.cc-owner #game .side-dock .cc-button[aria-pressed="true"]{border-color:var(--cc-accent)!important;box-shadow:inset 0 0 0 1px var(--cc-accent)!important;color:var(--cc-accent)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock .cc-button[aria-pressed="true"]{color:#8fdcd5!important}
body.chess-console.cc-owner #game .cc-reset{margin-top:auto;align-self:flex-start}
/* Existing computer-game settings inside the Ustawienia sheet. */
body.chess-console.cc-owner #game #cc-sheet-settings #training-settings{
  display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:none!important;grid-auto-flow:row!important;gap:12px!important;position:static!important;width:auto!important;height:auto!important;
  min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important;
  background:transparent!important;border:0!important;box-shadow:none!important
}
body.chess-console.cc-owner #game #cc-sheet-settings #training-settings[hidden],
body.chess-console.cc-owner #game #cc-sheet-settings [hidden]{display:none!important}
body.chess-console.cc-owner #game #cc-sheet-settings #training-settings>:is(h2,details,.chess-claim-draw){display:none!important}
body.chess-console.cc-owner #game #cc-sheet-settings :is(.chess-owner-options,.chess-opponent-row,.chess-owner-level,.chess-time-row,.cc-bonus-row){
  display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:5px!important;position:static!important;
  width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;
  background:transparent!important;border:0!important;box-shadow:none!important
}
body.chess-console.cc-owner #game #cc-sheet-settings .chess-owner-options{gap:12px!important}
body.chess-console.cc-owner #game #cc-sheet-settings #training-settings *{grid-column:auto!important;grid-row:auto!important;max-width:100%!important;min-width:0!important}
body.chess-console.cc-owner #game #cc-sheet-settings label{
  display:block!important;position:static!important;width:auto!important;height:auto!important;margin:0!important;
  clip:auto!important;clip-path:none!important;overflow:visible!important;color:var(--cc-ink)!important;
  text-shadow:none!important;font:700 13px/1.25 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
body.chess-console.cc-owner #game #cc-sheet-settings select{
  display:block!important;position:static!important;box-sizing:border-box!important;width:100%!important;height:42px!important;
  min-height:42px!important;margin:0!important;padding:0 10px!important;clip:auto!important;clip-path:none!important;
  border:1px solid var(--cc-line)!important;border-radius:10px!important;background:var(--cc-surface)!important;
  color:var(--cc-ink)!important;box-shadow:none!important;opacity:1!important;
  font:600 14px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif!important
}
/* Online games sheet: the existing accepted-game list and invitation clock settings. */
body.chess-console.cc-owner #game #cc-sheet-online #online-settings:not([hidden]){
  display:block!important;position:static!important;width:auto!important;height:auto!important;min-height:0!important;
  max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important;
  background:transparent!important;border:0!important;box-shadow:none!important
}
body.chess-console.cc-owner #game #cc-sheet-online .chess-final-grid{grid-template-columns:minmax(0,1fr)!important}
body.chess-console.cc-owner #game #cc-sheet-online :is(label[for="create-room-friend"],#create-room-friend){display:none!important}
/* Panel theme: dark variant for the right panel only (board colours untouched). */
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-move-row{color:var(--cc-ink)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-history-turn:nth-child(even){background:#163a3d!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-history-turn{border-bottom-color:var(--cc-line)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-history-number{color:var(--cc-muted)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-move-row.chess-history-selected{background:#3d5a3a!important;color:#fff!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-move-row:hover:not(:disabled){background:#21494d!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-history-nav{background:#163538!important;border-top-color:var(--cc-line)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-history-action{background:#21474b!important;color:var(--cc-ink)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel .chess-history-action.chess-history-live{background:var(--cc-accent)!important;color:#fff!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game #moves-panel :is(.chess-history-nav-status,#moves-list,.history-footer){color:var(--cc-muted)!important;background:transparent!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock #online-settings :is(h2,h3,p,small,label,legend,span,strong,summary){color:var(--cc-ink)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock :is(.chess-final-room-card,.chess-final-create-card){background:var(--cc-surface)!important;border-color:var(--cc-line)!important;color:var(--cc-ink)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock .chess-final-card-title{background:var(--cc-soft)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock :is(.chess-final-card-title h2,.chess-final-card-title h3,.chess-final-room-name,.chess-final-refresh){color:var(--cc-ink)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock .chess-final-times button{background:var(--cc-soft)!important;color:var(--cc-ink)!important;border-color:var(--cc-line)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock .chess-final-times button[aria-pressed="true"]{background:var(--cc-accent)!important;color:#fff!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock :is(#create-room-increment,#chess-final-room-list a,.chess-final-room-card>.textlink){color:var(--cc-ink)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock #create-room-increment{background:var(--cc-surface)!important;border-color:var(--cc-line)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock #game-state:has(.chess-promote){background:var(--cc-soft)!important;color:var(--cc-ink)!important}
body.chess-console.cc-owner[data-cc-theme="dark"] #game .side-dock .chess-owner-claim-draw{background:var(--cc-accent)!important;color:#fff!important}
/* Board appearance (only after an explicit choice; default = the original board). */
body.chess-console[data-cc-board="walnut"]{--ccb-l:#ecd8b6;--ccb-d:#a77a52;--ccb-ls:#e4c78a;--ccb-ds:#c2965f;--ccb-lh:#e5cfa2;--ccb-dh:#b98a5e;--ccb-lc:#7a5230;--ccb-dc:#fbf0dd}
body.chess-console[data-cc-board="slate"]{--ccb-l:#dfe3e1;--ccb-d:#6b7b80;--ccb-ls:#cdd9cb;--ccb-ds:#86a19a;--ccb-lh:#d2dad6;--ccb-dh:#7d9094;--ccb-lc:#3c4f56;--ccb-dc:#f1f5f3}
body.chess-console[data-cc-board="azure"]{--ccb-l:#e2eaee;--ccb-d:#6a95ae;--ccb-ls:#cfe0d5;--ccb-ds:#86b0b9;--ccb-lh:#d4e1e7;--ccb-dh:#7ea6bc;--ccb-lc:#2f5a72;--ccb-dc:#f2f8fb}
body.chess-console[data-cc-board] #board .chess-square.light{background-color:var(--ccb-l)!important}
body.chess-console[data-cc-board] #board .chess-square.dark{background-color:var(--ccb-d)!important}
body.chess-console[data-cc-board] #board .chess-square.light.chess-selected{background-color:var(--ccb-ls)!important}
body.chess-console[data-cc-board] #board .chess-square.dark.chess-selected{background-color:var(--ccb-ds)!important}
body.chess-console[data-cc-board] #board .chess-square.light:is(.chess-target:hover,.chess-drop-hover){background-color:var(--ccb-lh)!important}
body.chess-console[data-cc-board] #board .chess-square.dark:is(.chess-target:hover,.chess-drop-hover){background-color:var(--ccb-dh)!important}
body.chess-console[data-cc-board] #board .chess-square.light .chess-coordinate{color:var(--ccb-lc)!important}
body.chess-console[data-cc-board] #board .chess-square.dark .chess-coordinate{color:var(--ccb-dc)!important}
/* Piece appearance: recolours the same original vectors (no external assets). */
body.chess-console[data-cc-pieces="flat"] .chess-piece[data-color="white"]:not(.cc-preview *)>path[data-body],
body.chess-console .cc-preview[data-variant="flat"] .chess-piece[data-color="white"]>path[data-body]{fill:#fbfaf6!important;stroke:#1d2b32!important}
body.chess-console[data-cc-pieces="flat"] .chess-piece[data-color="white"]:not(.cc-preview *)>path:nth-of-type(2),
body.chess-console .cc-preview[data-variant="flat"] .chess-piece[data-color="white"]>path:nth-of-type(2){stroke:#5f6f76!important}
body.chess-console[data-cc-pieces="flat"] .chess-piece[data-color="white"]:not(.cc-preview *)>path:nth-of-type(3),
body.chess-console .cc-preview[data-variant="flat"] .chess-piece[data-color="white"]>path:nth-of-type(3){stroke:#fbfaf6!important}
body.chess-console[data-cc-pieces="flat"] .chess-piece[data-color="black"]:not(.cc-preview *)>path[data-body],
body.chess-console .cc-preview[data-variant="flat"] .chess-piece[data-color="black"]>path[data-body]{fill:#1f2a31!important;stroke:#091217!important}
body.chess-console[data-cc-pieces="flat"] .chess-piece[data-color="black"]:not(.cc-preview *)>path:nth-of-type(2),
body.chess-console .cc-preview[data-variant="flat"] .chess-piece[data-color="black"]>path:nth-of-type(2){stroke:#8e9ea6!important}
body.chess-console[data-cc-pieces="flat"] .chess-piece[data-color="black"]:not(.cc-preview *)>path:nth-of-type(3),
body.chess-console .cc-preview[data-variant="flat"] .chess-piece[data-color="black"]>path:nth-of-type(3){stroke:#1f2a31!important}
body.chess-console[data-cc-pieces="wood"] .chess-piece[data-color="white"]:not(.cc-preview *)>path[data-body],
body.chess-console .cc-preview[data-variant="wood"] .chess-piece[data-color="white"]>path[data-body]{fill:#f1ddb7!important;stroke:#5b3c1f!important}
body.chess-console[data-cc-pieces="wood"] .chess-piece[data-color="white"]:not(.cc-preview *)>path:nth-of-type(2),
body.chess-console .cc-preview[data-variant="wood"] .chess-piece[data-color="white"]>path:nth-of-type(2){stroke:#a27a4f!important}
body.chess-console[data-cc-pieces="wood"] .chess-piece[data-color="white"]:not(.cc-preview *)>path:nth-of-type(3),
body.chess-console .cc-preview[data-variant="wood"] .chess-piece[data-color="white"]>path:nth-of-type(3){stroke:#fff6e4!important}
body.chess-console[data-cc-pieces="wood"] .chess-piece[data-color="black"]:not(.cc-preview *)>path[data-body],
body.chess-console .cc-preview[data-variant="wood"] .chess-piece[data-color="black"]>path[data-body]{fill:#5a3920!important;stroke:#21130a!important}
body.chess-console[data-cc-pieces="wood"] .chess-piece[data-color="black"]:not(.cc-preview *)>path:nth-of-type(2),
body.chess-console .cc-preview[data-variant="wood"] .chess-piece[data-color="black"]>path:nth-of-type(2){stroke:#a9845f!important}
body.chess-console[data-cc-pieces="wood"] .chess-piece[data-color="black"]:not(.cc-preview *)>path:nth-of-type(3),
body.chess-console .cc-preview[data-variant="wood"] .chess-piece[data-color="black"]>path:nth-of-type(3){stroke:#8c6545!important}
@media (max-width:800px){
  body.chess-console.cc-owner #game .cc-tool{min-height:58px}
  body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player strong{font-size:12px!important}
  body.chess-console.cc-owner #game:not(.game-focus) .cc-top .players>.player{padding:2px 3px!important}
  body.chess-console.cc-owner .cc-account{gap:0}
  body.chess-console.cc-owner .cc-icon-link{width:40px}
  body.chess-console.cc-owner #game:not(.game-focus) .side-dock>.chess-reference-actions>button{font-size:14px!important}
}
@media (max-width:360px){
  body.chess-console.cc-owner #game:not(.game-focus) .cc-top .player strong{font-size:11px!important}
  body.chess-console.cc-owner #game .cc-tool{font-size:11px}
  body.chess-console.cc-owner .cc-icon-link{width:36px}
}
@media (prefers-reduced-motion:reduce){body.chess-console.cc-owner #game .cc-sheet{transition:none}}
`;

export const chessOwnerConsoleJs = String.raw`
/* CHESS-CONSOLE-OWNER-P1 (#814): approved right console from existing nodes. */
(function(){
 const NS='http://www.w3.org/2000/svg';
 const PATHS={
  mail:'<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.2"/><path d="m3.6 6.6 8.4 6.6 8.4-6.6"/>',
  profile:'<circle cx="12" cy="7.9" r="3.9"/><path d="M4.4 20.6c.7-4.3 3.6-6.6 7.6-6.6s6.9 2.3 7.6 6.6"/>',
  newGame:'<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3"/><path d="M12 8.2v7.6M8.2 12h7.6"/>',
  rematch:'<path d="M19.4 9.4A7.9 7.9 0 0 0 5.3 7.5"/><path d="M4.6 14.6a7.9 7.9 0 0 0 14.1 1.9"/><path d="M4.9 3.7v4.2h4.2M19.1 20.3v-4.2h-4.2"/>',
  invite:'<path d="M10.1 13.9a4.1 4.1 0 0 0 5.8 0l3-3a4.1 4.1 0 1 0-5.8-5.8l-1.1 1.1"/><path d="M13.9 10.1a4.1 4.1 0 0 0-5.8 0l-3 3a4.1 4.1 0 1 0 5.8 5.8l1.1-1.1"/>',
  chat:'<path d="M3.8 11.4c0-3.9 3.7-6.9 8.2-6.9s8.2 3 8.2 6.9-3.7 6.9-8.2 6.9c-1 0-2-.1-2.9-.4L4.6 19.5l1.3-3.5c-1.3-1.2-2.1-2.8-2.1-4.6Z"/>',
  moves:'<path d="M9.3 6.5h10.4M9.3 12h10.4M9.3 17.5h10.4"/><path d="M4.6 6.5h.4M4.6 12h.4M4.6 17.5h.4" stroke-width="2.6"/>',
  info:'<circle cx="12" cy="12" r="8.6"/><path d="M12 10.8v5.8"/><path d="M12 7.5v.1" stroke-width="2.6"/>',
  settings:'<path d="M19.17 12.67L21.07 14.05L19.87 16.96L17.54 16.6L16.6 17.54L16.96 19.87L14.05 21.07L12.67 19.17L11.33 19.17L9.95 21.07L7.04 19.87L7.4 17.54L6.46 16.6L4.13 16.96L2.93 14.05L4.83 12.67L4.83 11.33L2.93 9.95L4.13 7.04L6.46 7.4L7.4 6.46L7.04 4.13L9.95 2.93L11.33 4.83L12.67 4.83L14.05 2.93L16.96 4.13L16.6 6.46L17.54 7.4L19.87 7.04L21.07 9.95L19.17 11.33Z"/><circle cx="12" cy="12" r="3"/>',
  board:'<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="1.2"/><path d="M3.6 3.6h5.6v5.6H3.6zM14.8 3.6h5.6v5.6h-5.6zM9.2 9.2h5.6v5.6H9.2zM3.6 14.8h5.6v5.6H3.6zM14.8 14.8h5.6v5.6h-5.6z" fill="currentColor" stroke="none"/>',
  pieces:'<circle cx="12" cy="6.4" r="2.7"/><path d="M9.4 10.4h5.2"/><path d="M10.4 10.4c0 3.1-.9 5.3-2.5 7.2h8.2c-1.6-1.9-2.5-4.1-2.5-7.2"/><path d="M6.4 20.6h11.2"/>',
  theme:'<circle cx="12" cy="12" r="3.9"/><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6"/>',
  fullscreen:'<path d="M4 9.2V4h5.2M14.8 4H20v5.2M20 14.8V20h-5.2M9.2 20H4v-5.2"/><path d="m4 4 5 5M20 4l-5 5M20 20l-5-5M4 20l5-5"/>',
  exitFullscreen:'<path d="M9.2 4v5.2H4M20 9.2h-5.2V4M14.8 20v-5.2H20M4 14.8h5.2V20"/>',
  close:'<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
  send:'<path d="M20.6 3.4 3.6 10.3l6.6 2.9 2.9 6.6 7.5-16.4Z"/><path d="m10.2 13.2 4.6-4.6"/>'
 };
 function icon(name,className){
  const node=document.createElementNS(NS,'svg');
  node.setAttribute('viewBox','0 0 24 24');node.setAttribute('fill','none');node.setAttribute('stroke','currentColor');
  node.setAttribute('stroke-width','1.8');node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');
  node.setAttribute('aria-hidden','true');node.setAttribute('focusable','false');
  if(className)node.setAttribute('class',className);
  node.innerHTML=PATHS[name]||'';
  return node;
 }
 function E(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!=null)node.textContent=text;
  return node;
 }
 const $=id=>document.getElementById(id);
 // ---- validated local appearance preferences ----
 const PREF_KEY='gracz-chess-appearance-v1';
 const CHOICES={board:['original','walnut','slate','azure'],pieces:['original','flat','wood'],theme:['light','dark'],chat:['normal','large']};
 const DEFAULTS={board:'original',pieces:'original',theme:'light',chat:'normal'};
 function readPrefs(){
  const prefs=Object.assign({},DEFAULTS);
  try{
   const raw=JSON.parse(localStorage.getItem(PREF_KEY)||'null');
   if(raw&&typeof raw==='object'&&!Array.isArray(raw))
    for(const key of Object.keys(DEFAULTS))if(CHOICES[key].includes(raw[key]))prefs[key]=raw[key];
  }catch(_error){/* invalid JSON: keep the original look */}
  return prefs;
 }
 function init(){
  const body=document.body,layout=$('game');
  if(!body||!layout||!body.classList.contains('chess-console')||layout.dataset.ownerConsole==='yes')return;
  const boardarea=layout.querySelector(':scope > .boardarea');
  const dock=boardarea&&boardarea.querySelector(':scope > .side-dock');
  const board=$('board'),players=layout.querySelector('.players'),mode=layout.querySelector('.mode');
  const sidebar=dock&&dock.querySelector(':scope > .sidebar');
  const actions=dock&&dock.querySelector(':scope > .chess-reference-actions');
  const match=dock&&dock.querySelector(':scope > #match-panel');
  const restart=actions&&actions.querySelector('#restart');
  const onlineNew=actions&&actions.querySelector('.chess-owner-online-new');
  const rematch=actions&&actions.querySelector('.chess-owner-rematch');
  const invite=actions&&actions.querySelector('.chess-reference-invite');
  const trainingMode=$('training-mode'),onlineMode=$('online-mode');
  if(!boardarea||!dock||!board||!players||!mode||!sidebar||!actions||!match||!restart||!onlineNew||!rematch||!invite||!trainingMode||!onlineMode)return;
  layout.dataset.ownerConsole='yes';

  // ---- top row: clocks + envelope + profile ----
  const top=E('div','cc-top');
  const account=E('div','cc-account');
  const mail=E('a','cc-icon-link cc-mail');
  mail.href='/konto/panel/?sekcja=messages';mail.title='Wiadomości';mail.setAttribute('aria-label','Wiadomości');
  const badge=E('span','cc-mail-badge');badge.hidden=true;badge.setAttribute('aria-hidden','true');
  mail.append(icon('mail'),badge);
  const profile=E('a','cc-icon-link cc-profile');
  profile.href='/konto/panel/?sekcja=profile';profile.title='Mój profil';profile.setAttribute('aria-label','Mój profil');
  profile.append(icon('profile'));
  account.append(mail,profile);
  top.append(players,account);
  dock.insertBefore(top,dock.firstChild);
  // Earlier layers move clocks/modes above the board on phones or on resize; the owner's
  // console keeps them in the panel (below the board on phones). Runs after those movers.
  function place(){
   if(layout.classList.contains('game-focus'))return;
   if(players.parentElement!==top)top.insertBefore(players,account);
   mode.classList.remove('chess-mobile-mode');
   if(mode.parentElement!==sidebar||sidebar.firstElementChild!==mode)sidebar.insertBefore(mode,sidebar.firstChild);
  }
  place();
  window.addEventListener('resize',place,{passive:true});
  new MutationObserver(place).observe(layout,{attributes:true,attributeFilter:['class']});
  for(const [button,label] of [[trainingMode,'Graj z komputerem'],[onlineMode,'Graj online ze znajomym']]){button.title=label;}

  // ---- small text navigation above the board (desktop) ----
  const nav=E('nav','cc-site-nav');nav.setAttribute('aria-label','GRACZ.PL');
  for(const [text,href] of [['Start','https://gracz.pl/'],['Nasze gry','https://gracz.pl/gry/'],['Poradnik','https://gracz.pl/poradniki/'],
   ['Blog','https://gracz.pl/#aktualnosci'],['Newsletter','https://gracz.pl/newsletter/'],['Mój panel','/konto/panel/']]){
   const link=E('a','',text);link.href=href;nav.append(link);
  }
  boardarea.insertBefore(nav,boardarea.firstChild);

  // ---- live unread badge (GET /auth/message-center) ----
  let unreadBusy=false,unreadAt=0,unreadTimer=0;
  function showUnread(total){
   if(total>0){
    const text=total>99?'99+':String(total);
    if(badge.textContent!==text)badge.textContent=text;
    badge.hidden=false;
    const label='Wiadomości — '+total+' '+(total===1?'nieprzeczytana':'nieprzeczytanych');
    mail.setAttribute('aria-label',label);mail.title=label;
   }else{
    badge.hidden=true;badge.textContent='';
    mail.setAttribute('aria-label','Wiadomości — brak nieprzeczytanych');mail.title='Wiadomości';
   }
   mail.dataset.unread=String(total);
  }
  function signedOut(){
   badge.hidden=true;badge.textContent='';delete mail.dataset.unread;
   mail.setAttribute('aria-label','Wiadomości — zaloguj się, aby je zobaczyć');mail.title='Wiadomości (wymaga zalogowania)';
  }
  async function refreshUnread(force){
   if(unreadBusy||document.hidden)return;
   const now=Date.now();if(!force&&now-unreadAt<4000)return;
   unreadBusy=true;unreadAt=now;
   try{
    const response=await fetch('/auth/message-center',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    if(response.status===401||response.status===403){signedOut();return;}
    if(!response.ok)return; // keep the last verified state; never show an invented 0
    const data=await response.json();
    if(!data||data.ok!==true||!Array.isArray(data.conversations))return;
    // Same rule as the panel's msg-unread: unread from non-archived conversations.
    const total=data.conversations.reduce((sum,row)=>{
     if(!row||row.archived===true)return sum;
     const value=Number(row.unread);
     return sum+(Number.isFinite(value)&&value>0?Math.floor(value):0);
    },0);
    showUnread(total);
   }catch(_error){/* transient network error: keep the last verified count */}
   finally{unreadBusy=false;}
  }
  function startUnreadTimer(){
   if(unreadTimer)return;
   unreadTimer=window.setInterval(()=>{if(!document.hidden)void refreshUnread(true);},50000);
  }
  void refreshUnread(true);startUnreadTimer();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshUnread(false);});
  window.addEventListener('focus',()=>void refreshUnread(false));
  window.addEventListener('pagehide',()=>{window.clearInterval(unreadTimer);unreadTimer=0;});
  window.addEventListener('pageshow',event=>{startUnreadTimer();if(event.persisted)void refreshUnread(true);});

  // ---- three actions ----
  function decorate(button,name,label){
   button.replaceChildren(icon(name,'cc-action-icon'),E('span','cc-action-label',label));
  }
  decorate(onlineNew,'newGame','Nowa gra');decorate(restart,'newGame','Nowa gra');
  decorate(rematch,'rematch','Rewanż');decorate(invite,'invite','Zaproś');
  restart.title='Nowa partia z bieżącymi ustawieniami';
  onlineNew.title='Nowa partia online: wybierz przyjęte zaproszenie lub zaproś znajomego';
  invite.title='Zaproś znajomego do partii online';
  onlineNew.setAttribute('aria-controls','cc-sheet-online');onlineNew.setAttribute('aria-expanded','false');
  function syncActions(){
   const finished=board.dataset.consoleGame==='finished',online=board.dataset.consoleMode==='online';
   const opponent=board.dataset.consoleOpponent||'';
   const can=finished&&(!online||!!opponent);
   rematch.disabled=!can;
   rematch.title=can?(online?'Rewanż: ponowne zaproszenie dla '+opponent:'Rewanż: nowa partia z tymi samymi ustawieniami'):'Rewanż będzie dostępny po zakończeniu partii';
  }
  function chooseOption(id,value){
   const select=$(id);
   if(!select||!value||![...select.options].some(option=>option.value===value)||select.value===value)return;
   select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function rematchOnline(){
   const opponent=board.dataset.consoleOpponent||'';if(!opponent)return;
   chooseOption('create-room-time',board.dataset.consoleLimit||'');
   chooseOption('create-room-increment',board.dataset.consoleIncrement||'');
   // Existing invitation window (real friends + presence); the player confirms sending.
   $('invite-friend')?.click();
   const search=$('chess-invite-search'),list=$('chess-invite-friends');
   if(!search||!list)return;
   search.value=opponent;search.dispatchEvent(new Event('input',{bubbles:true}));
   const find=()=>[...list.querySelectorAll('.chess-invite-friend')].find(item=>item.querySelector('.chess-invite-friend-name')?.textContent===opponent);
   const pick=()=>{const item=find();if(item&&item.getAttribute('aria-selected')!=='true'){item.click();return true;}return !!item;};
   if(pick())return;
   const watch=new MutationObserver(()=>{if(pick())watch.disconnect();});
   watch.observe(list,{childList:true,subtree:true});
   window.setTimeout(()=>watch.disconnect(),6000);
  }
  rematch.addEventListener('click',()=>{
   if(rematch.disabled)return;
   if(board.dataset.consoleMode==='online')rematchOnline();else restart.click();
  });

  // ---- tabs: icons + Info with real game data ----
  const chatTab=$('chat-tab'),movesTab=$('history-tab'),infoTab=$('chess-final-info-tab');
  for(const [tab,name] of [[chatTab,'chat'],[movesTab,'moves'],[infoTab,'info']])
   if(tab&&!tab.querySelector('.cc-tab-icon'))tab.prepend(icon(name,'cc-tab-icon'));
  const infoPanel=$('chess-final-info-panel');
  const infoValues={};
  if(infoPanel){
   const heading=E('h3','cc-info-heading','Bieżąca partia');
   const list=E('dl','cc-info-list');
   for(const [key,label] of [['mode','Tryb'],['opponent','Przeciwnik'],['state','Stan'],['clock','Czas'],['moves','Posunięcia']]){
    const dd=E('dd','','—');dd.dataset.info=key;infoValues[key]=dd;
    list.append(E('dt','',label),dd);
   }
   const rulesHeading=E('h3','cc-info-heading','Zasady i pomoc');
   const links=E('ul','cc-info-links');
   const howtoButton=$('howto-open');
   if(howtoButton){
    const howto=E('button','','Jak grać w szachy? — krótki przewodnik');howto.type='button';
    howto.addEventListener('click',()=>howtoButton.click());
    const item=E('li');item.append(howto);links.append(item);
   }
   const wiki=E('a','','Pełne zasady gry w szachy (Wikipedia)');
   wiki.href='https://pl.wikipedia.org/wiki/Szachy';wiki.target='_blank';wiki.rel='noopener noreferrer';
   const panelLink=E('a','','Moje partie i zaproszenia w Panelu Gracza');panelLink.href='/konto/panel/?sekcja=play';
   for(const link of [wiki,panelLink]){const item=E('li');item.append(link);links.append(item);}
   infoPanel.replaceChildren(heading,list,rulesHeading,links);
  }
  const selectedText=id=>{const select=$(id);return select?.selectedOptions?.[0]?.textContent?.trim()||'';};
  function setInfo(key,value){const node=infoValues[key];if(node&&node.textContent!==value)node.textContent=value;}
  function updateInfo(){
   if(!infoPanel)return;
   const online=board.dataset.consoleMode==='online',game=board.dataset.consoleGame||'new';
   const human=$('chess-opponent')?.value==='human';
   setInfo('mode',online?'Online — partia ze znajomym':human?'Dwie osoby przy jednym urządzeniu':'Gra z komputerem');
   const opponent=board.dataset.consoleOpponent||'';
   setInfo('opponent',online?(opponent||'Nie wybrano partii'):human?'Drugi gracz lokalnie':'Komputer — '+(selectedText('ai-level')||'poziom domyślny'));
   const state=$('game-state');
   const stateText=state?.querySelector('.chess-promote')?'Wybór figury promocji':(state?.textContent||'').trim();
   setInfo('state',stateText||(game==='finished'?'Partia zakończona':'—'));
   let clockText='Bez limitu czasu';
   if(online){
    const limit=Number(board.dataset.consoleLimit),increment=Number(board.dataset.consoleIncrement);
    if(game==='none')clockText='Wybór przy zaproszeniu: '+(selectedText('create-room-time')||'—');
    else if(limit>0)clockText=limit+' min'+(increment>0?' + '+increment+' s na ruch':'');
   }else if(Number($('training-time')?.value||0)>0){
    const bonus=Number($('training-increment')?.value||0);
    clockText=selectedText('training-time')+(bonus>0?' + '+selectedText('training-increment'):'');
   }
   setInfo('clock',clockText);
   setInfo('moves',($('history-count')?.textContent||'0').trim());
  }

  // ---- sheets (one at a time, inside the content area) ----
  const sheets=new Map();let openKind=null,opener=null;
  function makeSheet(kind,title){
   const sheet=E('section','cc-sheet');sheet.id='cc-sheet-'+kind;sheet.hidden=true;sheet.dataset.kind=kind;
   sheet.setAttribute('role','region');sheet.setAttribute('aria-labelledby',sheet.id+'-title');
   const head=E('header','cc-sheet-head'),heading=E('h2','cc-sheet-title',title);heading.id=sheet.id+'-title';
   const close=E('button','cc-sheet-close');close.type='button';close.title='Zamknij';
   close.setAttribute('aria-label','Zamknij: '+title);close.append(icon('close'));
   close.addEventListener('click',()=>closeSheet(true));
   const content=E('div','cc-sheet-body');
   head.append(heading,close);sheet.append(head,content);match.append(sheet);
   sheets.set(kind,{sheet,content});
   return content;
  }
  const triggers=new Map();
  function openSheet(kind,trigger,focus){
   if(openKind===kind){closeSheet(true);return;}
   closeSheet(false);
   const entry=sheets.get(kind);if(!entry)return;
   for(const child of match.children)if(child!==entry.sheet&&!child.classList.contains('cc-sheet'))child.inert=true;
   entry.sheet.hidden=false;openKind=kind;opener=trigger||triggers.get(kind)||null;
   match.classList.add('cc-sheet-open');
   for(const [name,button] of triggers)button.setAttribute('aria-expanded',String(name===kind));
   if(kind==='online')onlineNew.setAttribute('aria-expanded','true');
   if(kind==='pieces')buildPiecePreviews();
   if(focus!==false)(entry.sheet.querySelector('input:checked')||entry.sheet.querySelector('.cc-sheet-close')).focus({preventScroll:true});
  }
  function closeSheet(restoreFocus){
   if(!openKind)return;
   const entry=sheets.get(openKind);entry.sheet.hidden=true;
   for(const child of match.children)child.inert=false;
   match.classList.remove('cc-sheet-open');
   for(const button of triggers.values())button.setAttribute('aria-expanded','false');
   onlineNew.setAttribute('aria-expanded','false');
   const back=opener;openKind=null;opener=null;
   if(restoreFocus&&back&&back.isConnected&&back.getClientRects().length)back.focus({preventScroll:true});
  }
  document.addEventListener('keydown',event=>{
   if(event.key!=='Escape'||!openKind)return;
   const modal=['console-config-modal','howto-modal','chess-invite-overlay','game-result-modal'].some(id=>{const node=$(id);return node&&!node.hidden;});
   if(!modal)closeSheet(true);
  });

  // Online games: existing accepted-game list and invitation clock (no fake rooms).
  const onlineSettings=$('online-settings');
  const onlineContent=makeSheet('online','Partie online');
  const onlineStatus=E('p','cc-note cc-sheet-status');onlineStatus.setAttribute('aria-live','polite');
  if(onlineSettings)onlineContent.append(onlineStatus,onlineSettings);
  else onlineContent.append(E('p','cc-note','Gra online jest chwilowo niedostępna.'));
  onlineNew.addEventListener('click',()=>openSheet('online',onlineNew,true));

  // Ustawienia: the existing computer-game settings + console studio + chat size.
  const settingsContent=makeSheet('settings','Ustawienia gry');
  const training=$('training-settings');
  if(training){
   const bonusLabel=layout.querySelector('label[for="training-increment"]'),bonus=$('training-increment');
   if(bonusLabel&&bonus){const row=E('div','cc-bonus-row');row.append(bonusLabel,bonus);training.append(row);}
   settingsContent.append(training);
  }
  const onlineNote=E('div','cc-group');
  onlineNote.append(E('p','cc-note','W grze Online czas i bonus wybierasz przy zaproszeniu. Ustawienia partii z komputerem są dostępne w trybie Komputer.'));
  const toOnline=E('button','cc-button','Partie online i zaproszenia');toOnline.type='button';
  toOnline.addEventListener('click',()=>openSheet('online',triggers.get('settings'),true));
  onlineNote.append(toOnline);
  settingsContent.append(onlineNote);
  const general=E('div','cc-group');
  general.append(E('p','cc-group-title','Wygoda'));
  const chatSize=E('button','cc-button','Większy tekst czatu');chatSize.type='button';chatSize.setAttribute('aria-pressed','false');
  const studio=E('button','cc-button','Układ konsoli i sterowanie figurami');studio.type='button';
  const row=E('div','cc-row');row.append(chatSize,studio);general.append(row);
  settingsContent.append(general);
  function syncSettingsMode(){
   const online=onlineMode.classList.contains('active');
   onlineNote.hidden=!online;
  }
  let studioReturn=false;
  studio.addEventListener('click',()=>{
   const launcher=$('console-config-open');if(!launcher)return;
   studioReturn=true;closeSheet(false);launcher.click();
  });
  const configModal=$('console-config-modal');
  if(configModal)new MutationObserver(()=>{
   if(configModal.hidden&&studioReturn){studioReturn=false;triggers.get('settings')?.focus({preventScroll:true});}
  }).observe(configModal,{attributes:true,attributeFilter:['hidden']});

  // Appearance sheets: board, pieces, panel theme (validated, stored locally).
  let prefs=readPrefs();
  const radios={board:[],pieces:[],theme:[]};
  function optionList(content,key,legend,options,decorateOption){
   const group=E('fieldset','cc-group');group.append(E('legend','',legend));
   for(const [value,label,detail] of options){
    const option=E('label','cc-option');
    const input=E('input');input.type='radio';input.name='cc-'+key;input.value=value;
    input.addEventListener('change',()=>{if(input.checked)setPref(key,value);});
    const text=E('span','cc-option-text');text.append(E('span','',label));if(detail)text.append(E('small','',detail));
    option.append(input,text);
    if(decorateOption)option.append(decorateOption(value));
    group.append(option);radios[key].push(input);
   }
   content.append(group);
  }
  const swatch=value=>{const node=E('span','cc-swatch');node.dataset.variant=value;node.setAttribute('aria-hidden','true');for(let i=0;i<4;i++)node.append(E('i'));return node;};
  const previews=[];
  const piecePreview=value=>{const node=E('span','cc-preview');node.dataset.variant=value;node.setAttribute('aria-hidden','true');previews.push(node);return node;};
  function buildPiecePreviews(){
   if(typeof createChessPiece!=='function')return;
   for(const node of previews)if(!node.childElementCount)for(const piece of ['N','n']){const svg=createChessPiece(document,piece);if(svg)node.append(svg);}
  }
  function resetButton(content){
   const button=E('button','cc-button cc-reset','Przywróć oryginalny wygląd');button.type='button';
   button.addEventListener('click',()=>{prefs=Object.assign({},DEFAULTS);applyPrefs(true);});
   content.append(button);
  }
  const boardContent=makeSheet('board','Wygląd planszy');
  optionList(boardContent,'board','Kolory pól',[
   ['original','Oryginalna GRACZ.PL','Domyślna — turkus i krem'],['walnut','Orzech','Ciepłe drewno'],
   ['slate','Grafit','Spokojna szarość'],['azure','Lazur','Chłodny błękit']],swatch);
  boardContent.append(E('p','cc-note','Zmienia tylko kolory pól. Figury, współrzędne i zasady gry pozostają bez zmian.'));
  resetButton(boardContent);
  const piecesContent=makeSheet('pieces','Wygląd figur');
  optionList(piecesContent,'pieces','Zestaw figur',[
   ['original','Oryginalne GRACZ.PL','Domyślne figury SVG'],['flat','Kontrastowe','Płaskie, mocny kontrast'],
   ['wood','Drewniane','Jasne i ciemne drewno']],piecePreview);
  piecesContent.append(E('p','cc-note','Te same kształty figur w innej kolorystyce, bez zewnętrznych grafik.'));
  resetButton(piecesContent);
  const themeContent=makeSheet('theme','Motyw panelu');
  optionList(themeContent,'theme','Motyw prawego panelu',[
   ['light','Jasny','Domyślny — kremowy z turkusem'],['dark','Ciemny','Ciemny turkus, mniej blasku']],swatch);
  themeContent.append(E('p','cc-note','Motyw zmienia wyłącznie prawy panel. Kolory szachownicy wybierasz w opcji Plansza.'));
  resetButton(themeContent);
  function storePrefs(){
   try{
    const isDefault=Object.keys(DEFAULTS).every(key=>prefs[key]===DEFAULTS[key]);
    if(isDefault)localStorage.removeItem(PREF_KEY);else localStorage.setItem(PREF_KEY,JSON.stringify(prefs));
   }catch(_error){/* storage unavailable: the choice applies to this page only */}
  }
  function applyPrefs(save){
   for(const [key,attr] of [['board','ccBoard'],['pieces','ccPieces'],['theme','ccTheme']]){
    if(prefs[key]===DEFAULTS[key])delete body.dataset[attr];else body.dataset[attr]=prefs[key];
    for(const input of radios[key])input.checked=input.value===prefs[key];
   }
   const large=prefs.chat==='large';
   if(body.classList.contains('chess-large-chat')!==large){
    const toggle=$('game-settings');
    if(toggle)toggle.click();else body.classList.toggle('chess-large-chat',large);
   }
   chatSize.setAttribute('aria-pressed',String(large));
   if(save)storePrefs();
  }
  function setPref(key,value){if(!CHOICES[key].includes(value))return;prefs[key]=value;applyPrefs(true);}
  chatSize.addEventListener('click',()=>setPref('chat',prefs.chat==='large'?'normal':'large'));
  applyPrefs(false);
  window.addEventListener('storage',event=>{if(event.key===PREF_KEY){prefs=readPrefs();applyPrefs(false);}});

  // ---- five configuration icons ----
  const tools=E('nav','cc-tools');tools.setAttribute('aria-label','Ustawienia i widok gry');
  function tool(kind,name,label,title){
   const button=E('button','cc-tool');button.type='button';button.dataset.tool=kind;
   button.title=title;button.setAttribute('aria-label',title);
   button.append(icon(name),E('span','cc-tool-label',label));tools.append(button);
   return button;
  }
  for(const [kind,name,label,title] of [
   ['settings','settings','Ustawienia','Ustawienia gry'],['board','board','Plansza','Plansza — wygląd szachownicy'],
   ['pieces','pieces','Figury','Figury — wygląd figur'],['theme','theme','Motyw','Motyw prawego panelu']]){
   const button=tool(kind,name,label,title);
   button.setAttribute('aria-controls','cc-sheet-'+kind);button.setAttribute('aria-expanded','false');
   button.addEventListener('click',()=>openSheet(kind,button,true));
   triggers.set(kind,button);
  }
  const fullscreen=tool('fullscreen','fullscreen','Pełny ekran','Pełny ekran');
  fullscreen.setAttribute('aria-pressed','false');
  dock.append(tools);
  let fullscreenPending=false;
  function syncFullscreen(){
   const active=!!document.fullscreenElement;
   fullscreen.setAttribute('aria-pressed',String(active));
   const label=active?'Zamknij pełny ekran':'Pełny ekran';
   fullscreen.title=label;fullscreen.setAttribute('aria-label',label);
   fullscreen.replaceChildren(icon(active?'exitFullscreen':'fullscreen'),E('span','cc-tool-label',active?'Zamknij':'Pełny ekran'));
  }
  // Fallback (e.g. iPhone Safari): the existing board-only "Sama gra" view; Esc or "Powrót do panelu" exits.
  function boardOnlyFallback(){
   if(!layout.classList.contains('game-focus'))$('focus-game')?.click();
  }
  fullscreen.addEventListener('click',()=>{
   if(document.fullscreenElement){void document.exitFullscreen?.();return;}
   const existing=$('fullscreen-game');
   if(document.fullscreenEnabled&&document.documentElement.requestFullscreen&&existing){fullscreenPending=true;existing.click();}
   else boardOnlyFallback();
  });
  document.addEventListener('fullscreenchange',()=>{fullscreenPending=false;syncFullscreen();});
  document.addEventListener('fullscreenerror',()=>{if(fullscreenPending){fullscreenPending=false;boardOnlyFallback();}});

  // ---- chat send icon (label stays "Wyślij wiadomość") ----
  const send=$('chat-send');
  if(send){send.replaceChildren(icon('send'));send.title='Wyślij wiadomość';}

  // ---- keep everything in sync with the real game ----
  let lastMode=board.dataset.consoleMode||'';
  function syncAll(){
   syncActions();updateInfo();syncSettingsMode();
   const modeNow=board.dataset.consoleMode||'';
   if(modeNow!==lastMode){
    if(modeNow==='online'&&board.dataset.consoleGame==='none')openSheet('online',onlineNew,false);
    else if(modeNow!=='online'&&openKind==='online')closeSheet(false);
    lastMode=modeNow;
   }
   const stateText=modeNow==='online'?($('game-state')?.textContent||'').trim():'';
   if(onlineStatus.textContent!==stateText)onlineStatus.textContent=stateText;
  }
  new MutationObserver(syncAll).observe(board,{attributes:true,attributeFilter:['data-console-mode','data-console-game','data-console-opponent','data-console-limit','data-console-increment']});
  const state=$('game-state');
  if(state)new MutationObserver(syncAll).observe(state,{childList:true,characterData:true,subtree:true});
  const historyCount=$('history-count');
  if(historyCount)new MutationObserver(updateInfo).observe(historyCount,{childList:true,characterData:true,subtree:true});
  new MutationObserver(syncSettingsMode).observe(onlineMode,{attributes:true,attributeFilter:['class']});
  document.addEventListener('change',event=>{if(event.target&&event.target.tagName==='SELECT')updateInfo();});
  syncAll();
  syncFullscreen();
  body.classList.add('cc-owner');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
`;
