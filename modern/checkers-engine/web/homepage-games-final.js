(() => {
  const css = document.createElement('style');
  css.textContent = `
    .homepage-board-only{height:100%;display:grid!important;place-items:center!important;padding:14px!important;background:radial-gradient(circle at 50% 45%,#13232b 0,#091219 72%)!important;overflow:hidden!important}
    .homepage-checkers-board{width:min(100%,310px)!important;aspect-ratio:1!important;display:grid!important;grid-template-columns:repeat(8,1fr)!important;grid-template-rows:repeat(8,1fr)!important;border:2px solid #9a7046!important;border-radius:5px!important;box-shadow:0 14px 35px #0008,inset 0 0 0 1px #f3d7ab!important}
    .homepage-checkers-board>span{position:relative;display:grid;place-items:center}.homepage-checkers-board>span.light{background:#efd19b}.homepage-checkers-board>span.dark{background:#76583d}
    .homepage-checkers-board i{width:68%;aspect-ratio:1;border-radius:50%;box-shadow:inset 0 2px 3px #fff7,0 2px 3px #0006;border:1px solid #777}.homepage-checkers-board i.white{background:radial-gradient(circle at 35% 28%,#fff,#ece9df 60%,#bbb)}.homepage-checkers-board i.black{background:radial-gradient(circle at 35% 28%,#454545,#171717 65%,#050505);border-color:#111}
    .homepage-gomoku-board{width:min(100%,310px)!important;aspect-ratio:1!important;position:relative!important;background-color:#2f9fa1!important;background-image:linear-gradient(#bde9e9 1px,transparent 1px),linear-gradient(90deg,#bde9e9 1px,transparent 1px),linear-gradient(135deg,#2ba0a4,#237f86)!important;background-size:24px 24px,24px 24px,100% 100%!important;border:2px solid #82e5e8!important;border-radius:5px!important;box-shadow:0 14px 35px #0008,0 0 24px #2fbec944!important}
    .homepage-gomoku-board i{position:absolute;width:19px;height:19px;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 2px 4px #0008}.homepage-gomoku-board i.white{background:radial-gradient(circle at 35% 28%,#fff,#e9eeee 62%,#aeb8b8);border:1px solid #c9d0d0}.homepage-gomoku-board i.black{background:radial-gradient(circle at 35% 28%,#414a50,#101418 64%,#020304);border:1px solid #000}
    .games-zone .game-preview{height:330px!important;display:block!important;margin:0 14px!important;overflow:hidden!important;background:#091219!important}
    .games-zone .game-preview .module-side,.games-zone .game-preview .console-panel,.games-zone .game-preview [class*="side"],.games-zone .game-preview [class*="console"]:not(.homepage-board-only){display:none!important}
  `;
  document.head.appendChild(css);

  function checkers(){
    const board=document.createElement('div');board.className='homepage-checkers-board';
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const sq=document.createElement('span');const dark=(r+c)%2===1;sq.className=dark?'dark':'light';
      if(dark&&(r<3||r>4)){const p=document.createElement('i');p.className=r<3?'black':'white';sq.appendChild(p)}
      board.appendChild(sq);
    }
    return board;
  }
  function gomoku(){
    const board=document.createElement('div');board.className='homepage-gomoku-board';
    const stones=[['black',44,34],['white',52,34],['black',44,42],['black',52,42],['white',60,42],['white',36,50],['black',44,50],['white',52,50],['black',60,50],['black',68,50],['black',36,58],['white',44,58],['black',52,58],['white',60,58],['black',52,66]];
    stones.forEach(([kind,x,y])=>{const s=document.createElement('i');s.className=kind;s.style.left=x+'%';s.style.top=y+'%';board.appendChild(s)});
    return board;
  }
  function replacePreview(selector, boardFactory){
    const preview=document.querySelector(selector);if(!preview)return;
    if(preview.dataset.finalBoard==='1')return;
    const wrap=document.createElement('div');wrap.className='homepage-board-only';wrap.appendChild(boardFactory());
    preview.replaceChildren(wrap);preview.dataset.finalBoard='1';
  }
  function dedupeNav(){
    const seen=new Set();document.querySelectorAll('.main-nav a').forEach(a=>{const key=(a.textContent||'').trim().toUpperCase();if(key==='CHAT OGÓLNY'){if(seen.has(key))a.remove();else seen.add(key)}});
  }
  function apply(){
    replacePreview('.checkers-card .game-preview',checkers);
    replacePreview('.game-card.gomoku .game-preview',gomoku);
    dedupeNav();
  }
  apply();
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('load',()=>{apply();setTimeout(apply,200);setTimeout(apply,900)});
  setTimeout(apply,400);
})();