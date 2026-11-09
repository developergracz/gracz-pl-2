/* Accessible, deliberately restrained hover previews of five game consoles.
 * The preview overlaps the source image to make cursor travel continuous.
 * It is a single fixed layer outside overflow-clipped game cards. */
(()=>{
 'use strict';
 if(!window.matchMedia('(hover:hover) and (pointer:fine) and (min-width:681px)').matches)return;
 const section=document.getElementById('nasze-gry');
 if(!section)return;
 const previews=[
  {selector:'.r4-img-chess',image:'/assets/home-chess-console-preview.webp',title:'Szachy',url:'https://gracz-contact-api.onrender.com/konto/szachy/'},
  {selector:'.r4-img-checkers',image:'/assets/r4-game-checkers.webp',title:'Warcaby',url:'https://gracz-contact-api.onrender.com/konto/warcaby/'},
  {selector:'.r4-img-gomoku',image:'/assets/r4-game-gomoku.webp',title:'Gomoku',url:'https://gracz-contact-api.onrender.com/konto/gomoku/'},
  {selector:'.r4-img-thousand',image:'/assets/r4-game-thousand.webp',title:'Tysiąc'},
  {selector:'.r4-img-poker',image:'/assets/r4-game-poker.webp',title:'Poker treningowy'}
 ];
 const layer=document.createElement('div');
 layer.className='r4-game-hover-preview';
 layer.setAttribute('role','group');
 layer.setAttribute('aria-label','Podgląd konsoli gry');
 layer.id='r4-game-hover-preview';
 const anchor=document.createElement('a');
 anchor.setAttribute('aria-label','Otwórz grę');
 const image=document.createElement('img');
 image.alt='';
 image.decoding='async';
 anchor.append(image);layer.append(anchor);section.append(layer);
 let current=null,closeTimer=null;
 const clearClose=()=>{if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null}};
 function hide(){
  clearClose();layer.classList.remove('is-open');layer.setAttribute('aria-hidden','true');
  current=null;
 }
 function queueClose(){clearClose();closeTimer=setTimeout(hide,220)}
 function position(source){
  const box=source.getBoundingClientRect();
  const width=Math.min(430,window.innerWidth-32);
  const height=width*329/588+10;
  // Overlap at least part of the source; no gap to jump with the cursor.
  let left=box.left+Math.min(42,box.width*.18);
  left=Math.max(16,Math.min(left,window.innerWidth-width-16));
  let top=box.top+Math.min(20,box.height*.15);
  top=Math.max(16,Math.min(top,window.innerHeight-height-16));
  layer.style.left=Math.round(left)+'px';
  layer.style.top=Math.round(top)+'px';
 }
 function show(item,source){
  clearClose();current=source;
  const last=document.activeElement===anchor;
  if(item.url){
   anchor.href=item.url;anchor.removeAttribute('aria-disabled');
  }else{
   anchor.removeAttribute('href');anchor.setAttribute('aria-disabled','true');
  }
  anchor.setAttribute('aria-label',item.url?'Otwórz grę '+item.title:'Podgląd gry '+item.title+' — wkrótce');
  image.src=item.image;
  image.alt='Powiększony podgląd konsoli '+item.title;
  position(source);
  layer.setAttribute('aria-hidden','false');
  layer.classList.add('is-open');
  if(last)anchor.focus();
 }
 for(const item of previews){
  const source=section.querySelector(item.selector);
  if(!source)continue;
  source.tabIndex=0;
  source.setAttribute('aria-label',(source.getAttribute('aria-label')||item.title)+'. Podgląd konsoli po najechaniu lub fokusie.');
  source.setAttribute('aria-controls',layer.id);
  source.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(item,source)});
  source.addEventListener('pointerleave',queueClose);
  source.addEventListener('focus',()=>show(item,source));
  source.addEventListener('blur',()=>{if(!layer.contains(document.activeElement))queueClose()});
 }
 layer.addEventListener('pointerenter',clearClose);
 layer.addEventListener('pointerleave',queueClose);
 layer.addEventListener('focusin',clearClose);
 layer.addEventListener('focusout',()=>queueClose());
 layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hide();current?.focus()}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&current)hide()});
 window.addEventListener('scroll',()=>{if(current){position(current);if(!current.getClientRects().length)hide()}},{passive:true});
 window.addEventListener('resize',()=>{if(current)position(current)},{passive:true});
 document.addEventListener('pointerdown',e=>{if(current&&!layer.contains(e.target)&&e.target!==current)hide()});
 layer.setAttribute('aria-hidden','true');
})();
