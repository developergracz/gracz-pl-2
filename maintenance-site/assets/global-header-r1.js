(function(){
  'use strict';
  var header=document.querySelector('.site-header[data-shared-header="r1"]');
  if(!header)return;

  var burger=header.querySelector('.burger');
  var menuItems=Array.prototype.slice.call(header.querySelectorAll('.has-menu'));
  var mobile=window.matchMedia('(max-width:1180px)');

  function toggles(item){
    return Array.prototype.slice.call(item.querySelectorAll('.menu-toggle,.menu-toggle--label'));
  }
  function setMenu(item,open){
    item.classList.toggle('is-open',open);
    toggles(item).forEach(function(toggle){
      toggle.setAttribute('aria-expanded',open?'true':'false');
    });
  }
  function closeMenus(except){
    menuItems.forEach(function(item){if(item!==except)setMenu(item,false);});
  }
  function hoverMode(){
    return !mobile.matches&&window.matchMedia('(hover:hover)').matches;
  }

  menuItems.forEach(function(item){
    toggles(item).forEach(function(toggle){
      toggle.addEventListener('click',function(event){
        event.stopPropagation();
        var open=hoverMode()&&event.detail>0?true:!item.classList.contains('is-open');
        closeMenus(item);
        setMenu(item,open);
      });
    });
    item.addEventListener('mouseenter',function(){
      if(hoverMode()){closeMenus(item);setMenu(item,true);}
    });
    item.addEventListener('mouseleave',function(){
      if(hoverMode())setMenu(item,false);
    });
    item.addEventListener('focusout',function(event){
      if(!mobile.matches&&!item.contains(event.relatedTarget))setMenu(item,false);
    });
  });

  function setPanel(open){
    header.classList.toggle('menu-open',open);
    if(burger){
      burger.setAttribute('aria-expanded',open?'true':'false');
      burger.setAttribute('aria-label',open?'Zamknij menu':'Otwórz menu');
    }
    if(!open)closeMenus();
  }
  if(burger){
    burger.addEventListener('click',function(){
      setPanel(!header.classList.contains('menu-open'));
    });
  }
  document.addEventListener('click',function(event){
    if(!event.target.closest('.has-menu'))closeMenus();
  });
  document.addEventListener('keydown',function(event){
    if(event.key!=='Escape')return;
    var openItem=menuItems.filter(function(item){return item.classList.contains('is-open');})[0];
    if(openItem){
      setMenu(openItem,false);
      var toggle=toggles(openItem)[0];
      if(toggle)toggle.focus();
    }else if(header.classList.contains('menu-open')){
      setPanel(false);
      if(burger)burger.focus();
    }
  });
  mobile.addEventListener('change',function(){setPanel(false);});

  var path=location.pathname.replace(/\/+/g,'/');
  var active=null;
  if(path==='/')active='start';
  else if(path.indexOf('/gry-karciane/')===0)active='cards';
  else if(path.indexOf('/gry/')===0)active='games';
  else if(path.indexOf('/poradniki/')===0)active='guides';
  else if(path.indexOf('/o-gracz-pl/')===0)active='about';
  if(active){
    var target=header.querySelector('[data-nav-key="'+active+'"]');
    if(target){
      target.classList.add('is-active');
      target.setAttribute('aria-current','page');
    }
  }
})();