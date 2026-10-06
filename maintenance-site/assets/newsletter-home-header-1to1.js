(() => {
  'use strict';

  const header=document.querySelector('.site-header');
  const burger=document.querySelector('.burger');
  if(!header||!burger)return;

  const mobileQuery=window.matchMedia('(max-width:1179px)');
  const items=[...document.querySelectorAll('.site-header .has-menu')];

  const toggleOf=(item)=>item.querySelector('.menu-toggle');
  const closeMenus=(except)=>items.forEach((item)=>{
    if(item===except)return;
    item.classList.remove('is-open');
    const t=toggleOf(item); if(t)t.setAttribute('aria-expanded','false');
  });
  const setMenu=(item,open)=>{
    item.classList.toggle('is-open',open);
    const t=toggleOf(item); if(t)t.setAttribute('aria-expanded',open?'true':'false');
  };
  const canHover=()=>!mobileQuery.matches && window.matchMedia('(hover:hover)').matches;

  items.forEach((item)=>{
    const toggle=toggleOf(item);
    if(toggle){
      toggle.addEventListener('click',(event)=>{
        event.preventDefault();
        event.stopPropagation();
        const open=!item.classList.contains('is-open');
        closeMenus(item);
        setMenu(item,open);
      });
    }
    item.addEventListener('mouseenter',()=>{
      if(canHover()){closeMenus(item);setMenu(item,true);}
    });
    item.addEventListener('mouseleave',()=>{
      if(canHover())setMenu(item,false);
    });
    item.addEventListener('focusout',(event)=>{
      if(!mobileQuery.matches&&!item.contains(event.relatedTarget))setMenu(item,false);
    });
  });

  function setPanel(open){
    header.classList.toggle('menu-open',open);
    burger.setAttribute('aria-expanded',open?'true':'false');
    burger.setAttribute('aria-label',open?'Zamknij menu':'Otwórz menu');
    if(!open)closeMenus();
  }
  burger.addEventListener('click',()=>setPanel(!header.classList.contains('menu-open')));
  mobileQuery.addEventListener('change',()=>setPanel(false));
  document.addEventListener('click',(event)=>{
    if(!event.target.closest('.site-header .has-menu'))closeMenus();
  });
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'){closeMenus();setPanel(false);}
  });

  document.querySelectorAll('.site-header [data-modal="search"]').forEach((el)=>{
    el.addEventListener('click',()=>window.location.assign('/szukaj/'));
  });

  document.querySelectorAll('.site-header [data-modal="community"],.site-header [data-modal="forum"],.site-header [data-modal="login"],.site-header [data-modal="register"]').forEach((el)=>{
    el.addEventListener('click',(event)=>{
      event.preventDefault();
      const kind=el.getAttribute('data-modal');
      const labels={
        community:['Społeczność gracz.pl','Funkcje społecznościowe są w przygotowaniu.'],
        forum:['Forum gracz.pl','Forum jest w trakcie budowy.'],
        login:['Logowanie','Logowanie nie jest jeszcze aktywne.'],
        register:['Rejestracja','Zakładanie kont nie jest jeszcze aktywne.']
      };
      const msg=labels[kind]||['Informacja','Funkcja jest w przygotowaniu.'];
      const dlg=document.querySelector('[data-preview-dialog]');
      const title=document.querySelector('[data-preview-dialog-title]');
      const text=document.querySelector('[data-preview-dialog-text]');
      if(dlg&&title&&text){
        title.textContent=msg[0]; text.textContent=msg[1];
        if(typeof dlg.showModal==='function')dlg.showModal(); else dlg.setAttribute('open','');
      }
    });
  });
})();