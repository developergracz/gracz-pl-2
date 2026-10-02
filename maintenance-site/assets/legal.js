(function(){
  'use strict';

  var toc=document.querySelector('.legal-toc');
  var toggle=document.querySelector('[data-toc-toggle]');
  var printButton=document.querySelector('[data-print]');
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