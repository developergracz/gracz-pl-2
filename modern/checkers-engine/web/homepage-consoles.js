(() => {
  const style = document.createElement('style');
  style.id = 'homepage-approved-games-style';
  style.textContent = `
    #games.game-showcase{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:8px 34px 10px;padding:94px 14px 14px;border:1px solid #173847;border-radius:16px;background:linear-gradient(180deg,#071722 0%,#06131d 100%);box-shadow:0 20px 55px #0008,inset 0 1px 0 #153b4c}
    #games.game-showcase:before{content:'CENTRUM GIER\A Wybierz grę i rozpocznij rozgrywkę';white-space:pre;position:absolute;left:22px;top:17px;color:#f2f7fa;font-size:24px;font-weight:900;line-height:1.35;letter-spacing:-.7px}
    #games.game-showcase:after{content:'Jedno miejsce dla stołów, rankingów, turniejów i społeczności graczy.';position:absolute;left:22px;top:64px;color:#91a2ac;font-size:11px}
    .home-games-controls{position:absolute;right:18px;top:48px;display:flex;gap:8px;z-index:5}.home-games-controls button{height:32px;padding:0 13px;border:1px solid #244552;border-radius:9px;background:#08151d;color:#d8e2e7;font:700 10px/1 inherit;cursor:pointer}.home-games-controls button.online{border-color:#0f6a52;background:#073226;color:#27e58b}.home-games-controls button:hover{filter:brightness(1.16)}
    #games .game-card{position:relative;border:1px solid #1b4552;border-radius:13px;background:linear-gradient(180deg,#071923,#06131b);box-shadow:0 18px 45px #0006;overflow:hidden}
    #games .checkers-card{box-shadow:inset 0 1px 0 #14db73,0 18px 45px #0006}
    #games .gomoku{box-shadow:inset 0 1px 0 #217fd1,0 18px 45px #0006}
    #games .card-top{padding:18px 18px 11px;min-height:82px}
    #games .card-top h2{font-size:21px!important;margin:0 0 3px;letter-spacing:-.25px;color:#f2f6f8}#games .card-top h2 span{color:#1fe184}
    #games .card-top p{font-size:11px;color:#d0d8dc;margin:0}
    #games .checkers-card .card-top:after{content:'● Multiplayer   ◈ Ranking   ◈ Turnieje';display:inline-block;margin-top:7px;padding:3px 7px;border:1px solid #17644b;border-radius:999px;background:#07261e;color:#88e8ba;font-size:8px}
    #games .gomoku .card-top:after{content:'● Twoje zasady   ◆ 5 w linii';display:inline-block;margin-top:7px;padding:3px 7px;border:1px solid #1a5879;border-radius:999px;background:#072132;color:#8fc8ef;font-size:8px}
    #games .checkers-card:before{content:'NAJPOPULARNIEJSZA';position:absolute;top:16px;right:16px;z-index:4;padding:6px 10px;border:1px solid #1d7748;border-radius:8px;background:linear-gradient(#11522f,#0a311e);box-shadow:0 0 16px #19dd7245;color:#8df3b9;font-size:8px;font-weight:900}
    #games .gomoku:before{content:'BETA';position:absolute;top:16px;right:16px;z-index:4;padding:6px 12px;border:1px solid #1d70b5;border-radius:8px;background:linear-gradient(#1a5f9c,#0d3862);box-shadow:0 0 16px #258fe850;color:white;font-size:9px;font-weight:900}
    #games .game-preview{height:355px!important;margin:0 14px!important;border:0!important;border-radius:6px!important;overflow:hidden!important;background:radial-gradient(circle at 50% 42%,#0e2a32,#06131a 72%)!important;display:grid;place-items:center;padding:6px}
    #games .mini-board{height:auto!important;width:min(365px,90%)!important;aspect-ratio:1!important;margin:auto!important;display:grid!important;grid-template-columns:repeat(8,1fr)!important;grid-template-rows:repeat(8,1fr)!important;background:none!important;border:7px solid #a45d26!important;border-radius:5px!important;box-shadow:0 26px 34px #000a,0 0 0 2px #4f2a14!important;overflow:hidden!important;filter:none!important;transform:perspective(850px) rotateX(4deg)}
    #games .mini-square{display:grid!important;place-items:center!important}.mini-square.light{background:linear-gradient(135deg,#efc379,#f5d59b 50%,#d6a45b)!important}.mini-square.dark{background:linear-gradient(135deg,#6d3b14,#935726 50%,#5b2f11)!important}
    #games .mini-piece{display:block!important;width:72%!important;aspect-ratio:1!important;border-radius:50%!important;box-shadow:inset 0 4px 4px #fff4,inset 0 -5px 8px #0008,0 4px 5px #0009!important;border:2px solid #3b2a20!important}.mini-piece.white{background:radial-gradient(circle at 36% 28%,#fff,#f7f5ee 50%,#c9c5b9 72%,#9f9a8f)!important;border-color:#aaa69d!important}.mini-piece.black{background:radial-gradient(circle at 34% 26%,#5a3d2e,#24140e 53%,#0b0807 78%)!important;border-color:#140b08!important}
    #games .gomoku-board{width:min(405px,92%)!important;height:auto!important;aspect-ratio:1.15!important;background-color:#24a4a7!important;background-image:linear-gradient(rgba(174,255,252,.72) 1px,transparent 1px),linear-gradient(90deg,rgba(174,255,252,.72) 1px,transparent 1px),radial-gradient(circle at 44% 31%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 52% 31%,#fff 0 11px,transparent 12px),radial-gradient(circle at 44% 39%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 52% 39%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 60% 39%,#fff 0 11px,transparent 12px),radial-gradient(circle at 36% 47%,#fff 0 11px,transparent 12px),radial-gradient(circle at 44% 47%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 52% 47%,#fff 0 11px,transparent 12px),radial-gradient(circle at 60% 47%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 68% 47%,#15191c 0 11px,transparent 12px),linear-gradient(135deg,#25b0b2,#23818a)!important;background-size:28px 28px,28px 28px,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%!important;border:3px solid #78f1ec!important;border-radius:4px!important;box-shadow:0 26px 38px #0009,0 0 28px #28d8d850,inset 0 0 30px #004b5680!important;transform:perspective(850px) rotateX(3deg)}
    #games .game-card-foot{grid-template-columns:120px 1fr!important;align-items:center;padding:10px 14px 13px!important}.game-card-foot>div strong{font-size:18px}.game-card-foot>div span{font-size:9px;color:#9babb3}
    #games .play-btn{min-height:44px;display:grid;place-items:center;border-radius:6px;background:linear-gradient(180deg,#20de78,#09ac50)!important;box-shadow:0 0 18px #11d66c30;color:#fff!important;font-size:14px;font-weight:900;letter-spacing:.08em;text-decoration:none}.play-btn:before{content:'▶';margin-right:9px}.play-btn.purple{background:linear-gradient(180deg,#258edf,#135da7)!important;color:#fff!important}
    .home-game-subactions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 34px 10px}.home-game-subactions a{display:flex;align-items:center;gap:14px;min-height:58px;padding:0 20px;border:1px solid #173847;border-radius:9px;background:#07151e;color:#edf5f8;text-decoration:none}.home-game-subactions i{font-style:normal;font-size:27px}.home-game-subactions b{display:block;font-size:13px}.home-game-subactions span{display:block;margin-top:3px;color:#a0afb7;font-size:9px}
    .home-game-stats{display:grid;grid-template-columns:repeat(4,1fr);margin:0 34px 18px;border:1px solid #173847;border-radius:10px;background:#07151e;overflow:hidden}.home-game-stats article{display:flex;align-items:center;justify-content:center;gap:14px;min-height:72px;border-right:1px solid #1b3542}.home-game-stats article:last-child{border-right:0}.home-game-stats i{font-style:normal;font-size:31px}.home-game-stats b{display:block;color:#fff;font-size:20px}.home-game-stats span{display:block;color:#a2b0b7;font-size:10px}
    @media(max-width:1000px){#games.game-showcase{grid-template-columns:1fr;padding-top:112px}.home-games-controls{top:76px;left:20px;right:auto}.home-game-subactions,.home-game-stats{grid-template-columns:1fr 1fr}#games .game-preview{height:340px!important}}
    @media(max-width:650px){#games.game-showcase{margin-left:10px;margin-right:10px;padding-left:8px;padding-right:8px}.home-game-subactions,.home-game-stats{grid-template-columns:1fr;margin-left:10px;margin-right:10px}.home-game-stats article{border-right:0;border-bottom:1px solid #1b3542}.home-game-stats article:last-child{border-bottom:0}}
  `;
  document.head.appendChild(style);

  const games = document.querySelector('#games');
  if (!games) return;

  const controls = document.createElement('div');
  controls.className = 'home-games-controls';
  controls.innerHTML = '<button type="button">2 gry</button><button type="button" class="online">online multiplayer</button><button type="button">ELO ranking</button>';
  games.appendChild(controls);
  controls.children[0].onclick = () => document.querySelector('#games')?.scrollIntoView({behavior:'smooth'});
  controls.children[1].onclick = () => location.href = '/players.html';
  controls.children[2].onclick = () => location.href = '/ranking.html';

  const gomokuButton = games.querySelector('.gomoku .play-btn');
  if (gomokuButton) {
    gomokuButton.disabled = false;
    gomokuButton.removeAttribute('disabled');
    gomokuButton.onclick = () => { location.href = '/players.html?game=gomoku'; };
  }

  if (!document.querySelector('.home-game-subactions')) {
    const actions = document.createElement('section');
    actions.className = 'home-game-subactions';
    actions.innerHTML = '<a href="/players.html"><i>⚡</i><div><b>Szybki start</b><span>Wejdź do lobby i zagraj od razu.</span></div></a><a href="/ranking.html"><i>🏆</i><div><b>Rywalizacja</b><span>Graj rankingowo i awansuj w tabeli.</span></div></a><a href="/community.html"><i>👥</i><div><b>Gra ze znajomymi</b><span>Twórz stoły prywatne i zapraszaj znajomych.</span></div></a>';
    games.insertAdjacentElement('afterend', actions);
  }

  const oldStats = document.querySelector('.live-stats');
  if (oldStats) oldStats.style.display = 'none';
  if (!document.querySelector('.home-game-stats')) {
    const stats = document.createElement('section');
    stats.className = 'home-game-stats';
    stats.innerHTML = '<article><i>👥</i><div><b>1283</b><span>graczy online</span></div></article><article><i>🎮</i><div><b>2567</b><span>aktywnych gier</span></div></article><article><i>🏆</i><div><b>15024</b><span>rozegranych gier</span></div></article><article><i>🎯</i><div><b>96%</b><span>pozytywnych ocen</span></div></article>';
    const actions = document.querySelector('.home-game-subactions');
    actions?.insertAdjacentElement('afterend', stats);
  }
})();