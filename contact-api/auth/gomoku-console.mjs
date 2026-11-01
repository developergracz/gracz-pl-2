// Standalone Gomoku console. Online games use the existing authenticated, server-authoritative /auth/match API.
const secure={
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'
};
const html=String.raw`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#04191b"><meta name="robots" content="noindex,nofollow,noarchive">
<title>Gomoku Online — Full Max Premium | gracz.pl</title>
<link rel="stylesheet" href="/konto/gomoku/styl.css"><script src="/konto/gomoku/app.js" defer></script></head>
<body>
<a class="skip" href="#board">Przejdź do planszy</a>
<main class="layout" id="game">
<aside class="sidebar" aria-label="Panel gry">
<header class="side-header">
<div class="branding"><span class="laurel" aria-hidden="true">❧</span><span class="brand-gamepad" aria-hidden="true">🎮</span><a class="brand" href="https://gracz.pl/" aria-label="gracz.pl — strona główna">gracz<span>.pl</span></a><span class="badge-premium">PREMIUM</span><span class="laurel" aria-hidden="true">❧</span></div>
<h1>Gomoku <em>Online</em></h1><div class="premium-sub" aria-label="Full Max Premium"><span aria-hidden="true">♛</span></div>
<p class="lede">Pięć w linii. Jeden ruch może zmienić wszystko.</p>
</header>
<div class="mode" role="group" aria-label="Tryb gry">
<button type="button" class="mode-choice active" id="training-mode" aria-pressed="true"><span class="mode-icon" aria-hidden="true">🎓</span><span><strong>Trening</strong><small>Graj od razu z komputerem</small></span><span class="mode-arrow" aria-hidden="true">›</span></button>
<button type="button" class="mode-choice" id="online-mode" aria-pressed="false"><span class="mode-icon" aria-hidden="true">👥</span><span><strong>Ze znajomym</strong><small>Wspólna partia online</small></span><span class="mode-arrow" aria-hidden="true">›</span></button>
</div>
<section class="sidecard" id="training-settings"><h2>Twój trening</h2>
<p>Grasz czarnymi kamieniami. Komputer odpowiada białymi. Bez konta i bez rankingu.</p>
<label for="ai-level">Poziom komputera</label>
<select id="ai-level" aria-label="Poziom trudności komputera"><option value="normal">Normalny</option><option value="hard">Trudny</option><option value="expert" selected>♛ Ekspert — dla bardzo doświadczonych</option></select>
<p id="ai-hint" class="hint">Ekspert szuka wymuszonych wygranych, blokuje zagrożenia i rzadko popełnia błędy. Najtrudniejszy poziom.</p>
<button class="primary" id="restart" type="button"><span aria-hidden="true">▶</span> Nowa partia</button></section>
<section class="sidecard" id="online-settings" hidden><h2>Moje pokoje Gomoku</h2>
<p id="account-note" role="status">Sprawdzanie sesji gracza…</p>
<label for="room-select">Wybierz zaakceptowane wyzwanie</label>
<select id="room-select"><option value="">Brak wybranego pokoju</option></select>
<div class="actions"><button class="primary" id="join-room" type="button">Otwórz partię</button><button class="secondary" id="reload-rooms" type="button">Odśwież listę</button></div>
<a class="textlink" href="/konto/panel/">Dodaj znajomego lub wyślij zaproszenie w Panelu Gracza</a></section>
<section class="sidecard rules"><h2>ⓘ &nbsp;Jak grać?</h2>
<p>Ułóż 5 swoich kamieni w linii: poziomo, pionowo lub na skos. Blokuj zagrożenia przeciwnika i planuj ruchy z wyprzedzeniem.</p>
<p class="muted">W trybie online serwer zatwierdza ruchy. Trening nie jest rankingowy.</p>
</section>
<nav class="side-links"><a href="/konto/panel/">Mój panel</a><a href="https://gracz.pl/gry/gomoku/">Zasady Gomoku</a></nav>
</aside>
<section class="boardarea" aria-label="Konsola gry Gomoku">
<div class="players">
<div class="player first"><span class="stone black" aria-hidden="true"></span><div><strong id="black-name">Ty</strong><small>Czarne — zaczynają</small></div><span class="player-icon" aria-hidden="true">♛</span></div>
<div class="versus">VS</div>
<div class="player second"><span class="stone white" aria-hidden="true"></span><div><strong id="white-name">Komputer</strong><small>Białe</small></div><span class="player-icon" aria-hidden="true">♟</span></div>
</div>
<div class="state" id="game-state" role="status" aria-live="polite">Twój ruch — postaw czarny kamień.</div>
<div class="arena">
<div class="board-center"><div class="boardtop"><h2 id="session-heading">Trening z komputerem</h2><span id="room-tag" class="roomtag">TRENING</span></div>
<div class="boardframe"><div class="board" id="board" role="grid" aria-label="Plansza Gomoku 15 na 15"></div></div>
</div>
<aside class="side-dock" aria-label="Historia ruchów i rozmowa">
<section class="match-panel">
<div class="dock-header"><span class="dock-eyebrow">GOMOKU · PREMIUM</span><span class="dock-live" id="dock-status">● TRENING</span></div>
<div class="dock-tabs" role="tablist" aria-label="Panel partii">
<button type="button" class="dock-tab active" id="history-tab" role="tab" aria-selected="true" aria-controls="moves-panel">☷ &nbsp;Ruchy</button>
<button type="button" class="dock-tab" id="chat-tab" role="tab" aria-selected="false" aria-controls="chat-panel">▣ &nbsp;Czat <span class="chat-led" aria-hidden="true"></span></button></div>
<div id="moves-panel" class="dock-content" role="tabpanel" aria-labelledby="history-tab">
<div class="dock-title"><strong>Historia ruchów</strong><span id="history-count">0</span></div>
<div id="moves-list" class="moves-list" aria-live="polite"><p class="dock-empty">Wybierz pole i rozpocznij partię.</p></div>
<div class="history-footer" id="history-info">Zapis lokalny w treningu</div>
</div>
<div id="chat-panel" class="dock-content" role="tabpanel" aria-labelledby="chat-tab" hidden>
<div class="dock-title"><strong>Czat przy stole</strong><span class="chat-lock">Prywatny</span></div>
<div id="chat-messages" class="chat-messages" aria-live="polite"><p class="dock-empty">Rozmowa przy stole gry.</p></div>
</div>
<div class="mini-chat">
<div id="chat-preview" class="chat-preview" aria-label="Ostatnie wiadomości"><p class="dock-empty">Rozpocznij partię lub rozmowę.</p></div>
<form id="chat-form" class="chat-form"><label for="chat-input" class="sr-only">Napisz wiadomość do przeciwnika lub komputera treningowego</label>
<div class="chat-compose"><input id="chat-input" maxlength="600" type="text" autocomplete="off" placeholder="Napisz wiadomość…"><button id="chat-send" type="submit" aria-label="Wyślij wiadomość">➤</button></div></form>
<p class="chat-footnote" id="chat-status">Komentarze treningowe · bez zapisu na serwerze</p>
</div>
</section>
<div class="game-tools" aria-label="Narzędzia gry">
<button type="button" class="tool-btn" id="undo-move"><span aria-hidden="true">↶</span> Cofnij ruch</button>
<button type="button" class="tool-btn" id="analyze-position"><span aria-hidden="true">▥</span> Analiza</button>
<button type="button" class="tool-btn" id="game-settings"><span aria-hidden="true">⚙</span> Ustawienia</button>
<button type="button" class="tool-btn" id="fullscreen-game"><span aria-hidden="true">⛶</span> Pełny ekran</button>
<button type="button" class="tool-btn" id="refresh-match" hidden><span aria-hidden="true">↻</span> Odśwież partię</button>
</div></aside></div>
<div class="bottom"><span class="info-pill" id="move-count">Ruchy: 0</span><span id="board-help" class="help">Wybierz wolne pole, aby postawić czarny kamień.</span><span class="info-pill" id="turn-label">Tura: czarne</span></div>
<p class="analysis-note" id="analysis-note" role="status" aria-live="polite" hidden></p>
</section>
</main></body></html>`;
const css=String.raw`:root{color-scheme:dark;font-family:Inter,"Segoe UI",Arial,sans-serif;font-synthesis:none;--gold:#efca82;--teal:#51d6d3;--navy:#03171e;--line:#395f64}
*{box-sizing:border-box}html{background:#031519}body{margin:0;min-height:100dvh;color:#f1f9fc;background:#031519}
body:before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse 70% 70% at 74% 53%,#08747555,transparent 72%),linear-gradient(135deg,#021218,#05202b 50%,#03151d)}
a{color:inherit}button,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.43;cursor:not-allowed}button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #86f6f1;outline-offset:3px}
.skip{position:absolute;z-index:50;top:-100px;left:10px;padding:11px;background:white;color:#101010}.skip:focus{top:10px}
.layout{display:grid;grid-template-columns:clamp(270px,27vw,370px) minmax(0,1fr);width:100%;height:100dvh;min-height:590px;max-width:1800px;margin:auto;isolation:isolate;overflow:hidden}
.sidebar{display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#996e3d #071922;padding:clamp(19px,2vw,30px) clamp(20px,2.5vw,34px);background:radial-gradient(ellipse at 5% 0%,#14606644,transparent 39%),linear-gradient(160deg,#01131d 0%,#041a25 65%,#03181c 100%);border-right:1px solid #3b737b;box-shadow:9px 0 30px #0005;position:relative}
.sidebar:before,.sidebar:after{content:"";position:absolute;pointer-events:none;width:190px;height:110px;border:1px solid #d3ae62a0;border-left-color:transparent;border-bottom-color:transparent;border-radius:50%;transform:rotate(-31deg)}
.sidebar:before{top:-70px;left:-65px}.sidebar:after{bottom:-75px;right:-65px;transform:rotate(150deg)}
.side-header{text-align:center;margin-bottom:18px}
.branding{display:flex;align-items:center;justify-content:center;gap:13px;flex-wrap:wrap;margin-bottom:20px}.brand{text-decoration:none;font-size:clamp(19px,1.65vw,25px);font-weight:950;letter-spacing:-1px;color:#fff}.brand span{color:#f34055}
.badge-premium{font-size:10px;font-weight:950;color:#16232b;letter-spacing:.8px;background:linear-gradient(145deg,#ffedb2,#bb8132);padding:5px 9px;border-radius:15px;box-shadow:0 0 16px #dfac5540}
.side-header h1{font-size:clamp(30px,2.65vw,43px);font-family:Inter,"Segoe UI",Arial,sans-serif;line-height:1.09;letter-spacing:-1.5px;margin:0;color:#fff;text-shadow:0 0 22px #dda75545;white-space:nowrap}
.side-header h1 em{font-style:normal;color:#f2c77d;font-weight:450}
.premium-sub{color:#d9b671;letter-spacing:.28em;font-size:10px;font-weight:850;margin:12px auto 17px}
.lede{font-size:12px;color:#d4e6e9;line-height:1.6;margin:0}
.mode{display:grid;gap:10px}
.mode-choice{width:100%;min-height:70px;text-align:left;color:#f9fcff;display:grid;grid-template-columns:35px 1fr 15px;align-items:center;gap:9px;padding:10px 13px;border:1px solid #4e8287;border-radius:14px;background:linear-gradient(120deg,#082f36 0%,#051e28 95%);transition:box-shadow .15s,border-color .15s}
.mode-choice.active{border:1px solid #f5c972;background:linear-gradient(120deg,#72542866,#123236 83%);box-shadow:0 0 0 1px #fce19a60,inset 0 1px #ffe5b34a,0 0 19px #e7a9486b}
.mode-icon{font-size:27px;color:#f1cc8b;text-align:center}.mode-arrow{color:#f6ce7c;font-size:24px}.mode-choice strong{font-size:17px;display:block}.mode-choice small{display:block;color:#c3d9de;font-size:11px;margin-top:4px}
.sidecard{margin-top:19px;padding-top:17px;border-top:1px solid #9e79438f}
.sidecard h2{font-size:19px;margin:0 0 12px;color:#ecc37b;letter-spacing:-.2px}
.sidecard p{font-size:12px;color:#dce6e8;line-height:1.55;margin:10px 0}
.sidecard label{display:block;font-size:12px;font-weight:800;margin:14px 0 8px}
select{width:100%;padding:12px 13px;background:linear-gradient(#0c2c31,#03171e);color:#f7f5f1;border:1px solid #f0c477;border-radius:10px;min-width:0;box-shadow:0 0 0 1px #e9bd5f2b}
select option{background:#102c34;color:#fff}
.sidecard .hint{color:#c9dcde;font-size:11px;margin:13px 0 18px}
.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;gap:11px;font-size:13px;font-weight:900;border-radius:11px;padding:12px 15px}
.primary{background:linear-gradient(180deg,#fff0be 0%,#f3c36d 57%,#cb9035 100%);border:1px solid #ffebb0;color:#1d1d16;box-shadow:inset 0 1px #fffdf0,0 0 0 1px #9b682d,0 5px 20px #d9973c60}
#restart{display:flex;width:100%;font-size:16px;border-radius:24px;padding:12px 20px}
.secondary{border:1px solid #4c888b;background:linear-gradient(#06333b,#031f28);color:#f3f9f8}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.textlink{display:block;font-size:11px;color:#a4f0e6;line-height:1.5;margin-top:14px}
.rules{margin-top:22px}.rules p{margin-bottom:0}.muted{color:#9bb8bb!important;font-size:11px!important}
.side-links{display:flex;gap:15px;margin-top:auto;padding-top:18px;color:#aac9c9;font-size:11px}.side-links a{text-decoration:none;border-bottom:1px solid #659aa071}
.boardarea{min-width:0;min-height:0;position:relative;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:clamp(8px,1.2vh,14px);padding:clamp(12px,2vh,22px) clamp(14px,2.2vw,32px) clamp(13px,1.8vh,20px);background:radial-gradient(ellipse 72% 60% at 59% 55%,#09656e39,transparent 75%),linear-gradient(145deg,#031719,#043139 55%,#031b25)}
.boardarea:before,.boardarea:after{content:"";position:absolute;pointer-events:none;z-index:-1;width:520px;height:240px;border-radius:50%;border-top:1px solid #41c6b367;filter:drop-shadow(0 0 12px #11bcc37c);transform:rotate(-23deg)}
.boardarea:before{left:-80px;bottom:16px}.boardarea:after{right:-190px;top:30px;transform:rotate(155deg)}
.players{display:grid;grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr);gap:clamp(8px,1.5vw,22px);align-items:center;min-height:64px}
.player{display:flex;align-items:center;gap:13px;min-width:0;min-height:63px;padding:8px 16px;border-radius:18px;background:linear-gradient(130deg,#0a3b40,#021c21 70%,#07353a);border:1px solid #f5d498;box-shadow:inset 0 1px 2px #ffe6a17c,0 0 0 1px #eab7606a,0 0 22px #e5ae5440}
.player div{min-width:0}.player strong{font-size:clamp(15px,2vw,23px);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player small{font-size:11px;display:block;color:#c6d7db;margin-top:3px}
.player .stone{width:42px;height:42px}.player-icon{font-size:24px;color:#f5ce84;margin-left:auto}
.stone{display:inline-block;flex:none;width:26px;height:26px;border-radius:50%;box-shadow:inset -4px -5px 7px #0008,0 2px 5px #0008}
.stone.black{background:radial-gradient(circle at 31% 22%,#aab2b5,#3b4348 27%,#0a1017 61%,#010203 89%)}
.stone.white{background:radial-gradient(circle at 31% 19%,#fff,#f3f6f8 39%,#d9e0e2 74%,#869296 99%)}
.versus{text-align:center;font-size:clamp(16px,2vw,26px);font-weight:950;color:#f3d089;letter-spacing:1px;text-shadow:0 0 10px #be8b45}
.state{padding:10px 18px;min-height:39px;display:grid;place-items:center;text-align:center;background:linear-gradient(105deg,#064343,#062e36 52%,#062b30);border:1px solid #cb9d50;border-radius:18px;color:#f8e0a9;font-size:clamp(11px,1.2vw,15px);font-weight:850;box-shadow:inset 0 1px #4e9c94a0}
.arena{display:grid;grid-template-columns:minmax(0,1fr) clamp(104px,11vw,160px);gap:clamp(10px,1.6vw,24px);min-height:0;align-items:center}
.board-center{min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.boardtop{display:flex;align-items:center;justify-content:center;gap:11px;min-height:23px}
.boardtop h2{font-size:11px;font-weight:700;color:#c4dde0;margin:0}.roomtag{border:1px solid #bd9555;color:#f8dca3;padding:3px 9px;border-radius:30px;font-size:9px;font-weight:800}
.boardframe{width:min(100%,calc(100dvh - 212px),720px);aspect-ratio:1;flex:none;padding:clamp(6px,.8vw,10px);margin:auto;background:linear-gradient(140deg,#fff6df 0%,#be873b 17%,#fce3a4 40%,#b67d30 75%,#fff2c8);border:2px solid #fce6ab;border-radius:clamp(13px,1.6vw,23px);box-shadow:inset 0 0 0 2px #7a451b,0 0 0 2px #e4b463,0 0 22px #ffbb68a0,0 14px 34px #0009;overflow:hidden}
.board{width:100%;height:100%;display:grid;grid-template-columns:repeat(15,minmax(0,1fr));grid-template-rows:repeat(15,minmax(0,1fr));border:2px solid #bcab8d;border-radius:10px;overflow:hidden;background:radial-gradient(circle at 34% 25%,#fff 0%,#f8f9f8 47%,#edf0ec 100%)}
.cell{border:0;padding:0;min-width:0;min-height:0;position:relative;display:grid;place-items:center;background:transparent}
.cell::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px)),linear-gradient(to bottom,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px))}
.cell.edge-top::before{background:linear-gradient(to right,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px)),linear-gradient(to bottom,transparent 50%,#707778a8 50%,#707778a8 calc(50% + .6px),transparent calc(50% + .6px))}
.cell.edge-bottom::before{background:linear-gradient(to right,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px)),linear-gradient(to bottom,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 50%,transparent 50%)}
.cell.edge-left::before{background:linear-gradient(to right,transparent 50%,#707778a8 50%,#707778a8 calc(50% + .6px),transparent calc(50% + .6px)),linear-gradient(to bottom,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px))}
.cell.edge-right::before{background:linear-gradient(to right,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 50%,transparent 50%),linear-gradient(to bottom,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px))}
.cell.star:not(.occupied)::after{content:"";width:15%;height:15%;background:#b6975b;border-radius:50%;position:relative;z-index:1}
.cell.occupied::after{content:"";display:block;width:84%;height:84%;border-radius:50%;position:relative;z-index:2;box-shadow:inset -2px -3px 4px #0007,0 2px 4px #0006}
.cell.p1.occupied::after{background:radial-gradient(circle at 27% 19%,#9babb1,#313b42 29%,#060e14 64%,#000)}
.cell.p2.occupied::after{background:radial-gradient(circle at 27% 18%,#fff 0%,#fbfcfc 34%,#dfe6e8 76%,#98a2a7)}
.cell.last::after{outline:2px solid #d69f4e;outline-offset:1px}
.cell.suggested:not(.occupied){background:#31bbb455!important;box-shadow:inset 0 0 0 2px #008f92}
.cell:not(:disabled):hover{background:#c9e6df6e;cursor:pointer}.cell:focus-visible{outline:2px solid #078a91;outline-offset:-2px;z-index:3}
.game-tools{display:flex;flex-direction:column;justify-content:center;gap:clamp(9px,1.5vh,17px)}
.tool-btn{display:flex;align-items:center;justify-content:flex-start;gap:9px;width:100%;min-height:44px;text-align:left;border:1px solid #93baa9;border-radius:12px;color:#f6faf9;padding:8px 11px;background:linear-gradient(155deg,#0b4946,#05242d 77%);box-shadow:inset 0 1px #7cafa27a,0 7px 17px #0005;font-size:11px;font-weight:750;transition:transform .15s,border-color .15s}
.tool-btn:hover:not(:disabled){transform:translateY(-2px);border-color:#f4cf88}.tool-btn span{font-size:22px;color:#f3c676;min-width:27px;text-align:center}
.bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:39px;color:#cfebeb}
.info-pill{border:1px solid #dfb66b;border-radius:22px;padding:9px 15px;background:linear-gradient(115deg,#073a3c,#021c22);font-size:12px;font-weight:800;white-space:nowrap}
.help{color:#c4dade;font-size:11px;line-height:1.45;text-align:center;margin:0}
.analysis-note{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);z-index:5;max-width:80%;text-align:center;padding:11px 17px;color:#fff5d1;border:1px solid #c79b55;background:#07252bea;border-radius:12px;box-shadow:0 8px 20px #0007;font-size:12px}
[hidden]{display:none!important}
@media(max-width:1050px){.layout{grid-template-columns:260px minmax(0,1fr)}.sidebar{padding:15px}.arena{grid-template-columns:minmax(0,1fr) 112px}.boardframe{width:min(100%,calc(100dvh - 220px))}.player{padding:8px 10px}.player .stone{height:31px;width:31px}.player-icon{display:none}}
@media(max-width:800px){.layout{height:auto;min-height:100dvh;display:block;overflow:visible}.sidebar{overflow:visible;min-height:auto;border-right:0;border-bottom:1px solid #b19b6c}.side-header{margin-bottom:12px}.branding{margin-bottom:10px}.side-header h1{font-size:30px}.premium-sub{margin:7px 0}.mode{grid-template-columns:1fr 1fr}.mode-choice{min-height:57px}.sidecard{margin-top:12px;padding-top:12px}.sidecard.rules{display:none}.side-links{margin-top:8px;padding-top:6px}.boardarea{min-height:0;padding:12px;gap:11px}.boardframe{width:min(100%,calc(100dvh - 210px),680px)}.arena{grid-template-columns:minmax(0,1fr) 115px}.players{min-height:50px}.player{min-height:53px}}
@media(max-width:560px){.branding{gap:9px}.brand{font-size:23px}.side-header h1{font-size:27px}.lede{font-size:11px}.mode-choice{padding:9px;grid-template-columns:25px 1fr 10px;gap:5px}.mode-choice strong{font-size:13px}.mode-choice small{font-size:10px}.mode-icon{font-size:19px}.sidecard h2{font-size:16px}.sidecard p{font-size:11px}.players{grid-template-columns:minmax(0,1fr) 27px minmax(0,1fr);gap:5px}.player{min-height:46px;padding:5px 7px;gap:6px;border-radius:11px}.player .stone{width:24px;height:24px}.player strong{font-size:12px}.player small{font-size:9px}.versus{font-size:14px}.state{font-size:11px;min-height:36px}.arena{display:flex;flex-direction:column;gap:11px}.board-center{width:100%}.boardframe{width:100%;max-width:520px;border-width:2px;padding:6px}.game-tools{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tool-btn{min-height:40px;padding:7px;font-size:11px}.tool-btn span{font-size:20px}.bottom{gap:7px;flex-wrap:wrap}.info-pill{font-size:10px;padding:7px 10px}.help{order:3;width:100%;font-size:11px}.boardtop h2{font-size:10px}}
@media(max-height:700px) and (min-width:801px){.layout{min-height:560px}.sidecard{margin-top:12px;padding-top:10px}.side-header{margin-bottom:12px}.branding{margin-bottom:10px}.side-header h1{font-size:31px}.premium-sub{margin:7px auto}.mode-choice{min-height:53px;padding:7px}.sidecard p{margin:6px 0}.boardframe{width:min(100%,calc(100dvh - 180px),650px)}.arena{gap:10px}.boardarea{gap:7px;padding:9px 15px}.players{min-height:53px}.player{min-height:51px}}

/* Premium in-game dock: move list, private match chat, functional tools */
.arena{grid-template-columns:minmax(0,1fr) clamp(236px,22vw,306px);gap:clamp(12px,1.5vw,23px)}
.side-dock{display:flex;flex-direction:column;min-height:0;max-height:min(100%,calc(100dvh - 152px));gap:12px;align-self:stretch;justify-content:center}
.match-panel{display:flex;flex-direction:column;min-height:220px;flex:1;max-height:520px;overflow:hidden;background:linear-gradient(150deg,#0c4244,#041e28 60%,#061b23);border:1px solid #c19a63;border-radius:16px;box-shadow:inset 0 1px #a9d6ca50,0 10px 24px #0006}
.dock-header{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:13px 14px 9px}.dock-eyebrow{font-size:10px;letter-spacing:1.3px;color:#f2d4a0;font-weight:900}.dock-live{font-size:10px;color:#86e8c9;font-weight:900}
.dock-tabs{display:grid;grid-template-columns:1fr 1fr;padding:4px;margin:0 10px 8px;border:1px solid #3f6971;border-radius:11px;background:#021923;gap:3px}
.dock-tab{padding:9px 3px;color:#aeced1;border:0;background:transparent;border-radius:8px;font-size:12px;font-weight:800}
.dock-tab.active{color:#16292b;background:linear-gradient(160deg,#ffe6af,#cda15c);box-shadow:0 1px 7px #e3b76e50}
.dock-content{display:flex;flex-direction:column;min-height:0;flex:1;padding:1px 13px 12px}
.dock-title{display:flex;align-items:center;justify-content:space-between;gap:5px;margin:4px 0 10px}.dock-title strong{font-size:12px}.dock-title>span{font-size:10px;color:#f4d594;border:1px solid #bd9567;border-radius:12px;padding:3px 8px}
.moves-list,.chat-messages{min-height:110px;flex:1;overflow-y:auto;scrollbar-color:#76979b #0a2a32;scrollbar-width:thin;border-radius:10px;padding:2px 3px 4px}
.dock-empty{font-size:12px;color:#a2bfc7;line-height:1.55;text-align:center;padding:25px 8px}
.move-row{display:grid;grid-template-columns:25px minmax(0,1fr) auto;gap:9px;align-items:center;margin:5px 0;padding:9px 7px;border:1px solid #31565b;border-radius:9px;background:linear-gradient(90deg,#153b46,#072731)}
.move-row.latest{border-color:#d8ae64;background:linear-gradient(90deg,#31534f,#102f34)}
.move-number{font-size:10px;font-weight:900;color:#b5cbd0}.move-player{display:flex;gap:8px;align-items:center;min-width:0}.move-player strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mini-stone{width:17px;height:17px;border-radius:50%;box-shadow:inset -3px -3px 4px #0009,0 1px 4px #0008;flex:none}.mini-stone.p1{background:radial-gradient(circle at 25% 25%,#9ea8b0,#131b22 60%,#020205)}.mini-stone.p2{background:radial-gradient(circle at 25% 25%,white,#e8eff1 60%,#a2afb8)}
.move-coordinate{font-size:12px;font-weight:900;color:#f3d292}
.history-footer{font-size:10px;color:#b4ced0;padding:10px 2px 0;border-top:1px solid #325c60;margin-top:7px}
.chat-messages{display:flex;flex-direction:column;gap:8px}
.chat-bubble{max-width:92%;padding:9px 11px;align-self:flex-start;background:#183d48;border:1px solid #498188;border-radius:13px 13px 13px 4px;overflow-wrap:anywhere}
.chat-bubble.own{align-self:flex-end;background:#54442a;border-color:#d0a866;border-radius:13px 13px 4px 13px}
.chat-bubble strong{display:block;font-size:10px;color:#f2d39a;margin-bottom:5px}.chat-bubble p{margin:0;font-size:12px;line-height:1.45;white-space:pre-wrap;color:#f6fbfa}.chat-bubble time{display:block;margin-top:6px;text-align:right;color:#a9c3c4;font-size:9px}
.chat-compose{display:flex;gap:6px;align-items:center;margin-top:9px}.chat-compose input{width:100%;min-width:0;height:39px;border:1px solid #4f838a;border-radius:9px;color:#ecf6f9;background:#041f2b;padding:8px;font:inherit;font-size:11px}.chat-compose button{border:1px solid #f6d995;border-radius:9px;background:linear-gradient(#ffe7ab,#d2a155);color:#142028;font-weight:950;padding:9px 11px}
.chat-footnote{font-size:10px;color:#a8c7c6;margin:7px 0 0;line-height:1.4}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.side-dock .game-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;flex:none}
.side-dock .tool-btn{min-height:36px;padding:7px 8px;gap:5px;font-size:10px;border-radius:9px}.side-dock .tool-btn span{font-size:16px;min-width:18px}
@media(max-width:1150px) and (min-width:801px){.arena{grid-template-columns:minmax(0,1fr) 222px;gap:10px}.side-dock{max-height:calc(100dvh - 145px)}.dock-header{padding:9px}.dock-content{padding:0 8px 8px}.move-row{gap:5px;padding:8px 5px}.side-dock .tool-btn{font-size:9px}.boardframe{width:min(100%,calc(100dvh - 222px))}}
@media(max-width:800px){.arena{display:flex;flex-direction:column}.side-dock{width:100%;max-height:none;flex-direction:column}.match-panel{max-height:none;min-height:290px;height:340px;flex:none}.moves-list,.chat-messages{max-height:214px}.side-dock .game-tools{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.side-dock{width:100%;max-height:none}.match-panel{height:320px}.dock-tab{font-size:12px}.move-row{grid-template-columns:25px 1fr auto}.boardframe{max-width:520px}}

/* OWNER APPROVED GOMOKU FULL MAX PREMIUM: faithful 1648x925 three-column composition */
:root{--gold:#ffd47b;--gold-deep:#96601d;--cyan:#39d9d5;--ivory:#f9f9f8}
.layout{position:relative;grid-template-columns:27.5% minmax(0,1fr);width:100%;max-width:1920px;height:100dvh;min-height:590px;margin:0 auto;border-radius:clamp(16px,3.6vw,56px);border:1px solid #477f70;overflow:hidden;background:#01191d;box-shadow:inset 0 0 0 1px #c49b4a52,0 0 0 3px #001414}
.layout:after{content:"";pointer-events:none;position:absolute;inset:0;z-index:5;border-radius:inherit;box-shadow:inset 0 0 0 1px #cda75a75,inset 0 0 32px #09b7bd20;background:radial-gradient(ellipse 46% 18% at 96% -4%,#ffe19ba6,transparent 75%),radial-gradient(ellipse 40% 10% at 1% 103%,#dca54b7c,transparent 70%),radial-gradient(ellipse 55% 8% at 103% 101%,#ffd16f65,transparent 75%);opacity:.7}
.sidebar{padding:clamp(17px,2vw,30px) clamp(20px,3vw,43px);border-right:1px solid #6f927e;background:radial-gradient(ellipse 60% 24% at 8% 5%,#08696f48,transparent 72%),linear-gradient(140deg,#001318 0%,#021e25 52%,#00151a 100%);box-shadow:inset -9px 0 19px #0005;z-index:1}
.sidebar:before,.sidebar:after{border-color:#eac37e;box-shadow:0 0 10px #d7a23f80}
.side-header{margin-bottom:clamp(16px,2vh,24px)}
.branding{gap:6px;flex-wrap:nowrap;margin-bottom:16px;min-height:32px}
.branding .brand{font-size:clamp(16px,1.58vw,27px);letter-spacing:-1.35px;white-space:nowrap;text-shadow:0 1px 1px #000}
.brand-gamepad{font-size:22px;filter:sepia(1) saturate(4) hue-rotate(348deg) brightness(1.15);line-height:1}
.branding .laurel{color:#ffd06c;font-size:27px;filter:drop-shadow(0 0 5px #e3a92b);line-height:1}
.badge-premium{font-size:clamp(8px,.8vw,12px);font-weight:950;white-space:nowrap;padding:4px 9px;border:1px solid #fff2be;background:linear-gradient(180deg,#fff3bb,#f2bb42 70%,#d08f20);box-shadow:0 0 11px #ecac3695;color:#152522;border-radius:9px}
.side-header h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(30px,2.9vw,50px);font-weight:700;letter-spacing:-1.5px;color:#ffe1a0;text-shadow:0 0 15px #edb34f82;white-space:nowrap}
.side-header h1 em{font-family:Georgia,"Times New Roman",serif;font-weight:400;color:#f7fcf9;text-shadow:0 2px 4px #0008}
.premium-sub{position:relative;display:grid;place-items:center;height:24px;margin:6px auto 15px;color:#f9c45d;font-size:21px}
.premium-sub:before,.premium-sub:after{content:"";height:1px;width:38%;position:absolute;top:50%;background:linear-gradient(90deg,transparent,#ffc76a)}
.premium-sub:before{left:0}.premium-sub:after{right:0;transform:rotate(180deg)}
.lede{font-size:clamp(11px,1.1vw,16px);color:#f3f2e9;line-height:1.55}
.mode{gap:11px;margin:5px 0 16px}
.mode-choice{min-height:clamp(63px,7.4vh,79px);border-radius:15px;padding:9px 13px;grid-template-columns:clamp(35px,3.5vw,58px) 1fr 15px;background:linear-gradient(135deg,#063e3c,#031a20);border-color:#20d8d6;box-shadow:inset 0 0 12px #37b0a824}
.mode-choice.active{border:2px solid #ffcf6b;background:linear-gradient(95deg,#5b431f7d,#031d20 75%);box-shadow:0 0 0 1px #ffe58fb8,0 0 14px 3px #eaa536aa,inset 0 0 11px #f3bc4e55}
.mode-choice strong{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:clamp(18px,1.5vw,26px)}.mode-choice small{font-size:clamp(10px,1vw,14px);color:#f0eeea;margin-top:2px}
.mode-icon{font-size:clamp(23px,2.7vw,38px);filter:drop-shadow(0 0 3px #d59b38)}.mode-arrow{color:#ffcf58;font-weight:800;font-size:30px}
.sidecard{margin-top:14px;padding-top:17px;border-top:1px solid #ad8d4880;position:relative}
.sidecard:before{content:"◇";font-size:14px;color:#f4c765;position:absolute;left:50%;top:-10px;background:#03202a;padding:0 6px}
.sidecard h2{font-family:Georgia,"Times New Roman",serif;color:#ffd476;font-size:clamp(18px,1.6vw,26px);margin-bottom:8px}
.sidecard p{font-size:clamp(11px,1.0vw,14px);color:#f2f2f1;line-height:1.35}
.sidecard label{font-size:clamp(11px,1vw,15px);margin:10px 0 7px}
.sidecard select{border:2px solid #f6bd4c;background:linear-gradient(115deg,#092c31,#03171d 75%);border-radius:10px;font-weight:700;box-shadow:inset 0 0 8px #56cebc1a}
.sidecard .hint{color:#e1e5df;font-size:clamp(10px,.94vw,13px);line-height:1.35;margin:8px 0 14px}
#restart{font-family:Georgia,"Times New Roman",serif;font-size:clamp(17px,1.7vw,26px);padding:10px;border:2px solid #fff1ae;border-radius:14px;background:linear-gradient(180deg,#ffe997 0%,#ffb92e 60%,#d38909 100%);box-shadow:inset 0 1px 2px #fff,0 0 14px #edac3b98,0 5px 10px #0007}
#restart span{font-family:Arial,sans-serif;font-size:24px}
.rules{margin-top:20px}.rules p{line-height:1.4}
.side-links{position:relative;z-index:6}
.boardarea{z-index:1;position:relative;display:grid;grid-template-columns:minmax(0,1fr) clamp(290px,23vw,385px);grid-template-rows:68px 43px minmax(0,1fr) 58px;column-gap:clamp(14px,1.3vw,24px);row-gap:10px;padding:17px clamp(17px,1.3vw,25px);background:radial-gradient(ellipse 68% 85% at 54% 52%,#06696b58,transparent 78%),linear-gradient(120deg,#011c20,#042c2d 55%,#01151a)}
.boardarea:before{z-index:-1;opacity:.7;border-top:2px solid #29d3cf99;width:60%;height:20%;left:-10%;bottom:-8%;filter:drop-shadow(0 0 10px #00d4da)}
.boardarea:after{z-index:-1;opacity:.8;border-top:3px solid #f1c97f;width:60%;height:20%;right:-24%;top:-10%;filter:drop-shadow(0 0 15px #edba61)}
.players{grid-column:1;grid-row:1;grid-template-columns:minmax(0,1fr) 70px minmax(0,1fr);gap:8px;min-height:0}
.player{min-height:0;height:66px;padding:6px 16px;border-radius:20px;background:linear-gradient(145deg,#035959,#01181d 55%,#064c50);border:2px solid #ffe7a3;box-shadow:inset 0 0 0 2px #a56e21,0 0 0 1px #e8ad45,0 0 17px #ecc06a8c}
.player .stone{height:45px;width:45px;border:2px solid #d9ac55;box-shadow:0 0 12px #c28e41a0,inset -6px -6px 10px #0008}
.player strong{font-family:Georgia,"Times New Roman",serif;font-size:clamp(19px,1.65vw,27px);color:#fff}.player small{font-size:clamp(10px,.95vw,14px);color:#fff}
.player-icon{display:block;color:#f9c356;font-size:30px;text-shadow:0 0 7px #e6a33a}
.versus{font-family:Georgia,"Times New Roman",serif;font-size:27px;color:#ffce64;text-shadow:0 0 10px #ffc14e}
.state{grid-column:1;grid-row:2;min-height:0;padding:6px 13px;border-radius:15px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(14px,1.18vw,20px);color:#f1e4bd;border:1px solid #37d7d7;background:linear-gradient(#075857,#011b20 82%);box-shadow:inset 0 1px 0 #a3f8e36e,0 4px 12px #0008}
.arena{display:contents}
.board-center{grid-column:1;grid-row:3;min-height:0;min-width:0;gap:0;justify-content:center}
.boardtop{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.boardframe{width:min(100%,calc(100dvh - 270px),750px);max-width:100%;aspect-ratio:1;padding:clamp(8px,.85vw,13px);border:3px solid #fff0b5;border-radius:clamp(21px,2.3vw,33px);background:linear-gradient(128deg,#fff7cb 0%,#ffbf48 11%,#fff5c6 23%,#c48117 45%,#fff2a6 70%,#b66d08 100%);box-shadow:inset 0 0 0 2px #885319,inset 0 0 0 6px #f5cd6d,0 0 0 2px #ffb838,0 0 20px 4px #ffae38b8,0 14px 23px #0009}
.board{background:radial-gradient(ellipse at 40% 35%,#fff 1%,#fafbfa 58%,#ededec);border:3px solid #72542e;border-radius:13px;box-shadow:inset 0 0 12px #9986694a}
.cell::before{background:linear-gradient(to right,transparent calc(50% - .65px),#434549c8 calc(50% - .65px),#434549c8 calc(50% + .65px),transparent calc(50% + .65px)),linear-gradient(to bottom,transparent calc(50% - .65px),#434549c8 calc(50% - .65px),#434549c8 calc(50% + .65px),transparent calc(50% + .65px))}
.cell.star:not(.occupied)::after{width:16%;height:16%;background:radial-gradient(circle at 30% 30%,#ffda7c,#c8881f);box-shadow:0 0 3px #f6ae33}
.cell.occupied::after{width:90%;height:90%;box-shadow:inset -3px -4px 5px #0009,0 2px 4px #0008,0 0 1px #000a}
.cell.p1.occupied::after{background:radial-gradient(circle at 27% 19%,#a7acb2 0%,#34393e 24%,#080d12 57%,#010103 95%)}
.cell.p2.occupied::after{background:radial-gradient(circle at 27% 18%,#fff 0%,#fff 35%,#dce3e7 68%,#899398 100%);box-shadow:inset -3px -4px 4px #0004,0 3px 5px #0006}
.bottom{grid-column:1;grid-row:4;min-height:0;align-items:center;gap:8px}
.info-pill{border:2px solid #fbd27f;background:linear-gradient(140deg,#074343,#03171e);color:#fff;font-family:Georgia,"Times New Roman",serif;font-size:clamp(15px,1.3vw,23px);padding:10px 20px;box-shadow:inset 0 1px #84f7db55,0 0 8px #dca7478a}
.help{font-size:11px;color:#a2cbcb}
.side-dock{grid-column:2;grid-row:1 / 5;align-self:stretch;justify-content:stretch;max-height:none;min-height:0;margin:54px 0 70px;padding:10px 10px 13px;gap:8px;border:2px solid #e6bd73;border-radius:25px;background:linear-gradient(145deg,#083f40,#02171c 55%,#041a1e);box-shadow:inset 0 0 0 2px #426b58,0 0 18px #ecac4060}
.match-panel{min-height:0;max-height:none;flex:1;border:0;background:none;border-radius:0;box-shadow:none;overflow:hidden}
.dock-header{height:0;padding:0;visibility:hidden;overflow:hidden}
.dock-tabs{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px;padding:0;border:0;background:none}
.dock-tab{border:1px solid #18d1cb;background:linear-gradient(160deg,#0b5050,#05292e);color:#fff;height:45px;border-radius:14px 14px 4px 4px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(15px,1.15vw,19px);font-weight:bold}
.dock-tab.active{background:linear-gradient(180deg,#fff1b4,#f9bf45 58%,#b77913);border:2px solid #fff4b8;color:#191a15;box-shadow:inset 0 1px #fff,0 0 12px #ffbc44b5}
.chat-led{display:inline-block;width:8px;height:8px;border-radius:100%;background:#25ea7e;box-shadow:0 0 6px #32f38c}
.dock-content{padding:0 2px 5px;min-height:0;flex:1}
.dock-title{display:none}
.moves-list{min-height:0;border:1px solid #08b7b3;border-radius:11px;padding:3px 8px;background:#001b20;scrollbar-color:#dfc593 #09262a}
.move-row{height:clamp(22px,2.6vh,29px);margin:0;padding:0 6px;border:0;border-radius:0;border-bottom:1px solid #42656666;background:transparent;grid-template-columns:29px minmax(0,1fr) auto;gap:8px}
.move-row.latest{background:#1f514e75;border:0;border-bottom:1px solid #5f8d73}
.move-number{font-size:12px;color:#ecf4ec;font-weight:700}.move-player strong{font-size:12px;color:#fff}.move-coordinate{font-size:13px;color:#fff}.mini-stone{width:17px;height:17px}
.history-footer{display:none}
.mini-chat{display:flex;flex-direction:column;flex:0 0 clamp(178px,22vh,225px);min-height:0;border-top:1px solid #b785327d;padding:6px 1px 1px}
.chat-preview{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding:4px 0}
.chat-preview .chat-bubble{max-width:94%;padding:5px 8px;border-radius:11px;background:linear-gradient(145deg,#0b6665,#082f3d)}
.chat-preview .chat-bubble.own{background:linear-gradient(140deg,#13696a,#03343b);align-self:flex-start}
.chat-preview .chat-bubble p{font-size:12px}.chat-preview .chat-bubble time{font-size:9px}
.chat-preview .dock-empty{padding:10px;color:#d3dbd6}
#chat-panel .chat-messages{max-height:none;min-height:0}
.chat-compose input{height:39px;padding:8px 11px;font-size:12px;background:linear-gradient(#031920,#03343a);border:1px solid #e7bb64;border-radius:13px}
.chat-compose button{font-size:18px;padding:7px 11px;border-radius:10px;background:linear-gradient(#fff5ba,#f2c343 62%,#ae7119)}
.chat-footnote{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-dock .game-tools{grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.side-dock .tool-btn{height:clamp(64px,7.8vh,85px);min-height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:5px;padding:4px;border:1px solid #38d5c9;border-radius:15px;background:linear-gradient(#064747,#011b23 85%);color:#fff;font-size:clamp(10px,.78vw,13px);line-height:1.15;box-shadow:inset 0 1px #afe7cb44}
.side-dock .tool-btn span{font-size:clamp(20px,2.2vw,34px);min-width:0;line-height:1;color:#f3bd55;text-shadow:0 0 7px #e2ae378c}
@media(max-width:1190px) and (min-width:801px){.layout{grid-template-columns:27% minmax(0,1fr)}.boardarea{grid-template-columns:minmax(0,1fr) clamp(255px,25vw,320px);padding:10px;column-gap:10px}.side-dock{margin:45px 0 65px;padding:7px}.boardframe{width:min(100%,calc(100dvh - 236px))}.player{padding:5px 8px}.branding .laurel{display:none}.brand-gamepad{font-size:19px}.side-header h1{font-size:clamp(27px,2.8vw,36px)}.sidebar{padding:17px 16px}}
@media(max-width:800px){.layout{display:block;width:100%;height:auto;min-height:100dvh;overflow:visible;border-radius:22px}.sidebar{height:auto;min-height:0;padding:17px 18px;border-right:0}.branding{justify-content:center}.boardarea{display:flex;flex-direction:column;padding:12px;gap:10px}.players{width:100%;display:grid;grid-template-columns:1fr 40px 1fr}.player{height:57px}.arena{display:flex;flex-direction:column;gap:15px}.board-center{width:100%}.boardframe{width:min(100%,calc(100dvh - 165px),700px)}.boardtop{position:absolute}.side-dock{width:100%;margin:0;padding:12px;gap:10px;max-height:none;min-height:0}.match-panel{height:400px;min-height:350px;flex:none;max-height:none}.mini-chat{flex-basis:165px}.side-dock .game-tools{grid-template-columns:repeat(4,minmax(0,1fr))}.bottom{width:100%}.info-pill{font-size:15px}.side-header h1{font-size:35px}.sidecard.rules{display:block}}
@media(max-width:560px){.layout{border-radius:15px}.sidebar{padding:14px}.side-header h1{font-size:30px}.mode-choice{min-height:55px}.mode-choice strong{font-size:16px}.mode-choice small{font-size:10px}.mode-icon{font-size:24px}.boardarea{padding:10px}.players{grid-template-columns:1fr 26px 1fr;gap:5px}.player{height:50px;padding:5px}.player .stone{height:26px;width:26px}.player strong{font-size:13px}.player small{font-size:9px}.player-icon{display:none}.versus{font-size:15px}.boardframe{width:100%;padding:7px;border-radius:15px}.board{border-width:1px}.state{font-size:12px}.match-panel{height:370px}.mini-chat{flex-basis:145px}.side-dock .tool-btn{height:62px;font-size:9px;gap:3px}.side-dock .tool-btn span{font-size:22px}.bottom{flex-wrap:wrap}.info-pill{font-size:12px;padding:7px}.help{order:3;width:100%}}
@media(max-height:700px) and (min-width:801px){.layout{min-height:560px}.boardarea{grid-template-rows:54px 35px minmax(0,1fr) 44px;gap:6px;padding:8px 12px}.player{height:52px}.boardframe{width:min(100%,calc(100dvh - 192px))}.side-dock{margin:45px 0 46px}.mini-chat{flex-basis:155px}.side-dock .tool-btn{height:57px;min-height:54px}.mode-choice{min-height:48px}}

@media(prefers-reduced-motion:reduce){*,*:before,*:after{transition:none!important;animation:none!important}}`;
const js=String.raw`(()=>{'use strict';
const $=id=>document.getElementById(id);
const size=15,count=225;
const matchPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const state={mode:'training',board:Array(count).fill(0),winner:0,moves:0,last:-1,
 thinking:false,matchId:null,match:null,busy:false,epoch:0,snapshots:[],suggestion:-1,
 trainHistory:[],dockTab:'moves',chatBusy:false,chatSignature:''};
const inBounds=(r,c)=>r>=0&&r<size&&c>=0&&c<size;
function victory(board,to,side){
 const r=Math.floor(to/size),c=to%size;
 for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
  let total=1;
  for(const sign of [-1,1])for(let n=1;n<=4;n++){
   const rr=r+dr*n*sign,cc=c+dc*n*sign;
   if(!inBounds(rr,cc)||board[rr*size+cc]!==side)break;total++;
  }
  if(total>=5)return true;
 }
 return false;
}
function describe(){
 if(state.mode==='training'){
  if(state.winner===1)return 'Wygrywasz! Pięć czarnych kamieni w rzędzie.';
  if(state.winner===2)return 'Komputer wygrał. Rozpocznij nową partię.';
  if(state.winner===3)return 'Remis — plansza została zapełniona.';
  return state.thinking?'Komputer wykonuje ruch…':'Twój ruch — postaw czarny kamień.';
 }
 const m=state.match;
 if(!m)return 'Wybierz przyjęte wyzwanie i otwórz pokój.';
 if(m.state.winner===1||m.state.winner===2)return 'Wygrał '+m.players[m.state.winner-1]+'.';
 if(m.state.winner===3)return 'Remis — zakończono partię.';
 if(!m.playable)return 'Partia jest niedostępna z powodu blokady.';
 return m.state.turn===m.player?'Twoja tura — wybierz wolne pole.':'Tura gracza '+m.players[m.state.turn-1]+'.';
}
function render(){
 const online=state.mode==='online',m=state.match;
 const board=online?(m?m.state.board:Array(count).fill(0)):state.board;
 const canPlay=online?Boolean(m&&m.playable&&!state.busy&&m.state.winner===0&&m.state.turn===m.player):
  !state.thinking&&state.winner===0;
 const area=$('board');area.replaceChildren();
 for(let i=0;i<count;i++){
  const row=Math.floor(i/size),col=i%size,piece=board[i];
  const cell=document.createElement('button');cell.type='button';cell.className='cell';
  if(row===0)cell.classList.add('edge-top');
  if(row===size-1)cell.classList.add('edge-bottom');
  if(col===0)cell.classList.add('edge-left');
  if(col===size-1)cell.classList.add('edge-right');
  if([3,7,11].includes(row)&&[3,7,11].includes(col))cell.classList.add('star');
  if(piece){cell.classList.add('occupied','p'+piece);}
  if(!online&&i===state.suggestion&&!piece)cell.classList.add('suggested');
  const last=online?(m?.state?.last??-1):state.last;
  if(last===i)cell.classList.add('last');
  cell.disabled=!!piece||!canPlay;
  cell.setAttribute('aria-label','Wiersz '+(row+1)+', kolumna '+(col+1)+
    (piece===1?' czarny kamień':piece===2?' biały kamień':' wolne pole'));
  if(!cell.disabled)cell.addEventListener('click',()=>void play(i));
  area.append(cell);
 }
 const moves=online?(m?.state?.moves||0):state.moves;
 $('move-count').textContent='Ruchy: '+moves;
 const turn=online?(m?.state?.turn||1):(state.thinking?2:1);
 $('turn-label').textContent='Tura: '+(turn===1?'czarne':'białe');
 $('game-state').textContent=describe();
 renderMoveHistory();
 $('dock-status').textContent=online?(m?'● POKÓJ ONLINE':'● ŁĄCZENIE'):'● TRENING';
 $('history-info').textContent=online?'Ruchy potwierdzane na serwerze':'Zapis lokalny w treningu';
 $('undo-move').disabled=online||state.snapshots.length===0;
 $('analyze-position').disabled=online||state.thinking||state.winner!==0;
 if(online&&m){
  $('black-name').textContent=m.players[0];$('white-name').textContent=m.players[1];
  $('session-heading').textContent='Partia online — Gomoku';
  $('room-tag').textContent='POKÓJ ONLINE';
 }else if(!online){
  $('black-name').textContent='Ty';$('white-name').textContent='Komputer';
  $('session-heading').textContent='Trening z komputerem';$('room-tag').textContent='TRENING';
 }
}
function restart(){
 ++state.epoch;state.board=Array(count).fill(0);state.winner=0;state.moves=0;
 state.last=-1;state.thinking=false;state.snapshots=[];state.suggestion=-1;state.trainHistory=[];
 $('analysis-note').hidden=true;render();
}
// Tactical evaluation for free-style Gomoku (five or more wins).
// All candidate calculations temporarily place a stone and restore the board.
const axes=[[1,0],[0,1],[1,1],[1,-1]];
const decisive=10000000;
function vicinity(board){
 const spots=new Uint8Array(count);
 let stones=0;
 for(let i=0;i<count;i++)if(board[i]){
  stones++;
  const row=Math.floor(i/size),col=i%size;
  for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
   const r=row+dr,c=col+dc;
   if(inBounds(r,c)&&!board[r*size+c])spots[r*size+c]=1;
  }
 }
 if(!stones)return [Math.floor(count/2)];
 const result=[];
 for(let i=0;i<count;i++)if(spots[i])result.push(i);
 return result;
}
function tacticalScore(board,at,player){
 if(board[at])return -1;
 const row=Math.floor(at/size),col=at%size;
 board[at]=player;
 let score=0,openThrees=0,fourThreats=0;
 for(const [dr,dc] of axes){
  let left=0,right=0;
  for(let step=1;step<size;step++){
   const r=row-dr*step,c=col-dc*step;
   if(!inBounds(r,c)||board[r*size+c]!==player)break;
   left++;
  }
  for(let step=1;step<size;step++){
   const r=row+dr*step,c=col+dc*step;
   if(!inBounds(r,c)||board[r*size+c]!==player)break;
   right++;
  }
  const span=left+1+right;
  if(span>=5){board[at]=0;return decisive;}
  const beforeR=row-dr*(left+1),beforeC=col-dc*(left+1);
  const afterR=row+dr*(right+1),afterC=col+dc*(right+1);
  const open=(inBounds(beforeR,beforeC)&&!board[beforeR*size+beforeC]?1:0)+
   (inBounds(afterR,afterC)&&!board[afterR*size+afterC]?1:0);
  if(span===4){score+=open===2?110000:open===1?23000:0;if(open)fourThreats++;}
  if(span===3){score+=open===2?12000:open===1?1700:0;if(open===2)openThrees++;}
  if(span===2)score+=open===2?750:open===1?135:0;
  if(span===1&&open===2)score+=20;
  // Also detect split sequences, e.g. XX_XX, which a contiguous-run count misses.
  for(let offset=-4;offset<=0;offset++){
   let ours=0,empty=0,valid=true;
   for(let j=0;j<5;j++){
    const r=row+dr*(offset+j),c=col+dc*(offset+j);
    if(!inBounds(r,c)){valid=false;break;}
    const piece=board[r*size+c];
    if(piece===player)ours++;
    else if(!piece)empty++;
    else {valid=false;break;}
   }
   if(valid&&ours===4&&empty===1){score+=7000;fourThreats++;}
   else if(valid&&ours===3&&empty===2)score+=350;
  }
 }
 board[at]=0;
 if(openThrees>=2)score+=80000;
 if(fourThreats>=2)score+=110000;
 score+=Math.max(0,14-Math.abs(row-7)-Math.abs(col-7))*2;
 return score;
}
function rankedMoves(board,turn,limit){
 const places=vicinity(board);
 const opponent=3-turn;
 const ranked=places.map(at=>{
  const attack=tacticalScore(board,at,turn);
  const block=tacticalScore(board,at,opponent);
  return {at,attack,block,rank:attack*1.18+block*1.12};
 });
 const wins=ranked.filter(move=>move.attack>=decisive);
 if(wins.length)return wins.sort((a,b)=>b.rank-a.rank).slice(0,limit);
 const blocks=ranked.filter(move=>move.block>=decisive);
 if(blocks.length)return blocks.sort((a,b)=>b.rank-a.rank).slice(0,limit);
 return ranked.sort((a,b)=>b.rank-a.rank||a.at-b.at).slice(0,limit);
}
function positionValue(board,turn){
 const spots=vicinity(board);
 let bestCPU=0,nextCPU=0,bestHuman=0,nextHuman=0;
 for(const at of spots){
  const cpu=tacticalScore(board,at,2),human=tacticalScore(board,at,1);
  if(cpu>bestCPU){nextCPU=bestCPU;bestCPU=cpu;}
  else if(cpu>nextCPU)nextCPU=cpu;
  if(human>bestHuman){nextHuman=bestHuman;bestHuman=human;}
  else if(human>nextHuman)nextHuman=human;
 }
 if(bestCPU>=decisive&&turn===2)return decisive*2;
 if(bestHuman>=decisive&&turn===1)return -decisive*2;
 return (bestCPU*1.15+nextCPU*.16)*(turn===2?1.14:1)-
  (bestHuman*1.18+nextHuman*.16)*(turn===1?1.14:1);
}
function searchPosition(board,turn,depth,alpha,beta,last,ply,search){
 if(last>=0&&victory(board,last,3-turn))return turn===1?decisive*5-ply:-decisive*5+ply;
 if(depth<=0||++search.nodes>search.nodeLimit)return positionValue(board,turn);
 const maximizing=turn===2;
 let best=maximizing?-Infinity:Infinity;
 const limit=depth>=3?6:depth===2?5:4;
 const moves=rankedMoves(board,turn,limit);
 if(!moves.length)return 0;
 for(const move of moves){
  board[move.at]=turn;
  const value=searchPosition(board,3-turn,depth-1,alpha,beta,move.at,ply+1,search);
  board[move.at]=0;
  if(maximizing){best=Math.max(best,value);alpha=Math.max(alpha,best);}
  else{best=Math.min(best,value);beta=Math.min(beta,best);}
  if(beta<=alpha)break;
 }
 return best;
}
function cpuMove(board,level='expert'){
 const places=vicinity(board);
 if(!places.length)return -1;
 let bestWin=-1,bestBlock=-1;
 for(const at of places){
  if(tacticalScore(board,at,2)>=decisive){bestWin=at;break;}
 }
 if(bestWin>=0)return bestWin;
 for(const at of places){
  if(tacticalScore(board,at,1)>=decisive){bestBlock=at;break;}
 }
 if(bestBlock>=0)return bestBlock;
 const moves=rankedMoves(board,2,level==='expert'?8:level==='hard'?6:1);
 if(!moves.length)return -1;
 if(level==='normal')return moves[0].at;
 const search={nodes:0,nodeLimit:level==='expert'?1350:360};
 const depth=level==='expert'?3:2;
 let result=moves[0].at,best=-Infinity;
 for(const move of moves){
  board[move.at]=2;
  const estimate=searchPosition(board,1,depth-1,-Infinity,Infinity,move.at,1,search);
  board[move.at]=0;
  // Use tactical score as a tiebreaker after searching the opponent's response.
  const combined=estimate+move.attack*.015+move.block*.004;
  if(combined>best){best=combined;result=move.at;}
 }
 return result;
}
function trainMove(to){
 if(state.thinking||state.winner||state.board[to])return;
 state.snapshots.push({board:state.board.slice(),winner:state.winner,moves:state.moves,last:state.last,history:state.trainHistory.slice()});
 state.suggestion=-1;$('analysis-note').hidden=true;
 state.board[to]=1;state.last=to;state.moves++;
 state.trainHistory.push({player:1,to,number:state.moves});
 if(victory(state.board,to,1))state.winner=1;
 else if(state.moves===count)state.winner=3;
 else state.thinking=true;
 render();
 if(!state.thinking)return;
 const epoch=state.epoch;
 window.setTimeout(()=>{
  if(epoch!==state.epoch||state.mode!=='training'||!state.thinking)return;
  const at=cpuMove(state.board,$('ai-level').value);
  if(at<0){state.winner=3;state.thinking=false;render();return;}
  state.board[at]=2;state.last=at;state.moves++;
  state.trainHistory.push({player:2,to:at,number:state.moves});
  if(victory(state.board,at,2))state.winner=2;
  else if(state.moves===count)state.winner=3;
  state.thinking=false;render();
 },330);
}
async function api(path,options={}){
 const response=await fetch('/auth/'+path,{
  credentials:'same-origin',cache:'no-store',
  headers:{Accept:'application/json',...(options.headers||{})},...options
 });
 let body={};try{body=await response.json();}catch{}
 if(!response.ok||body.ok!==true){
  const e=new Error(response.status===401?'Zaloguj się, aby grać ze znajomym.':
   response.status===409?'Stan partii się zmienił lub ruch jest niedozwolony. Odśwież planszę.':
   response.status===404?'Nie znaleziono partii dostępnej dla Twojego konta.':
   'Nie udało się wczytać danych. Spróbuj ponownie.');
  e.status=response.status;throw e;
 }
 return body;
}
function note(message){$('account-note').textContent=message;}
async function rooms(){
 note('Wczytywanie pokoi…');
 $('join-room').disabled=true;
 try{
  await api('profile');
  const result=await api('social/challenges');
  const available=result.challenges.filter(c=>c.game==='gomoku'&&c.status==='accepted');
  const select=$('room-select'),previous=select.value;
  select.replaceChildren();
  const blank=document.createElement('option');blank.value='';
  blank.textContent=available.length?'Wybierz rozgrywkę':'Brak przyjętych zaproszeń do Gomoku';
  select.append(blank);
  available.forEach(c=>{
   const option=document.createElement('option');option.value=c.id;option.textContent='Gomoku z '+c.opponent;
   select.append(option);
  });
  const wanted=new URLSearchParams(location.search).get('match');
  if(available.some(c=>c.id===wanted))select.value=wanted;
  else if(available.some(c=>c.id===previous))select.value=previous;
  else if(available.length)select.value=available[0].id;
  $('join-room').disabled=!select.value;
  note(available.length?'Przyjęte zaproszenia: '+available.length+'. Wybierz rozgrywkę.':
    'Nie masz jeszcze przyjętej partii. Dodaj znajomego i wyślij mu wyzwanie w panelu.');
 }catch(e){
  $('room-select').replaceChildren();$('join-room').disabled=true;
  note(e.message+' Otwórz panel, aby się zalogować lub wysłać zaproszenie.');
 }
}
async function loadMatch(id){
 if(!matchPattern.test(id))return;
 if(state.busy)return;
 state.busy=true;const epoch=state.epoch;
 try{
  const result=await api('match?id='+encodeURIComponent(id));
  if(epoch!==state.epoch||state.mode!=='online')return;
  if(result.match?.game!=='gomoku')throw new Error('Ten pokój nie jest partią Gomoku.');
  state.matchId=id;state.match=result.match;
  state.chatSignature='';void refreshRoomChat();
  $('room-select').value=id;
  history.replaceState(null,'','/konto/gomoku/?match='+encodeURIComponent(id));
  note('Połączono z pokojem. Ruchy są zatwierdzane przez serwer.');
 }catch(e){note(e.message);}
 finally{state.busy=false;render();}
}
async function onlineMove(to){
 const m=state.match;
 if(!m||state.busy||!m.playable||m.state.turn!==m.player||m.state.winner||m.state.board[to])return;
 state.busy=true;render();
 try{
  const result=await api('match',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id:state.matchId,version:m.version,move:{to}})});
  state.match=result.match;
 }catch(e){note(e.message);await refreshOnline(true);}
 finally{state.busy=false;render();}
}
async function refreshOnline(force=false){
 if(state.mode!=='online'||!state.matchId||(!force&&state.busy))return;
 if(!force)state.busy=true;
 const epoch=state.epoch,id=state.matchId;
 try{
  const result=await api('match?id='+encodeURIComponent(id));
  if(epoch===state.epoch&&state.matchId===id&&result.match?.game==='gomoku')state.match=result.match;
 }catch(e){if(epoch===state.epoch)note(e.message);}
 finally{if(!force){state.busy=false;render();}}
}
async function play(to){
 if(state.mode==='training')trainMove(to);
 else await onlineMove(to);
}

function notation(to){
 const row=Math.floor(to/15),col=to%15;
 return String.fromCharCode(65+col)+(row+1);
}
function renderMoveHistory(){
 const online=state.mode==='online',m=state.match;
 const entries=online?(Array.isArray(m?.state?.history)?m.state.history:[]):state.trainHistory;
 const list=$('moves-list');
 const lastSeen=list.dataset?.signature;
 const signature=(online?(m?.id||'none')+':':'training:')+
  entries.map(item=>item.number+':'+item.player+':'+item.to).join(',');
 if(signature===lastSeen)return;
 if(list.dataset)list.dataset.signature=signature;
 list.replaceChildren();
 $('history-count').textContent=String(entries.length);
 if(!entries.length){
  const empty=document.createElement('p');empty.className='dock-empty';
  empty.textContent=online&&m?.state?.moves>0?
   'Starsze ruchy tej partii nie były jeszcze rejestrowane. Nowe ruchy pojawią się tutaj.':
   online?'Wybierz pokój i rozpocznij partię.':'Wybierz pole i rozpocznij partię.';
  list.append(empty);return;
 }
 entries.forEach((entry,i)=>{
  if(!Number.isInteger(entry.to)||entry.to<0||entry.to>=225||
     ![1,2].includes(entry.player))return;
  const row=document.createElement('div');
  row.className='move-row'+(i===entries.length-1?' latest':'');
  const number=document.createElement('span');number.className='move-number';
  number.textContent=String(entry.number||i+1).padStart(2,'0');
  const player=document.createElement('span');player.className='move-player';
  const stone=document.createElement('i');stone.className='mini-stone p'+entry.player;
  stone.setAttribute('aria-hidden','true');
  const nick=document.createElement('strong');
  nick.textContent=online?(m?.players?.[entry.player-1]||'Gracz'):
    entry.player===1?'Ty':'Komputer';
  player.append(stone,nick);
  const move=document.createElement('strong');move.className='move-coordinate';
  move.textContent=notation(entry.to);
  row.append(number,player,move);list.append(row);
 });
 list.scrollTop=list.scrollHeight;
}
function setDockTab(tab){
 state.dockTab=tab;
 const moves=tab==='moves';
 $('moves-panel').hidden=!moves;$('chat-panel').hidden=moves;
 $('history-tab').classList.toggle('active',moves);$('chat-tab').classList.toggle('active',!moves);
 $('history-tab').setAttribute('aria-selected',String(moves));
 $('chat-tab').setAttribute('aria-selected',String(!moves));
 if(!moves)void refreshRoomChat();
}
function showChatNotice(text){
 const box=$('chat-messages');box.replaceChildren();
 const p=document.createElement('p');p.className='dock-empty';p.textContent=text;box.append(p);
 $('chat-status').textContent='Wyłącznie uczestnicy tej partii · 600 znaków';
}
function drawRoomChat(messages){
 const signature=(state.matchId||'')+':'+messages.map(x=>x.id).join(',');
 if(signature===state.chatSignature)return;
 state.chatSignature=signature;
 const box=$('chat-messages');box.replaceChildren();
 if(!messages.length){
  const p=document.createElement('p');p.className='dock-empty';
  p.textContent='Rozpocznij rozmowę z przeciwnikiem. Czat jest prywatny dla uczestników partii.';
  box.append(p);return;
 }
 messages.forEach(message=>{
  const mine=message.player===state.match?.player;
  const bubble=document.createElement('div');bubble.className='chat-bubble'+(mine?' own':'');
  const title=document.createElement('strong');
  title.textContent=mine?'Ty':(state.match?.players?.[message.player-1]||'Przeciwnik');
  const text=document.createElement('p');text.textContent=message.body;
  const time=document.createElement('time');
  const date=new Date(message.createdAt);
  time.textContent=Number.isNaN(date.getTime())?'':date.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
  bubble.append(title,text,time);box.append(bubble);
 });
 box.scrollTop=box.scrollHeight;
}
async function refreshRoomChat(){
 if(state.mode!=='online'||!state.matchId||!state.match){
  $('chat-input').disabled=true;$('chat-send').disabled=true;
  if(state.mode==='training')showChatNotice('Czat jest dostępny tylko w partii online ze znajomym.');
  else showChatNotice('Otwórz zaakceptowany pokój, aby rozpocząć rozmowę.');
  return;
 }
 if(state.chatBusy)return;
 state.chatBusy=true;
 const id=state.matchId,epoch=state.epoch;
 try{
  const result=await api('match/chat?id='+encodeURIComponent(id));
  if(epoch!==state.epoch||state.matchId!==id)return;
  $('chat-input').disabled=false;$('chat-send').disabled=false;
  drawRoomChat(result.messages);
  $('chat-status').textContent='Prywatny czat partii · ostatnie 60 wiadomości';
 }catch(error){
  if(epoch!==state.epoch)return;
  $('chat-input').disabled=true;$('chat-send').disabled=true;
  $('chat-status').textContent=error.message;
 }finally{state.chatBusy=false;}
}
$('history-tab').addEventListener('click',()=>setDockTab('moves'));
$('chat-tab').addEventListener('click',()=>setDockTab('chat'));
$('chat-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(state.mode!=='online'||!state.matchId||state.chatBusy)return;
 const message=$('chat-input').value.trim();
 if(!message||message.length>600){
  $('chat-status').textContent='Wpisz wiadomość o długości do 600 znaków.';return;
 }
 const id=state.matchId,epoch=state.epoch;
 $('chat-send').disabled=true;
 try{
  await api('match/chat',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id,message})});
  if(epoch!==state.epoch||state.matchId!==id)return;
  $('chat-input').value='';
  state.chatSignature='';
  await refreshRoomChat();
 }catch(error){$('chat-status').textContent=error.message;}
 finally{if(epoch===state.epoch&&state.matchId===id)$('chat-send').disabled=false;}
});
window.setInterval(()=>{
 if(state.mode==='online'&&state.matchId&&document.visibilityState==='visible')void refreshRoomChat();
},8000);

function undoTrainingMove(){
 if(state.mode!=='training'||!state.snapshots.length)return;
 ++state.epoch;state.thinking=false;
 const previous=state.snapshots.pop();
 state.board=previous.board;state.winner=previous.winner;state.moves=previous.moves;state.last=previous.last;
 state.trainHistory=previous.history;
 state.suggestion=-1;$('analysis-note').hidden=true;render();
}
function analyzeTrainingPosition(){
 if(state.mode!=='training'||state.thinking||state.winner!==0)return;
 const choices=rankedMoves(state.board,1,3);
 if(!choices.length)return;
 const candidate=choices[0];state.suggestion=candidate.at;
 const row=Math.floor(candidate.at/15)+1,col=candidate.at%15+1;
 const reason=candidate.attack>=decisive?'Możliwa natychmiastowa wygrana.':
   candidate.block>=decisive?'Zablokuj natychmiastową wygraną komputera.':
   candidate.attack>12000?'Rozwijaj silne zagrożenie.':'Propozycja na podstawie analizy taktycznej.';
 const label=$('analysis-note');label.textContent='Analiza: rząd '+row+', kolumna '+col+'. '+reason;
 label.hidden=false;render();
}
function openGameSettings(){
 const section=state.mode==='training'?$('training-settings'):$('online-settings');
 section.scrollIntoView?.({behavior:'smooth',block:'nearest'});
 const target=state.mode==='training'?$('ai-level'):$('room-select');
 target.focus();
}
async function toggleFullscreen(){
 try{
  if(document.fullscreenElement){await document.exitFullscreen();return;}
  if(!document.documentElement?.requestFullscreen)throw new Error('unsupported');
  await document.documentElement.requestFullscreen();
 }catch{
  const label=$('analysis-note');label.textContent='Tryb pełnoekranowy nie jest dostępny w tej przeglądarce.';
  label.hidden=false;
 }
}
function setMode(mode){
 if(state.mode===mode)return;
 state.mode=mode;state.epoch++;state.busy=false;state.match=null;state.matchId=null;
 state.chatSignature='';setDockTab('moves');
 $('chat-input').disabled=true;$('chat-send').disabled=true;
 if(mode==='training')showChatNotice('Czat jest dostępny tylko w partii online ze znajomym.');
 state.suggestion=-1;$('analysis-note').hidden=true;
 $('training-settings').hidden=mode!=='training';$('online-settings').hidden=mode!=='online';
 $('refresh-match').hidden=mode!=='online';
 $('training-mode').classList.toggle('active',mode==='training');
 $('online-mode').classList.toggle('active',mode==='online');
 $('training-mode').setAttribute('aria-pressed',String(mode==='training'));
 $('online-mode').setAttribute('aria-pressed',String(mode==='online'));
 if(mode==='online'){render();void rooms();}
 else {history.replaceState(null,'','/konto/gomoku/');restart();}
}
$('training-mode').addEventListener('click',()=>setMode('training'));
$('online-mode').addEventListener('click',()=>setMode('online'));
$('restart').addEventListener('click',restart);
$('undo-move').addEventListener('click',undoTrainingMove);
$('analyze-position').addEventListener('click',analyzeTrainingPosition);
$('game-settings').addEventListener('click',openGameSettings);
$('fullscreen-game').addEventListener('click',()=>void toggleFullscreen());
$('ai-level').addEventListener('change',()=>{
 const descriptions={
  normal:'Normalny: podstawowe szukanie pięciu w rzędzie, blokowanie i ocena bliskich pól.',
  hard:'Trudny: analizuje zagrożenia oraz odpowiedź przeciwnika.',
  expert:'Ekspert: analizuje kilka kolejnych ruchów, podwójne zagrożenia i wymuszone bloki.'
 };
 $('ai-hint').textContent=descriptions[$('ai-level').value]||descriptions.expert;
 restart();
});
$('reload-rooms').addEventListener('click',()=>void rooms());
$('join-room').addEventListener('click',()=>void loadMatch($('room-select').value));
$('refresh-match').addEventListener('click',()=>void refreshOnline());
window.setInterval(()=>{
 if(state.mode==='online'&&state.matchId&&!state.busy&&document.visibilityState==='visible')
  void refreshOnline();
},4000);
render();
showChatNotice('Czat jest dostępny tylko w partii online ze znajomym.');
const entry=new URLSearchParams(location.search).get('match');
if(entry&&matchPattern.test(entry))setMode('online');
})();`;
export function serveGomokuConsole(req,res,url){
 if(req.method!=='GET')return false;
 const path=url.pathname.replace(/\/+$/,'')||'/';
 const response={
  '/konto/gomoku':['text/html; charset=utf-8',html],
  '/konto/gomoku/styl.css':['text/css; charset=utf-8',css],
  '/konto/gomoku/app.js':['application/javascript; charset=utf-8',js]
 }[path];
 if(!response)return false;
 res.writeHead(200,{...secure,'Content-Type':response[0],'Content-Length':Buffer.byteLength(response[1])});
 res.end(response[1]);return true;
}
