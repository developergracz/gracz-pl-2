(function(){
  'use strict';

  var selector=[
    '.side-column',
    '.academy-side-column',
    '.poker-side-panel',
    '.warcaby-side-panel',
    '.gomoku-side-panel',
    '.side-column--pilot',
    '.rules-side-panel',
    '.rules-toc'
  ].join(',');

  var rails=Array.prototype.slice.call(document.querySelectorAll(selector));
  if(!rails.length)return;

  function vw(){return window.innerWidth||document.documentElement.clientWidth||0}
  function vh(){return window.innerHeight||document.documentElement.clientHeight||0}
  function pageY(){return window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

  function enabled(rail){
    var width=vw();
    if(rail.classList.contains('rules-side-panel'))return width>=1321;
    if(rail.classList.contains('rules-toc'))return width>=901;
    return width>=1181;
  }

  function documentProgress(){
    var doc=document.documentElement;
    var body=document.body;
    var full=Math.max(
      doc?doc.scrollHeight:0,
      body?body.scrollHeight:0,
      doc?doc.offsetHeight:0,
      body?body.offsetHeight:0
    );
    var maxPage=Math.max(1,full-vh());
    return clamp(pageY()/maxPage,0,1);
  }

  function syncRail(rail){
    if(!enabled(rail)){rail.scrollTop=0;return}
    var maxScroll=Math.max(0,rail.scrollHeight-rail.clientHeight);
    if(maxScroll<2){rail.scrollTop=0;return}
    rail.scrollTop=Math.round(documentProgress()*maxScroll);
  }

  var primary=null;
  for(var i=0;i<rails.length;i++){
    if(rails[i].querySelector('a[href]')){primary=rails[i];break}
  }

  var toggle=null,overlay=null,linksBox=null,lastFocus=null;

  function buildMobile(){
    if(!primary||document.getElementById('sticky-mobile-nav-toggle'))return;
    var sourceLinks=Array.prototype.slice.call(primary.querySelectorAll('a[href]'));
    var seen={},items=[];
    sourceLinks.forEach(function(a){
      var href=a.getAttribute('href');
      var label=(a.textContent||'').replace(/\s+/g,' ').trim();
      if(!href||!label)return;
      var key=href+'|'+label;
      if(seen[key])return;
      seen[key]=true;
      items.push({href:href,label:label});
    });
    if(items.length<2)return;

    toggle=document.createElement('button');
    toggle.type='button';
    toggle.id='sticky-mobile-nav-toggle';
    toggle.className='sticky-mobile-nav-toggle';
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-controls','sticky-mobile-nav-overlay');
    toggle.textContent='Menu strony';

    overlay=document.createElement('div');
    overlay.id='sticky-mobile-nav-overlay';
    overlay.className='sticky-mobile-nav-overlay';
    overlay.setAttribute('aria-hidden','true');

    var sheet=document.createElement('div');
    sheet.className='sticky-mobile-nav-sheet';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-label','Nawigacja tej strony');

    var head=document.createElement('div');
    head.className='sticky-mobile-nav-head';
    var title=document.createElement('p');
    title.className='sticky-mobile-nav-title';
    title.textContent='Na tej stronie';
    var close=document.createElement('button');
    close.type='button';
    close.className='sticky-mobile-nav-close';
    close.setAttribute('aria-label','Zamknij menu');
    close.textContent='×';

    linksBox=document.createElement('nav');
    linksBox.className='sticky-mobile-nav-links';
    linksBox.setAttribute('aria-label','Szybka nawigacja');

    items.forEach(function(item){
      var a=document.createElement('a');
      a.href=item.href;
      a.textContent=item.label;
      a.setAttribute('data-source-href',item.href);
      linksBox.appendChild(a);
    });

    head.appendChild(title);head.appendChild(close);
    sheet.appendChild(head);sheet.appendChild(linksBox);
    overlay.appendChild(sheet);
    document.body.appendChild(toggle);
    document.body.appendChild(overlay);

    function open(){
      lastFocus=document.activeElement;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden','false');
      toggle.setAttribute('aria-expanded','true');
      window.setTimeout(function(){
        var first=linksBox.querySelector('a');
        if(first)first.focus();
      },0);
    }
    function shut(){
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden','true');
      toggle.setAttribute('aria-expanded','false');
      if(lastFocus&&lastFocus.focus)lastFocus.focus();
    }

    toggle.addEventListener('click',open);
    close.addEventListener('click',shut);
    overlay.addEventListener('click',function(e){if(e.target===overlay)shut()});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay.classList.contains('is-open'))shut()});
    linksBox.addEventListener('click',function(e){
      var a=e.target.closest?e.target.closest('a[href]'):null;
      if(!a)return;
      var href=a.getAttribute('href');
      if(href&&href.charAt(0)==='#'){
        var target=document.querySelector(href);
        if(target){
          e.preventDefault();
          if(target.scrollIntoView){
            try{target.scrollIntoView({behavior:'smooth',block:'start'});}
            catch(err){target.scrollIntoView(true);}
          }
        }
      }
      shut();
    });
  }

  function updateMobile(){
    if(!toggle||!primary)return;
    var should=!enabled(primary);
    if(should)toggle.classList.add('is-enabled');
    else{
      toggle.classList.remove('is-enabled');
      if(overlay){
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden','true');
        toggle.setAttribute('aria-expanded','false');
      }
    }
  }

  function syncMobileCurrent(){
    if(!linksBox||!primary)return;
    var current=primary.querySelector('a.is-current[href],a[aria-current="location"][href],a[aria-current="page"][href]');
    var href=current&&current.getAttribute('href');
    Array.prototype.forEach.call(linksBox.querySelectorAll('a[href]'),function(a){
      a.classList.toggle('is-current',!!href&&a.getAttribute('data-source-href')===href);
    });
  }

  var frame=0;
  function syncAll(){
    frame=0;
    rails.forEach(syncRail);
    updateMobile();
    syncMobileCurrent();
  }
  function requestSync(){
    if(frame)return;
    frame=window.requestAnimationFrame?window.requestAnimationFrame(syncAll):window.setTimeout(syncAll,16);
  }

  buildMobile();
  window.addEventListener('scroll',requestSync,false);
  window.addEventListener('resize',requestSync);
  window.addEventListener('orientationchange',requestSync);
  window.addEventListener('load',requestSync);
  document.addEventListener('visibilitychange',requestSync);
  requestSync();
})();