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
  .pw-reset-link{display:block;margin:10px auto 0;border:0;background:transparent;color:#61e895;font-size:11px;cursor:pointer;text-decoration:underline}.pw-reset-overlay{position:fixed;inset:0;z-index:12000;display:none;align-items:center;justify-content:center;background:rgba(2,8,12,.86);backdrop-filter:blur(8px);padding:20px}.pw-reset-overlay.open{display:flex}.pw-reset-card{width:min(430px,95vw);padding:24px;border:1px solid #2a3a45;border-radius:15px;background:#0d171e;color:#eef5f8;box-shadow:0 30px 80px #000}.pw-reset-card h2{margin:0 0 6px;font-size:22px}.pw-reset-card p{margin:0 0 18px;color:#8fa1ac;font-size:11px;line-height:1.5}.pw-reset-card label{display:grid;gap:6px;margin:11px 0;font-size:11px;font-weight:700}.pw-reset-card input{padding:12px;border:1px solid #344651;border-radius:8px;background:#081116;color:#f4f8fa;outline:none}.pw-reset-card input:focus{border-color:#20dc72;box-shadow:0 0 0 3px #20dc7218}.pw-reset-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:18px}.pw-reset-actions button{padding:10px 15px;border-radius:8px;font-weight:800;cursor:pointer}.pw-reset-cancel{border:1px solid #354550;background:#0b1218;color:#cbd7dd}.pw-reset-submit{border:0;background:linear-gradient(#20e578,#0fb958);color:#fff}.pw-reset-status{min-height:18px;margin-top:10px;font-size:11px}.pw-reset-status.ok{color:#67eaa0}.pw-reset-status.err{color:#ff7777}
  @media(max-width:900px){.classic-home-console{grid-template-columns:1.2fr .8fr}.classic-home-boardwrap{padding:5px}.classic-table{font-size:10px}.classic-chat{min-height:48px}}
  `;
  document.head.appendChild(style);

  function checkerBoard() {
    const board = document.createElement('div'); board.className = 'classic-checker-board';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div'); const dark = (r + c) % 2 === 1; sq.className = `classic-square ${dark ? 'dark' : 'light'}`;
      if (dark && (r < 3 || r > 4)) { const p = document.createElement('i'); p.className = `classic-piece ${r < 3 ? 'white' : 'black'}`; sq.appendChild(p); }
      board.appendChild(sq);
    }
    return board;
  }
  function gomokuBoard() {
    const board = document.createElement('div'); board.className = 'classic-gomoku-board';
    const stones = [['white',20,22],['black',35,40],['white',50,18],['black',64,49],['white',78,27],['black',48,62],['white',58,72],['black',29,68],['white',70,60]];
    for (const [kind,x,y] of stones) { const s = document.createElement('i'); s.className = `classic-stone ${kind}`; s.style.left = `${x}%`; s.style.top = `${y}%`; board.appendChild(s); }
    return board;
  }
  function side(kind) {
    const d = document.createElement('div'); d.className = 'classic-home-side';
    d.innerHTML = `<div class="classic-table">Stół 1, norm. 3 min</div><div class="classic-seats"><button>usiądź</button><button>usiądź</button></div><div class="classic-main-actions"><button>START</button><button>ZAPROŚ</button></div><div class="classic-small-actions"><button>REZYGNUJ</button><button>REMIS</button><button>COFNIJ</button><button>ZALOGUJ</button></div><div class="classic-tabs"><span>chat</span><span>historia</span><span>użytkownicy</span><span>opcje</span></div><div class="classic-chat"></div>`;
    d.querySelectorAll('button').forEach(b => { b.type='button'; b.tabIndex=-1; }); return d;
  }
  function install(preview, kind) {
    if (!preview) return; const root = document.createElement('div'); root.className = `classic-home-console ${kind === 'gomoku' ? 'gomoku-console-home' : ''}`;
    const wrap = document.createElement('div'); wrap.className = 'classic-home-boardwrap'; wrap.appendChild(kind === 'gomoku' ? gomokuBoard() : checkerBoard()); root.append(wrap, side(kind)); preview.replaceChildren(root);
  }

  function installPasswordReset() {
    const form = document.querySelector('#auth-form'); if (!form || document.querySelector('.pw-reset-link')) return;
    const btn = document.createElement('button'); btn.type='button'; btn.className='pw-reset-link'; btn.textContent='Nie pamiętam hasła'; form.appendChild(btn);
    const overlay = document.createElement('div'); overlay.className='pw-reset-overlay';
    overlay.innerHTML = `<form class="pw-reset-card"><h2>Reset hasła</h2><p>Podaj login i adres e-mail zapisany na koncie. Po poprawnej weryfikacji ustawisz nowe hasło.</p><label>Login<input name="userId" minlength="3" maxlength="32" required autocomplete="username"></label><label>Adres e-mail<input name="email" type="email" maxlength="254" required autocomplete="email"></label><label>Nowe hasło<input name="newPassword" type="password" minlength="10" maxlength="128" required autocomplete="new-password"></label><label>Powtórz nowe hasło<input name="confirmPassword" type="password" minlength="10" maxlength="128" required autocomplete="new-password"></label><div class="pw-reset-actions"><button type="button" class="pw-reset-cancel">Anuluj</button><button type="submit" class="pw-reset-submit">Ustaw nowe hasło</button></div><div class="pw-reset-status"></div></form>`;
    document.body.appendChild(overlay);
    const resetForm = overlay.querySelector('form'); const status = overlay.querySelector('.pw-reset-status');
    const close = () => { overlay.classList.remove('open'); status.textContent=''; status.className='pw-reset-status'; resetForm.reset(); };
    btn.addEventListener('click',()=>overlay.classList.add('open')); overlay.querySelector('.pw-reset-cancel').addEventListener('click',close); overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    resetForm.addEventListener('submit', async e => {
      e.preventDefault(); status.className='pw-reset-status'; status.textContent='Sprawdzanie danych…';
      const data = Object.fromEntries(new FormData(resetForm).entries());
      if (data.newPassword !== data.confirmPassword) { status.textContent='Nowe hasła nie są identyczne.'; status.classList.add('err'); return; }
      if (String(data.newPassword).length < 10) { status.textContent='Nowe hasło musi mieć co najmniej 10 znaków.'; status.classList.add('err'); return; }
      try {
        const r = await fetch('/auth/reset-password',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({userId:data.userId,email:data.email,newPassword:data.newPassword})});
        const result = await r.json().catch(()=>({})); if(!r.ok) throw new Error(result.error?.message || 'Nie udało się zmienić hasła.');
        status.textContent='Hasło zostało zmienione. Zamknij okno i zaloguj się nowym hasłem.'; status.classList.add('ok');
      } catch(err) { status.textContent=err.message; status.classList.add('err'); }
    });
  }

  const run = () => { install(document.querySelector('.checkers-card .game-preview'), 'checkers'); install(document.querySelector('.game-card.gomoku .game-preview'), 'gomoku'); installPasswordReset(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
})();