/* Parallel, isolated local scripted examples; no real game, chat or account traffic. */
(() => {
 'use strict';
 const root=document.querySelector('.owner-mobile-demos');
 if(!root)return;
 const mobile=matchMedia('(max-width:680px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const sequences={
 szachy:[[52,36],[12,28],[62,45],[1,18],[61,34],[6,21],[57,42],[5,26]],
 warcaby:[[42,35],[19,26],[44,37],[21,28],[35,21,28],[12,30,21],[30,44,37]],
 gomoku:[[82,'white'],[158,'black'],[111,'white'],[159,'black'],[83,'white'],[142,'black'],[115,'white']]
 };
 const cards=[...root.querySelectorAll('[data-mobile-demo]')].map(card=>{
  const name=card.dataset.mobileDemo;
  const cells=[...card.querySelectorAll(name==='gomoku'?'.owner-gomoku-cell':'.owner-square')];
  const piece=name==='gomoku'?'.owner-gomoku-stone':name==='szachy'?'.owner-chess-piece':'.owner-piece';
  if(name==='gomoku')cells.forEach((cell,i)=>{
   const r=Math.floor(i/15),c=i%15;
   if(r===0)cell.classList.add('edge-top');if(r===14)cell.classList.add('edge-bottom');
   if(c===0)cell.classList.add('edge-left');if(c===14)cell.classList.add('edge-right');
   if([3,7,11].includes(r)&&[3,7,11].includes(c))cell.classList.add('star');
  });
  const initial=cells.flatMap((cell,i)=>[...cell.querySelectorAll(piece)].map(node=>({node,i})));
  return {name,cells,piece,initial,faces:[...card.querySelectorAll('.owner-clocks b')],sides:[...card.querySelectorAll('.owner-clocks > div')],caption:card.querySelector('.owner-panel-caption'),step:0,active:1,remaining:[420000,420000],next:1000};
 });
 let paused=false,timer=null,last=0;
 const button=root.querySelector('.mobile-demo-pause');button.hidden=false;
 const stopped=()=>paused||!mobile.matches||reduced.matches||document.hidden;
 function reset(c){
  c.cells.forEach(cell=>cell.querySelectorAll('[data-mobile-stone]').forEach(node=>node.remove()));
  c.initial.forEach(({node,i})=>c.cells[i].append(node));
  c.step=0;c.active=1;c.remaining=[420000,420000];c.next=1200;
 }
 function step(c){
  const sequence=sequences[c.name];
  if(c.step===sequence.length){reset(c);return;}
  const [from,to,taken]=sequence[c.step];
  if(c.name==='gomoku'){
   const cell=c.cells[from];if(!cell||cell.querySelector(c.piece))return false;
   const stone=document.createElement('i');stone.className='owner-gomoku-stone'+(to==='white'?' white':'');stone.dataset.mobileStone='1';cell.append(stone);
  }else{
   const cell=c.cells[from],target=c.cells[to],node=cell?.querySelector(c.piece);
   if(!node||!target||target.querySelector(c.piece))return false;
   if(Number.isInteger(taken)){const capture=c.cells[taken]?.querySelector(c.piece);if(!capture)return false;capture.remove();}
   const rect=node.getBoundingClientRect();target.append(node);const end=node.getBoundingClientRect();
   if(node.animate)node.animate([{transform:'translate('+(rect.x-end.x)+'px,'+(rect.y-end.y)+'px)'},{transform:'translate(0,0)'}],{duration:300,easing:'ease-in-out'});
  }
  c.step++;c.active=1-c.active;c.next=1500;return true;
 }
 function paint(c){
  c.faces.forEach((face,i)=>{const t=Math.ceil(c.remaining[i]/1000);face.textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');c.sides[i]?.classList.toggle('owner-clock-active',i===c.active&&!stopped());});
  if(c.caption)c.caption.textContent='Pokaz partii · '+c.step+'/'+sequences[c.name].length;
 }
 function tick(){
  const now=performance.now(),dt=Math.min(500,now-last);last=now;
  if(stopped())return;
  for(const c of cards){if(c.failed)continue;c.remaining[c.active]=Math.max(0,c.remaining[c.active]-dt);c.next-=dt;
   if(c.next<=0&&step(c)===false){c.failed=true;if(c.caption)c.caption.textContent='Pokaz niedostępny';continue;}paint(c);}
 }
 function schedule(){clearInterval(timer);timer=null;last=performance.now();if(!stopped())timer=setInterval(tick,200);cards.filter(c=>!c.failed).forEach(paint);}
 button.addEventListener('click',()=>{paused=!paused;button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'Wznów pokazy':'Wstrzymaj pokazy';schedule();});
 document.addEventListener('visibilitychange',schedule);mobile.addEventListener('change',schedule);reduced.addEventListener('change',schedule);
 // Reuse the exact native chess vector factory used by the existing homepage.
 import('/assets/gracz-original-chess-pieces.mjs').then(({createChessPiece})=>{root.querySelectorAll('.owner-chess-piece[data-piece]').forEach(host=>{const svg=createChessPiece(document,host.dataset.piece);if(svg)host.replaceChildren(svg);});}).catch(()=>{});
 schedule();
})();
