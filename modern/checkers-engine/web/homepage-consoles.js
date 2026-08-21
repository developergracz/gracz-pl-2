(() => {
  const style = document.createElement('style');
  style.textContent = `
  .classic-home-console{height:100%;display:grid;grid-template-columns:minmax(0,1.32fr) minmax(145px,.68fr);background:#d39a54;color:#51483f;overflow:hidden;font:11px Arial,sans-serif}
  .classic-home-console.gomoku-console-home{background:#6fa7a2}
  .classic-home-boardwrap{display:flex;min-width:0;min-height:0;background:#d59c55;padding:8px}
  .gomoku-console-home .classic-home-boardwrap{background:#6da7a2}
  .classic-checker-board{width:100%;height:100%;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border:2px solid #8d633d;box-shadow:inset 0 0 0 1px #f3d7ab}
  .classic-square{position:relative;display:grid;place-items:center}.classic-square.light{background:#efd19b}.classic-square.dark{background:#76583d}
  .classic-piece{width:68%;aspect-ratio:1;border-radius:50%;box-shadow:inset 0 2px 3px #fff7,0 2px 3px #0006;border:1px solid #777}.classic-piece.white{background:radial-gradient(circle at 35% 28%,#fff,#ece9df 60%,#bbb)}.classic-piece.black{background:radial-gradient(circle at 35% 28%,#454545,#171717 65%,#050505);border-color:#111}
  .classic-gomoku-board{width:100%;height:100%;position:relative;background-color:#69a9a5;background-image:linear-gradient(#d8eeee 1px,transparent 1px),linear-gradient(90deg,#d8eeee 1px,transparent 1px);background-size:22px 22px;border:2px solid #4d817d}
  .classic-stone{position:absolute;width:18px;height:18px;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 1px 2px #0006}.classic-stone.white{background:#f4f4ef;border:1px solid #c9c9c2}.classic-stone.black{background:#121212;border:1px solid #000}
  .classic-home-side{display:flex;flex-direction:column;min-width:0;background:#f3ead9;border-left:2px solid #c5965b}.gomoku-console-home .classic-home-side{background:#dfece7;border-left-color:#518a84}
  .classic-table{padding:8px 9px 5px;font-weight:bold;font-size:12px}.classic-seats{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:0 8px 6px}.classic-seats button{padding:6px 2px;border:1px solid #aaa;border-radius:2px;background:linear-gradient(#fff,#ddd);font-size:10px;font-weight:bold;box-shadow:0 2px 3px #0002}
  .classic-main-actions{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #d3bc98;border-bottom:1px solid #d3bc98}.classic-main-actions button{border:0;background:#eadcc5;padding:5px 2px;font-size:10px}.classic-main-actions button:last-child{font-weight:bold;color:#6d5d4c}
  .gomoku-console-home .classic-main-actions{border-color:#a8c9c5}.gomoku-console-home .classic-main-actions button{background:#cfe2df}
  .classic-small-actions{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #ccb995}.classic-small-actions button{padding:4px 1px;border:0;border-right:1px solid #d9c8a8;background:#e9dcc8;color:#887966;font-size:7px}
  .gomoku-console-home .classic-small-actions{border-color:#a7c7c3}.gomoku-console-home .classic-small-actions button{background:#cce0dd;border-color:#b0ceca}
  .classic-tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #bba77f}.classic-tabs span{text-align:center;padding:4px 1px;border-right:1px solid #ccb993;background:#dfc9a7;font-size:8px}.classic-tabs span:first-child{background:#f6ecdd;font-weight:bold}
  .gomoku-console-home .classic-tabs{border-color:#98bbb7}.gomoku-console-home .classic-tabs span{background:#bcd6d2;border-color:#a7c7c3}.gomoku-console-home .classic-tabs span:first-child{background:#e3efed}
  .classic-chat{flex:1;min-height:62px;margin:5px 7px 3px;border:1px solid #b89d70;background:#fffaf0;box-shadow:inset 0 1px 3px #0001;position:relative}.classic-chat:before{content:'Czat gry';position:absolute;top:6px;left:7px;color:#8b7a62;font-size:9px}.classic-chat:after{content:'Napisz wiadomość...';position:absolute;left:5px;right:5px;bottom:4px;padding:4px 5px;border:1px solid #c6b189;background:#fff;color:#a5967e;font-size:8px}
  .gomoku-console-home .classic-chat{border-color:#91b7b2;background:#f4fbfa}.gomoku-console-home .classic-chat:before{content:'Czat Gomoku';color:#648f8a}.gomoku-console-home .classic-chat:after{border-color:#a4c5c1}
  @media(max-width:900px){.classic-home-console{grid-template-columns:1.2fr .8fr}.classic-home-boardwrap{padding:5px}.classic-table{font-size:10px}.classic-chat{min-height:48px}}
  `;
  document.head.appendChild(style);

  function checkerBoard() {
    const board = document.createElement('div');
    board.className = 'classic-checker-board';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        const dark = (r + c) % 2 === 1;
        sq.className = `classic-square ${dark ? 'dark' : 'light'}`;
        if (dark && (r < 3 || r > 4)) {
          const p = document.createElement('i');
          p.className = `classic-piece ${r < 3 ? 'white' : 'black'}`;
          sq.appendChild(p);
        }
        board.appendChild(sq);
      }
    }
    return board;
  }

  function gomokuBoard() {
    const board = document.createElement('div');
    board.className = 'classic-gomoku-board';
    const stones = [
      ['white',20,22],['black',35,40],['white',50,18],['black',64,49],['white',78,27],
      ['black',48,62],['white',58,72],['black',29,68],['white',70,60]
    ];
    for (const [kind,x,y] of stones) {
      const s = document.createElement('i'); s.className = `classic-stone ${kind}`; s.style.left = `${x}%`; s.style.top = `${y}%`; board.appendChild(s);
    }
    return board;
  }

  function side(kind) {
    const d = document.createElement('div'); d.className = 'classic-home-side';
    d.innerHTML = `<div class="classic-table">Stół 1, norm. 3 min</div><div class="classic-seats"><button>usiądź</button><button>usiądź</button></div><div class="classic-main-actions"><button>START</button><button>ZAPROŚ</button></div><div class="classic-small-actions"><button>REZYGNUJ</button><button>REMIS</button><button>COFNIJ</button><button>ZALOGUJ</button></div><div class="classic-tabs"><span>chat</span><span>historia</span><span>użytkownicy</span><span>opcje</span></div><div class="classic-chat"></div>`;
    d.querySelectorAll('button').forEach(b => { b.type='button'; b.tabIndex=-1; });
    return d;
  }

  function install(preview, kind) {
    if (!preview) return;
    const root = document.createElement('div');
    root.className = `classic-home-console ${kind === 'gomoku' ? 'gomoku-console-home' : ''}`;
    const wrap = document.createElement('div'); wrap.className = 'classic-home-boardwrap';
    wrap.appendChild(kind === 'gomoku' ? gomokuBoard() : checkerBoard());
    root.append(wrap, side(kind)); preview.replaceChildren(root);
  }

  const run = () => {
    install(document.querySelector('.checkers-card .game-preview'), 'checkers');
    install(document.querySelector('.game-card.gomoku .game-preview'), 'gomoku');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
})();