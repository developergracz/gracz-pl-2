(function(){
  'use strict';

  var MESSAGES={
    search:{title:'Wyszukiwarka jest w przygotowaniu',text:'Wyszukiwanie w serwisie zostanie uruchomione wraz z kolejnymi funkcjami gracz.pl.'},
    login:{title:'Logowanie nie jest jeszcze aktywne',text:'System kont użytkowników jest obecnie przygotowywany. Logowanie udostępnimy w kolejnym etapie rozwoju gracz.pl.'},
    register:{title:'Rejestracja nie jest jeszcze aktywna',text:'Możliwość zakładania kont zostanie uruchomiona po zakończeniu przygotowania systemu użytkowników gracz.pl.'},
    community:{title:'Funkcje społecznościowe są w przygotowaniu',text:'Profil gracza, turnieje i pozostałe funkcje społecznościowe zostaną uruchomione w kolejnych etapach.'},
    updates:{title:'Aktualności są w przygotowaniu',text:'Sekcję aktualności uruchomimy wraz z kolejnymi publicznymi funkcjami gracz.pl.'},
    newsletter:{title:'Newsletter jest w przygotowaniu',text:'Możliwość zapisania się na informacje o nowych funkcjach gracz.pl uruchomimy w kolejnym etapie.'},
    privacy:{title:'Polityka prywatności',text:'Polityka prywatności jest przygotowywana.'},
    terms:{title:'Regulamin',text:'Regulamin serwisu jest przygotowywany.'},
    contact:{title:'Kontakt',text:'Sekcja kontaktowa zostanie udostępniona wraz z kolejnym etapem serwisu.'}
  };

  var modal=document.getElementById('rules-modal');
  var title=modal && document.getElementById('rules-modal-title');
  var text=modal && document.getElementById('rules-modal-text');
  var lastTrigger=null;

  function openModal(key,trigger){
    if(!modal || !MESSAGES[key])return;
    lastTrigger=trigger||document.activeElement;
    title.textContent=MESSAGES[key].title;
    text.textContent=MESSAGES[key].text;
    if(typeof modal.showModal==='function')modal.showModal();
    else modal.setAttribute('open','');
    document.body.classList.add('rules-modal-open');
    var ok=modal.querySelector('.rules-modal__ok');
    if(ok)ok.focus();
  }
  function closeModal(){
    if(!modal)return;
    if(typeof modal.close==='function' && modal.open)modal.close();
    else{
      modal.removeAttribute('open');
      document.body.classList.remove('rules-modal-open');
      if(lastTrigger && document.contains(lastTrigger))lastTrigger.focus();
      lastTrigger=null;
    }
  }
  if(modal){
    modal.addEventListener('close',function(){
      document.body.classList.remove('rules-modal-open');
      if(lastTrigger && document.contains(lastTrigger))lastTrigger.focus();
      lastTrigger=null;
    });
    modal.addEventListener('cancel',function(e){e.preventDefault();closeModal();});
    modal.addEventListener('click',function(e){
      if(e.target===modal || e.target.closest('[data-rules-close]'))closeModal();
    });
  }

  document.addEventListener('click',function(e){
    var trigger=e.target.closest('[data-modal]');
    if(!trigger)return;
    e.preventDefault();
    openModal(trigger.getAttribute('data-modal'),trigger);
  });

  var newsletter=document.querySelector('[data-newsletter]');
  if(newsletter){
    newsletter.addEventListener('submit',function(e){
      e.preventDefault();
      openModal('newsletter',newsletter.querySelector('button'));
    });
  }

  var navLinks=Array.prototype.slice.call(document.querySelectorAll('.rules-toc a[href^="#"],.rules-side-nav a[href^="#"]'));
  var targets=[];
  navLinks.forEach(function(link){
    var target=document.querySelector(link.getAttribute('href'));
    if(target && targets.indexOf(target)<0)targets.push(target);
  });

  function setCurrent(id){
    navLinks.forEach(function(link){
      var current=link.getAttribute('href')==='#'+id;
      link.classList.toggle('is-current',current);
      if(current)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }

  if(targets.length && 'IntersectionObserver' in window){
    var visible={};
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting)visible[entry.target.id]=entry.boundingClientRect.top;
        else delete visible[entry.target.id];
      });
      var ids=Object.keys(visible);
      if(!ids.length)return;
      ids.sort(function(a,b){return Math.abs(visible[a])-Math.abs(visible[b]);});
      setCurrent(ids[0]);
    },{rootMargin:'-110px 0px -68% 0px',threshold:[0,.01,.15]});
    targets.forEach(function(target){observer.observe(target);});
  }

  navLinks.forEach(function(link){
    link.addEventListener('click',function(e){
      var target=document.querySelector(link.getAttribute('href'));
      if(!target)return;
      e.preventDefault();
      var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      setCurrent(target.id);
    });
  });
})();