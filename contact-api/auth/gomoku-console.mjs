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
<div class="branding"><a class="brand" href="https://gracz.pl/" aria-label="gracz.pl — strona główna">gracz<span>.pl</span></a><span class="badge-premium">★ PREMIUM</span></div>
<h1>Gomoku <em>Online</em></h1><div class="premium-sub">FULL MAX PREMIUM</div>
<p class="lede">Pięć w linii. Jeden ruch może zmienić wszystko.</p>
</header>
<div class="mode" role="group" aria-label="Tryb gry">
<button type="button" class="mode-choice active" id="training-mode" aria-pressed="true"><span class="mode-icon" aria-hidden="true">♛</span><span><strong>Trening</strong><small>Graj od razu z komputerem</small></span><span class="mode-arrow" aria-hidden="true">›</span></button>
<button type="button" class="mode-choice" id="online-mode" aria-pressed="false"><span class="mode-icon" aria-hidden="true">♙</span><span><strong>Ze znajomym</strong><small>Wspólna partia online</small></span><span class="mode-arrow" aria-hidden="true">›</span></button>
</div>
<section class="sidecard" id="training-settings"><h2>Twój trening</h2>
<p>Grasz czarnymi kamieniami. Komputer odpowiada białymi. Bez konta i bez rankingu.</p>
<label for="ai-level">Poziom komputera</label>
<select id="ai-level" aria-label="Poziom trudności komputera"><option value="normal">Normalny</option><option value="hard">Trudny</option><option value="expert" selected>♛ Ekspert — kilka ruchów naprzód</option></select>
<p id="ai-hint" class="hint">Ekspert szuka wymuszonych wygranych, blokuje zagrożenia i analizuje odpowiedzi przeciwnika.</p>
<button class="primary" id="restart" type="button"><span aria-hidden="true">▶</span> Nowa partia</button></section>
<section class="sidecard" id="online-settings" hidden><h2>Moje pokoje Gomoku</h2>
<p id="account-note" role="status">Sprawdzanie sesji gracza…</p>
<label for="room-select">Wybierz zaakceptowane wyzwanie</label>
<select id="room-select"><option value="">Brak wybranego pokoju</option></select>
<div class="actions"><button class="primary" id="join-room" type="button">Otwórz partię</button><button class="secondary" id="reload-rooms" type="button">Odśwież listę</button></div>
<a class="textlink" href="/konto/panel/">Dodaj znajomego lub wyślij zaproszenie w Panelu Gracza</a></section>
<section class="sidecard rules"><h2>ⓘ &nbsp;Jak grać?</h2>
<p>Ułóż <b>pięć kamieni w jednej linii</b>: poziomo, pionowo lub po przekątnej. Kliknij wolne przecięcie linii planszy.</p>
<p class="muted">W trybie online serwer zatwierdza ruchy. Trening nie jest rankingowy.</p>
</section>
<nav class="side-links"><a href="/konto/panel/">Mój panel</a><a href="https://gracz.pl/gry/gomoku/">Zasady Gomoku</a></nav>
</aside>
<section class="boardarea" aria-label="Konsola gry Gomoku">
<div class="players">
<div class="player first"><span class="stone black" aria-hidden="true"></span><div><strong id="black-name">Ty</strong><small>Czarne — zaczynają</small></div><span class="player-icon" aria-hidden="true">♛</span></div>
<div class="versus">VS</div>
<div class="player second"><span class="stone white" aria-hidden="true"></span><div><strong id="white-name">Komputer</strong><small>Białe</small></div><span class="player-icon" aria-hidden="true">♙</span></div>
</div>
<div class="state" id="game-state" role="status" aria-live="polite">Twój ruch — postaw czarny kamień.</div>
<div class="arena">
<div class="board-center"><div class="boardtop"><h2 id="session-heading">Trening z komputerem</h2><span id="room-tag" class="roomtag">TRENING</span></div>
<div class="boardframe"><div class="board" id="board" role="grid" aria-label="Plansza Gomoku 15 na 15"></div></div>
</div>
<div class="game-tools" aria-label="Narzędzia gry">
<button type="button" class="tool-btn" id="undo-move"><span aria-hidden="true">↶</span> Cofnij ruch</button>
<button type="button" class="tool-btn" id="analyze-position"><span aria-hidden="true">▥</span> Analiza</button>
<button type="button" class="tool-btn" id="game-settings"><span aria-hidden="true">⚙</span> Ustawienia</button>
<button type="button" class="tool-btn" id="fullscreen-game"><span aria-hidden="true">⛶</span> Pełny ekran</button>
<button type="button" class="tool-btn" id="refresh-match" hidden><span aria-hidden="true">↻</span> Odśwież partię</button>
</div></div>
<div class="bottom"><span class="info-pill" id="move-count">Ruchy: 0</span><span id="board-help" class="help">Wybierz wolne pole, aby postawić czarny kamień.</span><span class="info-pill" id="turn-label">Tura: czarne</span></div>
<p class="analysis-note" id="analysis-note" role="status" aria-live="polite" hidden></p>
</section>
</main></body></html>`;
const css=String.raw`:root{color-scheme:dark;font-family:Inter,"Segoe UI",Arial,sans-serif;font-synthesis:none}
*{box-sizing:border-box}html{background:#051421}body{margin:0;color:#eaf6fc;background:radial-gradient(ellipse at 75% 15%,#17506455 0%,transparent 42%),linear-gradient(120deg,#04101c,#092338 70%,#041320);min-height:100dvh}
a{color:inherit}.skip{position:absolute;top:-100px;left:8px;background:#fff;color:#111;padding:10px;z-index:10}.skip:focus{top:8px}
button,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}
.top{height:68px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:11px clamp(15px,3vw,45px);background:#061724d9;border-bottom:1px solid #366779}
.brand{text-decoration:none;font-size:30px;font-weight:950;letter-spacing:-1.5px;color:#fff}.brand span{color:#fa3e54}
.tag{font-size:10px;font-weight:850;letter-spacing:1.7px;color:#b9d4df}.tag b{color:#f2cc80}
.topnav{display:flex;gap:18px}.topnav a{text-decoration:none;font-size:12px;font-weight:750;color:#cde3ec}.topnav a:hover{color:#f6d38a}
.layout{display:grid;grid-template-columns:minmax(270px,345px) minmax(0,1fr);gap:clamp(14px,2vw,25px);max-width:1510px;margin:auto;padding:clamp(14px,2vw,27px);align-items:start}
.sidebar{background:linear-gradient(145deg,#103246,#071b2b);border:1px solid #326378;border-radius:18px;padding:clamp(17px,2vw,26px);box-shadow:0 12px 35px #0004}
.eyebrow{font-size:10px;letter-spacing:1.6px;color:#f0bd69;font-weight:950}.sidebar h1{font-size:clamp(32px,3vw,43px);letter-spacing:-1px;margin:10px 0}.sidebar h1 em{font-weight:500;color:#68dbde;font-style:normal}.lede{font-size:13px;line-height:1.6;color:#b9d3dc;margin-bottom:22px}
.mode{display:grid;gap:9px}.mode-choice{text-align:left;padding:14px;background:#0a2535;border:1px solid #396477;border-radius:11px;color:#eefaff;transition:border-color .15s,background .15s}
.mode-choice.active{border-color:#efc277;background:linear-gradient(90deg,#214a57,#102e40)}.mode-choice strong,.mode-choice small{display:block}.mode-choice strong{font-size:14px}.mode-choice small{font-size:11px;color:#adc9d5;margin-top:4px}
.sidecard{border-top:1px solid #325465;padding-top:16px;margin-top:20px}.sidecard h2{font-size:16px;margin:0 0 10px}.sidecard p{color:#b4cdd8;line-height:1.55;font-size:12px}
.sidecard label{font-size:12px;display:block;margin:12px 0 7px;color:#dcecf3}
select{width:100%;min-width:0;padding:12px;border:1px solid #47798c;background:#061f2d;color:#fff;border-radius:9px}
.primary,.secondary{border-radius:9px;padding:11px 16px;font-size:12px;font-weight:900}
.primary{border:1px solid #f7d591;background:linear-gradient(#fbe1a8,#e6b35b);color:#172536}.secondary{border:1px solid #497b8e;background:#0b2c41;color:#e4f9ff}
.actions{display:flex;gap:9px;margin-top:13px;flex-wrap:wrap}.textlink{display:inline-block;font-size:12px;color:#9ee3e6;margin-top:14px;line-height:1.55}.muted{color:#8faebb!important}
.boardarea{border:1px solid #396a80;background:linear-gradient(155deg,#0a2d40,#071b2c);border-radius:18px;padding:clamp(13px,2vw,25px);min-width:0}
.boardtop{display:flex;justify-content:space-between;align-items:center;gap:10px}.boardtop h2{font-size:clamp(19px,2.4vw,29px);margin:7px 0 2px}
.roomtag{white-space:nowrap;border:1px solid #987b4c;border-radius:25px;color:#f9d99a;padding:8px 11px;font-size:10px;font-weight:850;letter-spacing:1px}
.players{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:17px 0 12px}
.player{display:flex;align-items:center;gap:10px;min-width:0;background:#112f42;border:1px solid #3b6575;border-radius:11px;padding:10px clamp(8px,2vw,15px);flex:1}
.player strong,.player small{display:block;overflow-wrap:anywhere}.player strong{font-size:13px}.player small{font-size:10px;color:#a4bdca;margin-top:3px}.versus{font-size:11px;font-weight:950;color:#e9c078}
.stone{display:block;flex:none;width:26px;height:26px;border-radius:50%;box-shadow:inset -4px -5px 7px #0007,0 2px 4px #0005}
.stone.black{background:radial-gradient(circle at 32% 27%,#6a7787,#101e2b 65%,#02060b)}.stone.white{background:radial-gradient(circle at 30% 20%,#fff,#e1e7e9 63%,#929fa4)}
.state{padding:11px 13px;background:#0f3948;border:1px solid #3d8993;border-radius:9px;font-size:13px;color:#dbf8f9;text-align:center;font-weight:750}
.boardframe{width:min(100%,670px,66vh);margin:13px auto;aspect-ratio:1;border:clamp(5px,1.4vw,12px) solid #9e6935;border-radius:12px;box-shadow:0 0 0 2px #d6b67e,0 14px 36px #0007,inset 0 0 25px #47321a;overflow:hidden;background:#d2a967}
.board{width:100%;height:100%;display:grid;grid-template-columns:repeat(15,minmax(0,1fr));grid-template-rows:repeat(15,minmax(0,1fr));padding:0;background:radial-gradient(ellipse at 30% 18%,#f3d49b,#c79759 95%)}
.cell{border:0;padding:0;background:transparent;position:relative;min-width:0;min-height:0;display:grid;place-items:center;outline-offset:-2px}
.cell::before{content:"";position:absolute;width:100%;height:100%;background:linear-gradient(to right,transparent calc(50% - .7px),#84603a calc(50% - .7px),#84603a calc(50% + .7px),transparent calc(50% + .7px)),linear-gradient(to bottom,transparent calc(50% - .7px),#84603a calc(50% - .7px),#84603a calc(50% + .7px),transparent calc(50% + .7px));pointer-events:none}
.cell.edge-top::before{background:linear-gradient(to right,transparent calc(50% - .7px),#84603a calc(50% - .7px),#84603a calc(50% + .7px),transparent calc(50% + .7px)),linear-gradient(to bottom,transparent 50%,#84603a 50%,#84603a calc(50% + .7px),transparent calc(50% + .7px))}
.cell.edge-bottom::before{background:linear-gradient(to right,transparent calc(50% - .7px),#84603a calc(50% - .7px),#84603a calc(50% + .7px),transparent calc(50% + .7px)),linear-gradient(to bottom,transparent calc(50% - .7px),#84603a calc(50% - .7px),#84603a 50%,transparent 50%)}
.cell.edge-left::before{background:linear-gradient(to right,transparent 50%,#84603a 50%,#84603a calc(50% + .7px),transparent calc(50% + .7px)),linear-gradient(to bottom,transparent calc(50% - .7px),#84603a calc(50% - .7px),#84603a calc(50% + .7px),transparent calc(50% + .7px))}
.cell.edge-right::before{background:linear-gradient(to right,transparent calc(50% - .7px),#84603a calc(50% - .7px),#84603a 50%,transparent 50%),linear-gradient(to bottom,transparent calc(50% - .7px),#84603a calc(50% - .7px),#84603a calc(50% + .7px),transparent calc(50% + .7px))}
.cell.star:not(.occupied)::after{content:"";width:16%;height:16%;background:#7c5631;border-radius:50%;position:relative;z-index:1}
.cell.occupied::after{content:"";display:block;width:83%;height:83%;border-radius:50%;position:relative;z-index:2;box-shadow:0 2px 5px #0007,inset -2px -3px 5px #0006}
.cell.p1.occupied::after{background:radial-gradient(circle at 30% 22%,#738392,#07141d 68%,#02070a)}
.cell.p2.occupied::after{background:radial-gradient(circle at 30% 20%,#fff,#dae3e7 70%,#9fa9ac)}
.cell.last::after{outline:2px solid #e1a23b;outline-offset:1px}
.cell:not(:disabled):hover{background:#f4db9b88;cursor:pointer}
.cell:focus-visible{outline:3px solid #20b8c6;z-index:3}
.bottom{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;color:#b3d3df;font-size:12px;font-weight:800}
.help{color:#90afbb;font-size:11px;text-align:center;margin-bottom:0}
footer{color:#829fae;text-align:center;font-size:11px;padding:8px 10px 26px}
[hidden]{display:none!important}
@media(max-width:900px){.layout{grid-template-columns:1fr}.sidebar{padding:16px}.sidecard.rules{display:none}.boardframe{width:min(100%,72vh,670px)}}
@media(max-width:560px){.top{height:auto;flex-wrap:wrap;padding:10px 15px}.brand{font-size:25px}.tag{display:none}.topnav{gap:13px}.layout{padding:10px;gap:10px}.sidebar h1{font-size:28px}.sidebar .lede{margin:8px 0}.mode{grid-template-columns:1fr 1fr}.mode-choice{padding:9px}.mode-choice strong{font-size:12px}.mode-choice small{font-size:10px}.boardarea{padding:11px}.boardframe{width:100%;border-width:5px}.players{gap:5px}.player{padding:7px;gap:6px}.player strong{font-size:11px}.player small{font-size:9px}.stone{height:20px;width:20px}.boardtop h2{font-size:18px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{transition:none!important;animation:none!important}}`;
const js=String.raw`(()=>{'use strict';
const $=id=>document.getElementById(id);
const size=15,count=225;
const matchPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const state={mode:'training',board:Array(count).fill(0),winner:0,moves:0,last:-1,
 thinking:false,matchId:null,match:null,busy:false,epoch:0};
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
 state.last=-1;state.thinking=false;render();
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
 state.board[to]=1;state.last=to;state.moves++;
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
function setMode(mode){
 if(state.mode===mode)return;
 state.mode=mode;state.epoch++;state.busy=false;state.match=null;state.matchId=null;
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
