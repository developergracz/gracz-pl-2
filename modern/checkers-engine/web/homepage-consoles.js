(() => {
  const style = document.createElement('style');
  style.textContent = `
    #games.game-showcase{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:8px 34px 18px;padding:78px 22px 18px;border:1px solid #183647;border-radius:16px;background:linear-gradient(180deg,#091722,#07111a);box-shadow:0 20px 55px #0007,inset 0 1px 0 #143749}
    #games.game-showcase:before{content:'CENTRUM GIER\A Wybierz grę i rozpocznij rozgrywkę';white-space:pre;position:absolute;left:22px;top:18px;color:#eef7fb;font-size:24px;font-weight:900;line-height:1.25;letter-spacing:-.6px}
    #games.game-showcase:after{content:'Jedno miejsce dla stołów, rankingów, turniejów i społeczności graczy.';position:absolute;left:22px;top:55px;color:#8298a5;font-size:11px}
    #games .game-card{position:relative;border:1px solid #1d4050;border-radius:14px;background:linear-gradient(180deg,#0b1a23,#071219);box-shadow:0 18px 45px #0005;overflow:hidden}
    #games .checkers-card{box-shadow:inset 0 2px 0 #1ee078,0 18px 45px #0005}
    #games .gomoku{box-shadow:inset 0 2px 0 #258dde,0 18px 45px #0005}
    #games .card-top{padding:18px 18px 12px;min-height:82px}
    #games .card-top h2{font-size:21px!important;margin-bottom:5px}
    #games .card-top p{font-size:11px;color:#8ca0ad}
    #games .checkers-card .card-top:after{content:'Multiplayer   Ranking   Turnieje';display:inline-block;margin-top:8px;padding:4px 8px;border:1px solid #1d5b45;border-radius:999px;background:#0a2b20;color:#7bd9aa;font-size:8px}
    #games .gomoku .card-top:after{content:'Twoje zasady   5 w linii';display:inline-block;margin-top:8px;padding:4px 8px;border:1px solid #20577a;border-radius:999px;background:#0a2436;color:#79bce8;font-size:8px}
    #games .checkers-card:before{content:'NAJPOPULARNIEJSZA';position:absolute;top:16px;right:58px;z-index:4;padding:6px 10px;border:1px solid #1d6e46;border-radius:8px;background:linear-gradient(#10472e,#0b2d1f);color:#7af0ad;font-size:8px;font-weight:900}
    #games .gomoku:before{content:'BETA';position:absolute;top:16px;right:16px;z-index:4;padding:6px 10px;border:1px solid #1e69a7;border-radius:8px;background:linear-gradient(#154d7b,#0d2f4e);color:#86c8ff;font-size:8px;font-weight:900}
    #games .game-preview{height:385px!important;margin:0 14px!important;border:1px solid #203b48!important;border-radius:9px!important;overflow:hidden!important;background:radial-gradient(circle at 50% 40%,#0f2731,#07131a 74%)!important;display:grid;place-items:center;padding:10px}
    #games .mini-board{height:auto!important;width:min(365px,88%)!important;aspect-ratio:1!important;margin:auto!important;display:grid!important;grid-template-columns:repeat(8,1fr)!important;grid-template-rows:repeat(8,1fr)!important;background:none!important;border:7px solid #9b5526!important;border-radius:7px!important;box-shadow:0 24px 34px #0009,0 0 0 2px #4d2a17!important;overflow:hidden!important;filter:none!important}
    #games .mini-square{display:grid!important;place-items:center!important}
    #games .mini-square.light{background:linear-gradient(135deg,#e8bc79,#f1d49a 52%,#d5a65f)!important}
    #games .mini-square.dark{background:linear-gradient(135deg,#704019,#925b2a 52%,#5b3114)!important}
    #games .mini-piece{display:block!important;width:72%!important;aspect-ratio:1!important;border-radius:50%!important;box-shadow:inset 0 4px 4px #fff4,inset 0 -5px 8px #0008,0 4px 5px #0009!important;border:2px solid #3b2a20!important}
    #games .mini-piece.white{background:radial-gradient(circle at 36% 28%,#fff,#f7f5ee 50%,#c9c5b9 72%,#9f9a8f)!important;border-color:#aaa69d!important}
    #games .mini-piece.black{background:radial-gradient(circle at 34% 26%,#5a3d2e,#24140e 53%,#0b0807 78%)!important;border-color:#140b08!important}
    #games .gomoku-board{width:min(385px,90%)!important;height:auto!important;aspect-ratio:1.08!important;background-color:#24999d!important;background-image:linear-gradient(rgba(168,247,245,.75) 1px,transparent 1px),linear-gradient(90deg,rgba(168,247,245,.75) 1px,transparent 1px),radial-gradient(circle at 44% 31%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 52% 31%,#fff 0 11px,transparent 12px),radial-gradient(circle at 44% 39%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 52% 39%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 60% 39%,#fff 0 11px,transparent 12px),radial-gradient(circle at 36% 47%,#fff 0 11px,transparent 12px),radial-gradient(circle at 44% 47%,#15191c 0 11px,transparent 12px),radial-gradient(circle at 52% 47%,#fff 0 11px,transparent 12px),radial-gradient(circle at 60% 47%,#15191c 0 11px,transparent 12px),linear-gradient(135deg,#2baeb0,#237f88)!important;background-size:28px 28px,28px 28px,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%,100% 100%!important;border:3px solid #7ff2ed!important;border-radius:5px!important;box-shadow:0 26px 38px #0009,0 0 30px #28d8d84c,inset 0 0 30px #004b5680!important}
    #games .game-card-foot{grid-template-columns:120px 1fr!important;align-items:center;padding:12px 14px 14px!important}
    #games .play-btn{min-height:44px;display:grid;place-items:center;border-radius:7px;background:linear-gradient(180deg,#1fe37a,#0daf54)!important;color:#03150a!important;font-weight:900;letter-spacing:.04em}
    #games .play-btn.purple{background:linear-gradient(180deg,#2e99e9,#1764ad)!important;color:#fff!important}
    @media(max-width:900px){#games.game-showcase{grid-template-columns:1fr;margin-left:12px;margin-right:12px;padding-left:14px;padding-right:14px}#games .game-preview{height:340px!important}}
  `;
  document.head.appendChild(style);
  const gomokuButton = document.querySelector('#games .gomoku .play-btn');
  if (gomokuButton) {
    gomokuButton.disabled = false;
    gomokuButton.removeAttribute('disabled');
    gomokuButton.addEventListener('click', () => { location.href = '/players.html?game=gomoku'; }, { once:false });
  }
})();