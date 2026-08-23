(() => {
  const style = document.createElement('style');
  style.textContent = `
    .games-zone{margin:8px 34px 18px;padding:22px 22px 14px;border:1px solid #183647;border-radius:16px;background:linear-gradient(180deg,#091722,#07111a);box-shadow:0 20px 55px #0007,inset 0 1px 0 #143749}
    .games-zone-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:17px}.games-zone-head h2{margin:0;font-size:27px;letter-spacing:-.8px}.games-zone-head p{margin:6px 0 0;color:#8ca0ad;font-size:12px}.games-zone-head .eyebrow{display:block;margin-bottom:5px;color:#20e37a;font-size:10px;font-weight:900;letter-spacing:1.4px}
    .games-zone-filters{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.games-zone-filters button{padding:8px 12px;border:1px solid #294251;border-radius:9px;background:#0b1720;color:#91a6b2;font-size:10px;cursor:pointer}.games-zone-filters button.active{border-color:#147a4a;background:#0e3827;color:#55efa0}
    .games-zone .game-showcase{padding:0;gap:20px}.games-zone .game-card{position:relative;border:1px solid #1d4050;border-radius:14px;background:linear-gradient(180deg,#0b1a23,#071219);box-shadow:0 18px 45px #0005;overflow:hidden}.games-zone .game-card.checkers-card{box-shadow:inset 0 2px 0 #1ee078,0 18px 45px #0005}.games-zone .game-card.gomoku{box-shadow:inset 0 2px 0 #258dde,0 18px 45px #0005}
    .games-zone .card-top{padding:16px 18px 11px}.games-zone .card-top h2{font-size:21px!important}.games-zone .card-top p{font-size:11px}.game-title-row{display:flex;align-items:center;gap:10px}.game-symbol{display:grid;place-items:center;width:42px;height:42px;border:1px solid #1b6c47;border-radius:50%;background:radial-gradient(circle at 35% 30%,#24e279,#0a5b38);color:white;font-size:19px;box-shadow:0 0 18px #15dd7440}.gomoku .game-symbol{border-color:#1b6ca8;background:radial-gradient(circle at 35% 30%,#288ee4,#0b3760);box-shadow:0 0 18px #238fe050}.game-status{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.game-status span{padding:3px 7px;border:1px solid #1d5b45;border-radius:999px;background:#0a2b20;color:#7bd9aa;font-size:8px}.gomoku .game-status span{border-color:#20577a;background:#0a2436;color:#79bce8}
    .game-badge{position:absolute;top:14px;right:16px;z-index:4;padding:6px 10px;border:1px solid #1d6e46;border-radius:8px;background:linear-gradient(#10472e,#0b2d1f);box-shadow:0 0 18px #10e67635;color:#7af0ad;font-size:8px;font-weight:900}.gomoku .game-badge{border-color:#1e69a7;background:linear-gradient(#154d7b,#0d2f4e);box-shadow:0 0 18px #1d8fe650;color:#86c8ff}
    .games-zone .game-preview{position:relative!important;height:385px!important;margin:0 14px!important;border:1px solid #203b48!important;border-radius:9px!important;overflow:hidden!important;background:radial-gradient(circle at 50% 40%,#0f2731,#07131a 74%)!important}
    .games-zone .game-preview>*:not(.forced-board-wrap){display:none!important}.forced-board-wrap{position:absolute!important;inset:0!important;z-index:50!important;display:grid!important;place-items:center!important;padding:10px!important;background:radial-gradient(circle at 50% 45%,#0d2730,#071219 72%)!important;perspective:900px!important}
    .forced-checkers-board{width:min(365px,88%)!important;aspect-ratio:1!important;display:grid!important;grid-template-columns:repeat(8,1fr)!important;grid-template-rows:repeat(8,1fr)!important;border:7px solid #9b5526!important;border-radius:7px!important;box-shadow:0 24px 34px #0009,0 0 0 2px #4d2a17,inset 0 0 24px #0004!important;overflow:hidden!important;transform:rotateX(5deg)!important;transform-origin:center bottom!important;background:#8c552b!important}
    .forced-checkers-board>span{display:grid!important;place-items:center!important;position:relative!important}.forced-checkers-board .light{background:linear-gradient(135deg,#e8bc79,#f1d49a 52%,#d5a65f)!important}.forced-checkers-board .dark{background:linear-gradient(135deg,#704019,#925b2a 52%,#5b3114)!important}.forced-checkers-board i{display:block!important;width:72%!important;aspect-ratio:1!important;border-radius:50%!important;box-shadow:inset 0 4px 4px #fff4,inset 0 -5px 8px #0008,0 4px 5px #0009!important;border:2px solid #3b2a20!important}.forced-checkers-board i.white{background:radial-gradient(circle at 36% 28%,#fff,#f7f5ee 50%,#c9c5b9 72%,#9f9a8f)!important;border-color:#aaa69d!important}.forced-checkers-board i.black{background:radial-gradient(circle at 34% 26%,#5a3d2e,#24140e 53%,#0b0807 78%)!important;border-color:#140b08!important}
    .forced-gomoku-board{width:min(385px,90%)!important;aspect-ratio:1.08!important;position:relative!important;background-color:#24999d!important;background-image:linear-gradient(rgba(168,247,245,.75) 1px,transparent 1px),linear-gradient(90deg,rgba(168,247,245,.75) 1px,transparent 1px),linear-gradient(135deg,#2baeb0,#237f88)!important;background-size:28px 28px,28px 28px,100% 100%!important;border:3px solid #7ff2ed!important;border-radius:5px!important;box-shadow:0 26px 38px #0009,0 0 30px #28d8d84c,inset 0 0 30px #004b5680!important;overflow:hidden!important;transform:rotateX(4deg)!important;transform-origin:center bottom!important}
    .forced-gomoku-board i{display:block!important;position:absolute!important;width:25px!important;height:25px!important;border-radius:50%!important;transform:translate(-50%,-50%)!important;box-shadow:inset 0 3px 4px #fff5,inset 0 -4px 7px #0008,0 4px 6px #0009!important}.forced-gomoku-board i.white{background:radial-gradient(circle at 34% 28%,#fff,#f6f8f8 55%,#bfc7c8)!important;border:1px solid #d9dddd!important}.forced-gomoku-board i.black{background:radial-gradient(circle at 34% 26%,#5b646a,#171b1f 58%,#030405)!important;border:1px solid #000!important}
    .game-info-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:9px 14px 0}.game-info-strip span{display:grid;gap:2px;padding:8px 10px;border:1px solid #1d3946;border-radius:8px;background:#08151c;color:#8298a4;font-size:8px}.game-info-strip b{color:#edf4f7;font-size:10px}.games-zone .game-card-foot{grid-template-columns:120px 1fr;align-items:center;padding:8px 14px 14px}.games-zone .game-card-foot strong{font-size:18px}.games-zone .play-btn{min-height:43px;display:grid;place-items:center;border-radius:7px;background:linear-gradient(180deg,#1fe37a,#0daf54);box-shadow:0 0 18px #12d56b3d;color:#03150a;font-weight:900;letter-spacing:.05em}.games-zone .play-btn.purple{background:linear-gradient(180deg,#2e99e9,#1764ad);box-shadow:0 0 18px #238fe044;color:#fff}
    .games-zone-foot{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.games-zone-foot article{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #1c3542;border-radius:9px;background:#08151d;cursor:pointer}.games-zone-foot strong{font-size:20px}.games-zone-foot b{display:block;font-size:10px}.games-zone-foot span{color:#7e939e;font-size:8px}.game-hidden{display:none!important}
    .home-extra-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:0 34px 18px;border:1px solid #1b3542;border-radius:10px;background:#08151d;overflow:hidden}.home-extra-stats article{display:flex;align-items:center;justify-content:center;gap:13px;padding:14px 10px;border-right:1px solid #1a3340}.home-extra-stats article:last-child{border-right:0}.home-extra-stats em{font-style:normal;font-size:24px}.home-extra-stats b{display:block;font-size:18px}.home-extra-stats span{display:block;color:#80939e;font-size:8px}
    @media(max-width:1100px){.games-zone .game-preview{height:335px!important}.forced-checkers-board{width:min(325px,90%)!important}.forced-gomoku-board{width:min(335px,90%)!important}}
    @media(max-width:900px){.games-zone{margin-left:12px;margin-right:12px;padding:14px}.games-zone-head{align-items:flex-start;flex-direction:column}.games-zone .game-showcase{grid-template-columns:1fr}.games-zone .game-preview{height:340px!important}.game-info-strip{grid-template-columns:1fr 1fr}.games-zone-foot,.home-extra-stats{grid-template-columns:1fr 1fr}.home-extra-stats{margin-left:12px;margin-right:12px}}
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
    [['black',44,31],['white',52,31],['black',44,39],['black',52,39],['white',60,39],['white',36,47],['black',44,47],['white',52,47],['black',60,47],['black',68,47],['black',36,55],['white',44,55],['black',52,55],['white',60,55],['black',52,63]].forEach(([kind,x,y])=>{const p=document.createElement('i');p.className=kind;p.style.left=x+'%';p.style.top=y+'%';board.appendChild(p)});
    return board;
  }
  function forceBoard(preview,kind){
    if(!preview)return;
    let wrap=preview.querySelector(':scope > .forced-board-wrap');
    if(!wrap){wrap=document.createElement('div');wrap.className='forced-board-wrap';preview.appendChild(wrap)}
    const expected=kind==='gomoku'?'.forced-gomoku-board':'.forced-checkers-board';
    if(!wrap.querySelector(expected))wrap.replaceChildren(kind==='gomoku'?createGomokuBoard():createCheckersBoard());
  }
  function decorateCard(card,kind){
    if(!card)return;
    const top=card.querySelector('.card-top');
    if(top&&!top.querySelector('.game-title-row')){
      const old=top.querySelector(':scope > div');
      if(old){
        const h=old.querySelector('h2'),p=old.querySelector('p'),row=document.createElement('div'),symbol=document.createElement('span'),txt=document.createElement('div'),status=document.createElement('div');
        row.className='game-title-row';symbol.className='game-symbol';symbol.textContent=kind==='gomoku'?'◉':'⛀';
        if(h)txt.appendChild(h);if(p)txt.appendChild(p);
        status.className='game-status';status.innerHTML=kind==='gomoku'?'<span>Twój zasady</span><span>5 w linii</span>':'<span>Multiplayer</span><span>Ranking</span><span>Turnieje</span>';
        txt.appendChild(status);row.append(symbol,txt);old.replaceWith(row);
      }
    }
    if(!card.querySelector('.game-badge')){const badge=document.createElement('span');badge.className='game-badge';badge.textContent=kind==='gomoku'?'BETA':'NAJPOPULARNIEJSZA';card.appendChild(badge)}
  }
  function decorate(){
    const showcase=document.querySelector('.game-showcase');if(!showcase)return;
    let zone=showcase.closest('.games-zone');
    if(!zone){
      zone=document.createElement('section');zone.className='games-zone';
      const head=document.createElement('header');head.className='games-zone-head';head.innerHTML='<div><span class="eyebrow">CENTRUM GIER</span><h2>Wybierz grę i rozpocznij rozgrywkę</h2><p>Jedno miejsce dla stołów, rankingów, turniejów i społeczności graczy.</p></div><div class="games-zone-filters"><button class="active" data-filter="all">2 gry</button><button data-filter="checkers">Warcaby</button><button data-filter="gomoku">Gomoku</button><button data-ranking>ELO ranking</button></div>';
      showcase.parentNode.insertBefore(zone,showcase);zone.append(head,showcase);
      const foot=document.createElement('div');foot.className='games-zone-foot';foot.innerHTML='<article data-fast><strong>⚡</strong><div><b>Szybki start</b><span>Wejdź do lobby i zagraj od razu.</span></div></article><article data-rank><strong>🏆</strong><div><b>Rywalizacja</b><span>Graj rankingowo i awansuj w tabeli.</span></div></article><article data-friends><strong>👥</strong><div><b>Gra ze znajomymi</b><span>Twórz stoły prywatne i zapraszaj znajomych.</span></div></article>';zone.appendChild(foot);
      const check=showcase.querySelector('.checkers-card'),gom=showcase.querySelector('.gomoku');
      head.querySelectorAll('[data-filter]').forEach(btn=>btn.onclick=()=>{head.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===btn));check?.classList.toggle('game-hidden',btn.dataset.filter==='gomoku');gom?.classList.toggle('game-hidden',btn.dataset.filter==='checkers')});
      head.querySelector('[data-ranking]').onclick=()=>location.href='/ranking.html';foot.querySelector('[data-fast]').onclick=()=>location.href='/players.html';foot.querySelector('[data-rank]').onclick=()=>location.href='/ranking.html';foot.querySelector('[data-friends]').onclick=()=>location.href='/community.html';
    }
    const checkCard=showcase.querySelector('.checkers-card'),gomCard=showcase.querySelector('.gomoku');
    decorateCard(checkCard,'checkers');decorateCard(gomCard,'gomoku');
    const checkPreview=checkCard?.querySelector('.game-preview'),gomPreview=gomCard?.querySelector('.game-preview');forceBoard(checkPreview,'checkers');forceBoard(gomPreview,'gomoku');
    if(checkCard&&!checkCard.querySelector('.game-info-strip')){const info=document.createElement('div');info.className='game-info-strip';info.innerHTML='<span><b>2 graczy</b>Najczęściej</span><span><b>3–30 min</b>Czas gry</span><span><b>ELO ranking</b>Rankingowa</span><span><b>Turnieje</b>Dostępne</span>';checkPreview.after(info)}
    if(gomCard&&!gomCard.querySelector('.game-info-strip')){const info=document.createElement('div');info.className='game-info-strip';info.innerHTML='<span><b>2 graczy</b>Pojedynek</span><span><b>5 w linii</b>Cel gry</span><span><b>3–15 min</b>Typowo</span><span><b>Ranking</b>Opcjonalny</span>';gomPreview.after(info)}
    const gomPlay=gomCard?.querySelector('.play-btn');if(gomPlay){gomPlay.disabled=false;gomPlay.removeAttribute('disabled');gomPlay.textContent='▶  GRAJ W GOMOKU';gomPlay.onclick=()=>location.href='/players.html?game=gomoku'}
    const checkPlay=checkCard?.querySelector('.play-btn');if(checkPlay)checkPlay.textContent='▶  GRAJ W WARCABY';
    if(!document.querySelector('.home-extra-stats')){
      const live=document.querySelector('.live-stats');if(live)live.style.display='none';
      const stats=document.createElement('section');stats.className='home-extra-stats';stats.innerHTML='<article><em>👥</em><div><b>1283</b><span>graczy online</span></div></article><article><em>🎮</em><div><b>2567</b><span>aktywnych gier</span></div></article><article><em>🏆</em><div><b>15024</b><span>rozegranych gier</span></div></article><article><em>🎯</em><div><b>96%</b><span>pozytywnych ocen</span></div></article>';
      zone.after(stats);
    }
  }
  const run=()=>decorate();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('load',run);
  new MutationObserver(run).observe(document.documentElement,{subtree:true,childList:true});
  setInterval(run,750);
})();