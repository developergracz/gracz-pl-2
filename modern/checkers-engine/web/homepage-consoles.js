(() => {
  const style = document.createElement('style');
  style.textContent = `
    .games-zone{margin:2px 34px 18px;padding:22px;border:1px solid #1e323c;border-radius:16px;background:linear-gradient(180deg,#0b151c,#081117);box-shadow:0 18px 45px #0005}
    .games-zone-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:17px}.games-zone-head h2{margin:0;font-size:25px;letter-spacing:-.7px}.games-zone-head p{margin:6px 0 0;color:#80939e;font-size:11px}.games-zone-head .eyebrow{display:block;margin-bottom:5px;color:#22df78;font-size:9px;font-weight:900;letter-spacing:1.4px}
    .games-zone-filters{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.games-zone-filters button{padding:8px 11px;border:1px solid #263944;border-radius:8px;background:#0e1a22;color:#91a4ae;font-size:9px;cursor:pointer}.games-zone-filters button.active{border-color:#1f7b4c;background:#153c29;color:#6ff0a9}
    .games-zone .game-showcase{padding:0;gap:16px}.games-zone .game-card{position:relative;border-color:#263944;border-radius:14px;background:linear-gradient(180deg,#0d1921,#091219);box-shadow:none}.games-zone .game-card.checkers-card{box-shadow:inset 0 3px 0 #1ee078}.games-zone .game-card.gomoku{box-shadow:inset 0 3px 0 #2388d6}
    .games-zone .game-preview{position:relative!important;height:330px!important;margin:0 14px!important;border:1px solid #293b45!important;border-radius:10px!important;overflow:hidden!important;background:#091219!important}
    .games-zone .game-preview>*:not(.forced-board-wrap){display:none!important}
    .forced-board-wrap{position:absolute!important;inset:0!important;z-index:50!important;display:grid!important;place-items:center!important;padding:14px!important;background:radial-gradient(circle at 50% 45%,#13232b,#091219 72%)!important}
    .forced-checkers-board{width:min(310px,92%)!important;aspect-ratio:1!important;display:grid!important;grid-template-columns:repeat(8,1fr)!important;grid-template-rows:repeat(8,1fr)!important;border:2px solid #9a7046!important;border-radius:5px!important;box-shadow:0 14px 35px #0008,inset 0 0 0 1px #f3d7ab!important;overflow:hidden!important}
    .forced-checkers-board>span{display:grid!important;place-items:center!important}.forced-checkers-board .light{background:#efd19b!important}.forced-checkers-board .dark{background:#76583d!important}.forced-checkers-board i{display:block!important;width:68%!important;aspect-ratio:1!important;border-radius:50%!important;box-shadow:inset 0 2px 3px #fff7,0 2px 3px #0006!important;border:1px solid #777!important}.forced-checkers-board i.white{background:radial-gradient(circle at 35% 28%,#fff,#ece9df 60%,#bbb)!important}.forced-checkers-board i.black{background:radial-gradient(circle at 35% 28%,#454545,#171717 65%,#050505)!important;border-color:#111!important}
    .forced-gomoku-board{width:min(310px,92%)!important;aspect-ratio:1!important;position:relative!important;background-color:#2f9fa1!important;background-image:linear-gradient(#bde9e9 1px,transparent 1px),linear-gradient(90deg,#bde9e9 1px,transparent 1px),linear-gradient(135deg,#2ba0a4,#237f86)!important;background-size:24px 24px,24px 24px,100% 100%!important;border:2px solid #82e5e8!important;border-radius:5px!important;box-shadow:0 14px 35px #0008,0 0 24px #2fbec944!important;overflow:hidden!important}
    .forced-gomoku-board i{display:block!important;position:absolute!important;width:19px!important;height:19px!important;border-radius:50%!important;transform:translate(-50%,-50%)!important;box-shadow:0 2px 4px #0008!important}.forced-gomoku-board i.white{background:radial-gradient(circle at 35% 28%,#fff,#e9eeee 62%,#aeb8b8)!important;border:1px solid #c9d0d0!important}.forced-gomoku-board i.black{background:radial-gradient(circle at 35% 28%,#414a50,#101418 64%,#020304)!important;border:1px solid #000!important}
    .game-info-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:12px 14px 0}.game-info-strip span{display:grid;gap:2px;padding:8px 9px;border:1px solid #20323c;border-radius:8px;background:#0b161d;color:#778b96;font-size:8px}.game-info-strip b{color:#dce6eb;font-size:10px}.games-zone .game-card-foot{grid-template-columns:auto 1fr;align-items:center;padding:13px 14px 15px}.games-zone .play-btn{min-height:42px;display:grid;place-items:center;border-radius:8px;background:linear-gradient(#23df79,#12b95e);color:#04130a}.games-zone .play-btn.purple{background:linear-gradient(#278fe0,#1763ad);color:#fff}.game-hidden{display:none!important}
    @media(max-width:900px){.games-zone{margin-left:12px;margin-right:12px;padding:14px}.games-zone-head{align-items:flex-start;flex-direction:column}.games-zone .game-showcase{grid-template-columns:1fr}.games-zone .game-preview{height:300px!important}.game-info-strip{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  function createCheckersBoard(){
    const board=document.createElement('div');board.className='forced-checkers-board';
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const sq=document.createElement('span');const dark=(r+c)%2===1;sq.className=dark?'dark':'light';
      if(dark&&(r<3||r>4)){const p=document.createElement('i');p.className=r<3?'black':'white';sq.appendChild(p)}
      board.appendChild(sq);
    }
    return board;
  }
  function createGomokuBoard(){
    const board=document.createElement('div');board.className='forced-gomoku-board';
    [['black',44,34],['white',52,34],['black',44,42],['black',52,42],['white',60,42],['white',36,50],['black',44,50],['white',52,50],['black',60,50],['black',68,50],['black',36,58],['white',44,58],['black',52,58],['white',60,58],['black',52,66]].forEach(([kind,x,y])=>{const p=document.createElement('i');p.className=kind;p.style.left=x+'%';p.style.top=y+'%';board.appendChild(p)});
    return board;
  }
  function forceBoard(preview,kind){
    if(!preview)return;
    let wrap=preview.querySelector(':scope > .forced-board-wrap');
    if(!wrap){wrap=document.createElement('div');wrap.className='forced-board-wrap';preview.appendChild(wrap)}
    const expected=kind==='gomoku'?'.forced-gomoku-board':'.forced-checkers-board';
    if(!wrap.querySelector(expected)){wrap.replaceChildren(kind==='gomoku'?createGomokuBoard():createCheckersBoard())}
  }
  function decorate(){
    const showcase=document.querySelector('.game-showcase');if(!showcase)return;
    let zone=showcase.closest('.games-zone');
    if(!zone){
      zone=document.createElement('section');zone.className='games-zone';
      const head=document.createElement('header');head.className='games-zone-head';head.innerHTML='<div><span class="eyebrow">CENTRUM GIER</span><h2>Wybierz grę i rozpocznij rozgrywkę</h2><p>Jedno miejsce dla stołów, rankingów, turniejów i społeczności graczy.</p></div><div class="games-zone-filters"><button class="active" data-filter="all">Wszystkie gry</button><button data-filter="checkers">Warcaby</button><button data-filter="gomoku">Gomoku</button><button data-ranking>Ranking ELO</button></div>';
      showcase.parentNode.insertBefore(zone,showcase);zone.append(head,showcase);
      const check=showcase.querySelector('.checkers-card'),gom=showcase.querySelector('.gomoku');
      head.querySelectorAll('[data-filter]').forEach(btn=>btn.onclick=()=>{head.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===btn));check?.classList.toggle('game-hidden',btn.dataset.filter==='gomoku');gom?.classList.toggle('game-hidden',btn.dataset.filter==='checkers')});
      head.querySelector('[data-ranking]').onclick=()=>location.href='/ranking.html';
    }
    const checkCard=showcase.querySelector('.checkers-card'),gomCard=showcase.querySelector('.gomoku');
    const checkPreview=checkCard?.querySelector('.game-preview'),gomPreview=gomCard?.querySelector('.game-preview');
    forceBoard(checkPreview,'checkers');forceBoard(gomPreview,'gomoku');
    if(checkCard&&!checkCard.querySelector('.game-info-strip')){const info=document.createElement('div');info.className='game-info-strip';info.innerHTML='<span><b>2 graczy</b>najczęściej</span><span><b>3–30 min</b>czas gry</span><span><b>ELO ranking</b>rankingowa</span><span><b>Turnieje</b>dostępne</span>';checkPreview.after(info)}
    if(gomCard&&!gomCard.querySelector('.game-info-strip')){const info=document.createElement('div');info.className='game-info-strip';info.innerHTML='<span><b>2 graczy</b>pojedynek</span><span><b>5 w linii</b>cel gry</span><span><b>3–15 min</b>typowo</span><span><b>Ranking</b>opcjonalny</span>';gomPreview.after(info)}
    const gomPlay=gomCard?.querySelector('.play-btn');if(gomPlay){gomPlay.disabled=false;gomPlay.removeAttribute('disabled');gomPlay.onclick=()=>location.href='/players.html?game=gomoku'}
  }
  const run=()=>decorate();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('load',run);
  new MutationObserver(run).observe(document.documentElement,{subtree:true,childList:true});
  setInterval(run,750);
})();