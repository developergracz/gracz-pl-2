(function(){
  'use strict';

  var toc=document.querySelector('.legal-toc');
  var toggle=document.querySelector('[data-toc-toggle]');
  var printButton=document.querySelector('[data-print]');
  var forumTrigger=document.querySelector('[data-forum-coming-soon]');
  var forumDialog=null;
  var forumLastTrigger=null;
  var ownerEmailDialog=null;
  var ownerEmailLastTrigger=null;


  function ensurePremiumDialogStyles(){
    var existing=document.querySelector('link[data-owner-email-premium-style]');
    if(existing){
      if(existing.sheet)return Promise.resolve();
      return new Promise(function(resolve){
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',resolve,{once:true});
      });
    }
    return new Promise(function(resolve){
      var link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/assets/account-access-premium.css?v=r2';
      link.setAttribute('data-owner-email-premium-style','');
      link.addEventListener('load',resolve,{once:true});
      link.addEventListener('error',resolve,{once:true});
      document.head.appendChild(link);
    });
  }

  function ownerEmailMarkup(){
    return '<div class="account-access__panel">'+
      '<button class="account-access__close" type="button" data-owner-email-close aria-label="Zamknij okno">×</button>'+
      '<div class="account-access__topline">'+
        '<span class="account-access__brand" aria-hidden="true">gracz<span>.pl</span></span>'+
        '<span class="account-access__status"><i aria-hidden="true"></i>Bezpośredni kontakt</span>'+
      '</div>'+
      '<div class="account-access__hero">'+
        '<p class="account-access__eyebrow">Kontakt gracz.pl · FULL MAX PREMIUM</p>'+
        '<h2 id="owner-email-title">Napisz bezpośrednio do gracz.pl</h2>'+
        '<p id="owner-email-intro" class="account-access__intro">Kliknij poniższy przycisk, aby otworzyć swój domyślny program pocztowy z przygotowanym adresem odbiorcy.</p>'+
      '</div>'+
      '<section class="account-access__newsletter" aria-labelledby="owner-email-card-title">'+
        '<div class="account-access__newsletter-icon" aria-hidden="true"><span>✉</span></div>'+
        '<div class="account-access__newsletter-copy">'+
          '<p class="account-access__newsletter-kicker">Adres kontaktowy</p>'+
          '<h3 id="owner-email-card-title">czsocha@wp.pl</h3>'+
          '<p>Możesz wysłać wiadomość w sprawie działania serwisu, problemów technicznych, sugestii, współpracy, reklamacji, prywatności lub RODO.</p>'+
          '<ul class="account-access__benefits">'+
            '<li><span aria-hidden="true">✓</span>adres odbiorcy zostanie wpisany automatycznie</li>'+
            '<li><span aria-hidden="true">✓</span>temat wiadomości zostanie przygotowany jako „Kontakt z gracz.pl”</li>'+
            '<li><span aria-hidden="true">✓</span>wiadomość zostanie wysłana dopiero po zatwierdzeniu jej w Twojej poczcie</li>'+
          '</ul>'+
          '<a class="account-access__newsletter-cta" href="mailto:czsocha@wp.pl?subject=Kontakt%20z%20gracz.pl"><span>Napisz e-mail do gracz.pl</span><b aria-hidden="true">→</b></a>'+
          '<p class="account-access__consent">Dla bezpieczeństwa nie przesyłaj haseł, danych kart, numerów dokumentów ani innych sekretów. Wysłanie wiadomości następuje w Twoim programie pocztowym.</p>'+
        '</div>'+
      '</section>'+
      '<div class="account-access__footer">'+
        '<span>gracz.pl · bezpośredni kontakt e-mail</span>'+
        '<button type="button" class="account-access__back" data-owner-email-close>Wróć do dokumentu</button>'+
      '</div>'+
    '</div>';
  }

  function ensureOwnerEmailDialog(){
    if(ownerEmailDialog)return ownerEmailDialog;
    ownerEmailDialog=document.createElement('dialog');
    ownerEmailDialog.className='account-access owner-email-premium';
    ownerEmailDialog.id='owner-email-premium-modal';
    ownerEmailDialog.setAttribute('aria-labelledby','owner-email-title');
    ownerEmailDialog.setAttribute('aria-describedby','owner-email-intro');
    ownerEmailDialog.innerHTML=ownerEmailMarkup();
    document.body.appendChild(ownerEmailDialog);

    ownerEmailDialog.addEventListener('click',function(event){
      if(event.target===ownerEmailDialog||event.target.closest('[data-owner-email-close]'))closeOwnerEmailDialog();
    });

    ownerEmailDialog.addEventListener('cancel',function(event){
      event.preventDefault();
      closeOwnerEmailDialog();
    });

    ownerEmailDialog.addEventListener('close',function(){
      document.body.classList.remove('account-access-open');
      if(ownerEmailLastTrigger&&document.contains(ownerEmailLastTrigger)){
        try{ownerEmailLastTrigger.focus();}catch(_){}
      }
      ownerEmailLastTrigger=null;
    });

    ownerEmailDialog.addEventListener('keydown',function(event){
      if(event.key!=='Tab')return;
      var focusables=Array.prototype.slice.call(ownerEmailDialog.querySelectorAll('button,a[href]')).filter(function(node){
        return !node.disabled&&node.tabIndex!==-1&&node.offsetParent!==null;
      });
      if(!focusables.length)return;
      var first=focusables[0],last=focusables[focusables.length-1];
      if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}
      else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}
    });

    return ownerEmailDialog;
  }

  async function openOwnerEmailDialog(trigger){
    ownerEmailLastTrigger=trigger||document.activeElement;
    await ensurePremiumDialogStyles();
    var dialog=ensureOwnerEmailDialog();
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    document.body.classList.add('account-access-open');
    window.setTimeout(function(){
      var primary=dialog.querySelector('.account-access__newsletter-cta');
      if(primary)primary.focus();
    },0);
  }

  function closeOwnerEmailDialog(){
    if(!ownerEmailDialog)return;
    if(typeof ownerEmailDialog.close==='function'&&ownerEmailDialog.open)ownerEmailDialog.close();
    else{
      ownerEmailDialog.removeAttribute('open');
      document.body.classList.remove('account-access-open');
      if(ownerEmailLastTrigger&&document.contains(ownerEmailLastTrigger)){
        try{ownerEmailLastTrigger.focus();}catch(_){}
      }
      ownerEmailLastTrigger=null;
    }
  }
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

  Array.prototype.forEach.call(document.querySelectorAll('a[href="mailto:czsocha@wp.pl"]'),function(link){
    link.addEventListener('click',function(event){
      event.preventDefault();
      openOwnerEmailDialog(link);
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