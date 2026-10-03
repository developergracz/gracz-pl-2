(function(){
  'use strict';

  var toc=document.querySelector('.legal-toc');
  var toggle=document.querySelector('[data-toc-toggle]');
  var printButton=document.querySelector('[data-print]');
  var forumTrigger=document.querySelector('[data-forum-coming-soon]');
  var forumDialog=null;
  var forumLastTrigger=null;

  function ensureForumDialog(){
    if(forumDialog)return forumDialog;
    forumDialog=document.createElement('dialog');
    forumDialog.className='legal-forum-dialog';
    forumDialog.setAttribute('aria-labelledby','legal-forum-dialog-title');

    var box=document.createElement('div');
    box.className='legal-forum-dialog__box';

    var kicker=document.createElement('span');
    kicker.className='legal-forum-dialog__kicker';
    kicker.textContent='gracz.pl Community';

    var title=document.createElement('h2');
    title.id='legal-forum-dialog-title';
    title.textContent='Forum gracz.pl jest w trakcie budowy';

    var textNode=document.createElement('p');
    textNode.textContent='Budujemy profesjonalne forum połączone z kontem gracza, wyszukiwarką i całym ekosystemem gracz.pl. Uruchomimy je po zakończeniu prac integracyjnych.';

    var close=document.createElement('button');
    close.type='button';
    close.className='legal-forum-dialog__close';
    close.textContent='Rozumiem';
    close.addEventListener('click',function(){forumDialog.close();});

    box.appendChild(kicker);
    box.appendChild(title);
    box.appendChild(textNode);
    box.appendChild(close);
    forumDialog.appendChild(box);
    document.body.appendChild(forumDialog);

    forumDialog.addEventListener('click',function(event){
      if(event.target===forumDialog)forumDialog.close();
    });
    forumDialog.addEventListener('close',function(){
      document.body.classList.remove('legal-forum-dialog-open');
      if(forumLastTrigger&&document.contains(forumLastTrigger))forumLastTrigger.focus();
      forumLastTrigger=null;
    });
    return forumDialog;
  }
  var links=Array.prototype.slice.call(document.querySelectorAll('.legal-toc a[href^="#"]'));
  var sections=links.map(function(link){
    return document.querySelector(link.getAttribute('href'));
  }).filter(Boolean);

  if(toggle && toc){
    toggle.addEventListener('click',function(){
      var open=toc.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded',open?'true':'false');
    });
  }

  links.forEach(function(link){
    link.addEventListener('click',function(){
      if(window.matchMedia('(max-width:980px)').matches && toc){
        toc.classList.remove('is-open');
        if(toggle)toggle.setAttribute('aria-expanded','false');
      }
    });
  });

  if(forumTrigger){
    forumTrigger.addEventListener('click',function(){
      forumLastTrigger=forumTrigger;
      var dialog=ensureForumDialog();
      document.body.classList.add('legal-forum-dialog-open');
      if(typeof dialog.showModal==='function')dialog.showModal();
      else dialog.setAttribute('open','');
      var close=dialog.querySelector('.legal-forum-dialog__close');
      if(close)close.focus();
    });
  }

  if(printButton){
    printButton.addEventListener('click',function(){
      window.print();
    });
  }

  if('IntersectionObserver' in window && sections.length){
    var visible={};
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting)visible[entry.target.id]=entry.boundingClientRect.top;
        else delete visible[entry.target.id];
      });
      var ids=Object.keys(visible);
      if(!ids.length)return;
      ids.sort(function(a,b){return Math.abs(visible[a])-Math.abs(visible[b]);});
      var current='#'+ids[0];
      links.forEach(function(link){
        var active=link.getAttribute('href')===current;
        link.classList.toggle('is-current',active);
        if(active)link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    },{rootMargin:'-112px 0px -62% 0px',threshold:[0,.01,.18]});
    sections.forEach(function(section){observer.observe(section);});
  }
})();