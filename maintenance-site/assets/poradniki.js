(function(){
  'use strict';

  var MESSAGES={
    search:{title:'Wyszukiwarka jest w przygotowaniu',text:'Wyszukiwanie w serwisie zostanie uruchomione wraz z kolejnymi funkcjami gracz.pl.',button:'Zamknij'},
    login:{title:'Logowanie nie jest jeszcze aktywne',text:'System kont użytkowników jest obecnie przygotowywany. Logowanie udostępnimy w kolejnym etapie rozwoju gracz.pl.',button:'Rozumiem'},
    register:{title:'Rejestracja nie jest jeszcze aktywna',text:'Możliwość zakładania kont zostanie uruchomiona po zakończeniu przygotowania systemu użytkowników gracz.pl.',button:'Rozumiem'},
    community:{title:'Funkcje społecznościowe są w przygotowaniu',text:'Profil gracza, turnieje i funkcje społecznościowe zostaną uruchomione w kolejnych etapach.',button:'Rozumiem'},
    rankings:{title:'Rankingi i statystyki są w przygotowaniu',text:'Rankingi, historia wyników i statystyki graczy pojawią się wraz z uruchamianiem kolejnych funkcji gracz.pl.',button:'Rozumiem'},
    updates:{title:'Aktualności są w przygotowaniu',text:'Sekcję aktualności uruchomimy wraz z kolejnymi publicznymi funkcjami gracz.pl.',button:'Rozumiem'},
    newsletter:{title:'Newsletter jest w przygotowaniu',text:'Możliwość zapisania się na informacje o nowych funkcjach gracz.pl uruchomimy w kolejnym etapie.',button:'Rozumiem'},
    privacy:{title:'Polityka prywatności',text:'Polityka prywatności jest przygotowywana.',button:'Rozumiem'},
    terms:{title:'Regulamin',text:'Regulamin serwisu jest przygotowywany.',button:'Rozumiem'},
    contact:{title:'Kontakt',text:'Sekcja kontaktowa zostanie udostępniona wraz z kolejnym etapem serwisu.',button:'Rozumiem'}
  };

  var body=document.body;
  var header=document.querySelector('.site-header');
  var burger=document.querySelector('.burger');
  var menuItems=Array.prototype.slice.call(document.querySelectorAll('.has-menu'));
  var mobile=window.matchMedia('(max-width:1180px)');

  function toggleOf(item){return item.querySelector('.menu-toggle, .menu-toggle--label');}
  function setMenu(item,open){
    item.classList.toggle('is-open',open);
    var t=toggleOf(item);
    if(t)t.setAttribute('aria-expanded',open?'true':'false');
  }
  function closeMenus(except){
    menuItems.forEach(function(item){if(item!==except)setMenu(item,false);});
  }

  menuItems.forEach(function(item){
    var toggles=item.querySelectorAll('.menu-toggle, .menu-toggle--label');
    Array.prototype.forEach.call(toggles,function(toggle){
      toggle.addEventListener('click',function(e){
        e.stopPropagation();
        var hoverMode=!mobile.matches && window.matchMedia('(hover:hover)').matches;
        var pointerActivation=e.detail>0;
        var open=(hoverMode && pointerActivation)?true:!item.classList.contains('is-open');
        closeMenus(item);
        setMenu(item,open);
      });
    });

    item.addEventListener('mouseenter',function(){
      if(!mobile.matches && window.matchMedia('(hover:hover)').matches){
        closeMenus(item);
        setMenu(item,true);
      }
    });

    item.addEventListener('mouseleave',function(){
      if(!mobile.matches && window.matchMedia('(hover:hover)').matches)setMenu(item,false);
    });
  });

  document.addEventListener('click',function(e){
    if(!e.target.closest('.has-menu'))closeMenus();
  });

  function setPanel(open){
    header.classList.toggle('menu-open',open);
    burger.setAttribute('aria-expanded',open?'true':'false');
    burger.setAttribute('aria-label',open?'Zamknij menu':'Otwórz menu');
    if(!open)closeMenus();
  }

  burger.addEventListener('click',function(){
    setPanel(!header.classList.contains('menu-open'));
  });

  mobile.addEventListener('change',function(){
    setPanel(false);
  });

  var modal=document.getElementById('modal');
  var modalTitle=document.getElementById('modal-title');
  var modalText=document.getElementById('modal-text');
  var modalOk=modal.querySelector('.modal-ok');
  var lastTrigger=null;

  function openModal(key,trigger){
    var msg=MESSAGES[key];
    if(!msg)return;
    lastTrigger=trigger||document.activeElement;
    closeMenus();
    setPanel(false);
    modalTitle.textContent=msg.title;
    modalText.textContent=msg.text;
    modalOk.textContent=msg.button;
    if(typeof modal.showModal==='function')modal.showModal();
    else modal.setAttribute('open','');
    body.classList.add('modal-open');
    modalOk.focus();
  }

  function onClosed(){
    body.classList.remove('modal-open');
    if(lastTrigger && document.contains(lastTrigger)){
      var hiddenPanelTrigger=mobile.matches && lastTrigger.closest && lastTrigger.closest('#menu-panel') && !header.classList.contains('menu-open');
      if(hiddenPanelTrigger && burger)burger.focus();
      else lastTrigger.focus();
    }
    lastTrigger=null;
  }

  function closeModal(){
    if(typeof modal.close==='function' && modal.open)modal.close();
    else{
      modal.removeAttribute('open');
      onClosed();
    }
  }

  modal.addEventListener('close',onClosed);
  modal.addEventListener('cancel',function(e){
    e.preventDefault();
    closeModal();
  });
  modal.addEventListener('click',function(e){
    if(e.target===modal || e.target.closest('[data-close]'))closeModal();
  });

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

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape' && !modal.open){
      var openItem=menuItems.filter(function(i){return i.classList.contains('is-open');})[0];
      if(openItem){
        setMenu(openItem,false);
        var t=toggleOf(openItem);
        if(t)t.focus();
      }else if(header.classList.contains('menu-open')){
        setPanel(false);
        burger.focus();
      }
    }
  });

  /* Poradniki FULL MAX R2 */
  var STORAGE_KEY='graczPoradnikiProgressV2';
  var BOOKMARK_KEY='graczPoradnikiBookmarksV1';
  var LAST_KEY='graczPoradnikiLastGuideV1';

  function safeRead(key,fallback){
    try{
      var raw=window.localStorage.getItem(key);
      return raw?JSON.parse(raw):fallback;
    }catch(e){return fallback;}
  }
  function safeWrite(key,value){
    try{window.localStorage.setItem(key,JSON.stringify(value));}catch(e){}
  }

  // Stored data is untrusted: validate type AND shape after JSON.parse (null / number / string / [null] must never break the page).
  var GAME_KEYS=['poker','tysiac','warcaby','gomoku'];
  function isPlainObject(value){return value!==null && typeof value==='object' && !Array.isArray(value);}

  function normalizeProgress(raw){
    var out={poker:0,tysiac:0,warcaby:0,gomoku:0};
    if(isPlainObject(raw)){
      GAME_KEYS.forEach(function(k){
        var n=Number(raw[k]);
        out[k]=Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0;
      });
    }
    return out;
  }

  function normalizeBookmarks(raw){
    var out=[],seen={};
    if(!Array.isArray(raw))return out;
    raw.forEach(function(item){
      if(!isPlainObject(item))return;
      var id=typeof item.id==='string'?item.id.slice(0,80):'';
      var title=typeof item.title==='string'?item.title.trim().slice(0,160):'';
      var href=typeof item.href==='string'?item.href:'';
      if(!id||!title||seen[id])return;
      // same-origin absolute paths or in-page anchors only
      if(!/^\/(?!\/)\S*$/.test(href) && !/^#[A-Za-z0-9_-]+$/.test(href))href='#poradnik-tygodnia';
      seen[id]=true;
      out.push({id:id,title:title,href:href});
    });
    return out.slice(0,50);
  }

  var learningState=normalizeProgress(safeRead(STORAGE_KEY,null));

  function renderProgress(){
    var total=0;
    ['poker','tysiac','warcaby','gomoku'].forEach(function(k){
      var value=Math.max(0,Math.min(100,learningState[k]||0));
      total+=value;
      var bar=document.querySelector('[data-progress-bar="'+k+'"]');
      var label=document.querySelector('[data-progress-value="'+k+'"]');
      if(bar)bar.value=value;
      if(label)label.textContent=value+'%';
    });
    var overall=Math.round(total/4);
    var overallBar=document.querySelector('[data-overall-bar]');
    var overallLabel=document.querySelector('[data-overall-progress]');
    if(overallBar)overallBar.value=overall;
    if(overallLabel)overallLabel.textContent=overall+'%';
  }
  renderProgress();

  var lastGuide=document.querySelector('[data-last-guide]');
  var lastGuideValue=safeRead(LAST_KEY,'');
  if(typeof lastGuideValue!=='string')lastGuideValue='';
  if(lastGuide && lastGuideValue)lastGuide.textContent=lastGuideValue.slice(0,160);

  document.addEventListener('click',function(e){
    var guide=e.target.closest('[data-track-guide]');
    if(guide){
      var title=guide.getAttribute('data-track-guide');
      safeWrite(LAST_KEY,title);
      if(lastGuide)lastGuide.textContent=title;

      var href=(guide.getAttribute('href')||'').toLowerCase();
      var game='';
      if(href.indexOf('poker')>=0)game='poker';
      else if(href.indexOf('tysiac')>=0)game='tysiac';
      else if(href.indexOf('warcaby')>=0)game='warcaby';
      else if(href.indexOf('gomoku')>=0)game='gomoku';
      if(game){
        learningState[game]=Math.max(learningState[game]||0,10);
        safeWrite(STORAGE_KEY,learningState);
        renderProgress();
      }
    }
  });

  var resetProgress=document.querySelector('[data-reset-progress]');
  if(resetProgress){
    resetProgress.addEventListener('click',function(){
      learningState={poker:0,tysiac:0,warcaby:0,gomoku:0};
      safeWrite(STORAGE_KEY,learningState);
      try{window.localStorage.removeItem(LAST_KEY);}catch(e){}
      if(lastGuide)lastGuide.textContent='Jeszcze nic — wybierz pierwszy materiał.';
      renderProgress();
    });
  }

  var finder=document.querySelector('[data-guide-finder]');
  var finderResult=document.querySelector('[data-guide-result]');
  var finderLink=document.querySelector('[data-guide-result-link]');
  var recommendationMap={
    poker:{name:'Poker treningowy',href:'/gry/poker-treningowy/zasady/',rules:'Zacznij od przebiegu rozdania, układów i blindów.',strategy:'Przejdź do pozycji przy stole i porządkowania decyzji.',mistakes:'Skup się na selekcji rąk i unikaniu gry bez planu.'},
    tysiac:{name:'Tysiąc',href:'/gry/tysiac/zasady/',rules:'Zacznij od licytacji, musiku, meldunków i punktacji.',strategy:'Uporządkuj plan punktowy przed licytacją i prowadzeniem koloru.',mistakes:'Sprawdź ryzyko zbyt wysokiej deklaracji i gry bez liczenia punktów.'},
    warcaby:{name:'Warcaby',href:'/gry/warcaby/zasady/',rules:'Najpierw ruch pionków, obowiązkowe bicie i damka.',strategy:'Ćwicz czytanie sekwencji kilku ruchów i wymuszeń.',mistakes:'Najczęściej kosztuje patrzenie tylko na jeden ruch do przodu.'},
    gomoku:{name:'Gomoku',href:'/gry/gomoku/zasady/',rules:'Zacznij od celu pięciu kamieni i legalnego ruchu.',strategy:'Ucz się otwartych linii, podwójnych zagrożeń i blokowania.',mistakes:'Najczęstszy błąd to reakcja dopiero po zbudowaniu podwójnej groźby.'}
  };
  if(finder){
    finder.addEventListener('submit',function(e){
      e.preventDefault();
      var data=new FormData(finder);
      var game=data.get('game');
      var goal=data.get('goal');
      var level=data.get('level');
      var rec=recommendationMap[game]||recommendationMap.poker;
      var levelLabel=level==='start'?'poziom startowy':level==='medium'?'poziom średni':'poziom zaawansowany';
      var advice=rec[goal]||rec.rules;
      var strong=finderResult&&finderResult.querySelector('strong');
      var p=finderResult&&finderResult.querySelector('p');
      if(strong)strong.textContent=rec.name+' — '+levelLabel;
      if(p)p.textContent=advice;
      if(finderLink){finderLink.href=rec.href;finderLink.textContent='Otwórz rekomendowany materiał';finderLink.setAttribute('data-track-guide',rec.name+' — rekomendacja');}
    });
  }

  var liveQuiz=document.querySelector('[data-live-quiz]');
  if(liveQuiz){
    liveQuiz.addEventListener('submit',function(e){
      e.preventDefault();
      var fields=Array.prototype.slice.call(liveQuiz.querySelectorAll('[data-quiz-question]'));
      var answered=0,score=0;
      fields.forEach(function(field){
        field.classList.remove('is-correct','is-wrong');
        var checked=field.querySelector('input:checked');
        if(!checked)return;
        answered++;
        var correct=checked.value===field.getAttribute('data-answer');
        field.classList.add(correct?'is-correct':'is-wrong');
        if(correct){
          score++;
          var game=field.getAttribute('data-quiz-question');
          learningState[game]=Math.max(learningState[game]||0,25);
        }
      });
      var result=liveQuiz.querySelector('[data-quiz-result]');
      var strong=result&&result.querySelector('strong');
      var span=result&&result.querySelector('span');
      if(answered<fields.length){
        if(strong)strong.textContent='Odpowiedz na wszystkie pytania.';
        if(span)span.textContent='Brakuje '+(fields.length-answered)+' odpowiedzi.';
        return;
      }
      safeWrite(STORAGE_KEY,learningState);
      renderProgress();
      if(strong)strong.textContent='Wynik: '+score+' / '+fields.length;
      if(span)span.textContent=score===4?'Świetnie — fundamenty masz opanowane.':score>=2?'Dobry start. Wróć do pytań oznaczonych na czerwono.':'Warto wrócić do podstaw i spróbować ponownie.';
    });
  }

  var bookmarks=normalizeBookmarks(safeRead(BOOKMARK_KEY,[]));
  var savedList=document.querySelector('[data-saved-list]');

  function renderBookmarks(){
    if(!savedList)return;
    savedList.innerHTML='';
    if(!bookmarks.length){
      var empty=document.createElement('span');
      empty.className='saved-empty';
      empty.textContent='Nie masz jeszcze zapisanych materiałów.';
      savedList.appendChild(empty);
    }else{
      bookmarks.forEach(function(item){
        var row=document.createElement('div');
        row.className='saved-item';
        var title=document.createElement('a');
        title.href=item.href||'#poradnik-tygodnia';
        title.textContent=item.title;
        title.setAttribute('data-track-guide',item.title);
        var remove=document.createElement('button');
        remove.type='button';
        remove.textContent='Usuń';
        remove.setAttribute('data-remove-bookmark',item.id);
        row.appendChild(title);
        row.appendChild(remove);
        savedList.appendChild(row);
      });
    }
    document.querySelectorAll('[data-bookmark]').forEach(function(btn){
      var exists=bookmarks.some(function(x){return x.id===btn.getAttribute('data-bookmark');});
      btn.classList.toggle('is-saved',exists);
      btn.textContent=exists?'Zapisano ✓':'Zapisz na później';
    });
  }
  renderBookmarks();

  document.addEventListener('click',function(e){
    var save=e.target.closest('[data-bookmark]');
    if(save){
      var id=save.getAttribute('data-bookmark');
      var title=save.getAttribute('data-bookmark-title')||'Zapisany materiał';
      var href=save.getAttribute('data-bookmark-href')||'#poradnik-tygodnia';
      var idx=bookmarks.findIndex(function(x){return x.id===id;});
      if(idx>=0)bookmarks.splice(idx,1);else bookmarks.push({id:id,title:title,href:href});
      safeWrite(BOOKMARK_KEY,bookmarks);
      renderBookmarks();
    }
    var remove=e.target.closest('[data-remove-bookmark]');
    if(remove){
      var rid=remove.getAttribute('data-remove-bookmark');
      bookmarks=bookmarks.filter(function(x){return x.id!==rid;});
      safeWrite(BOOKMARK_KEY,bookmarks);
      renderBookmarks();
    }
  });


  /* Premium side navigation: highlight the section currently being read. */
  var sideLinks=Array.prototype.slice.call(document.querySelectorAll('.knowledge-side-nav a[href^="#"]'));
  var sideTargets=sideLinks.map(function(link){
    var id=link.getAttribute('href').slice(1);
    return {link:link,target:document.getElementById(id)};
  }).filter(function(item){return item.target;});

  function setCurrentSideLink(id){
    sideTargets.forEach(function(item){
      var current=item.target.id===id;
      item.link.classList.toggle('is-current',current);
      if(current)item.link.setAttribute('aria-current','location');
      else item.link.removeAttribute('aria-current');
    });
  }

  if(sideTargets.length){
    setCurrentSideLink(sideTargets[0].target.id);
    if('IntersectionObserver' in window){
      var visibleSections={};
      var observer=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting)visibleSections[entry.target.id]=entry.boundingClientRect.top;
          else delete visibleSections[entry.target.id];
        });
        var ids=Object.keys(visibleSections);
        if(!ids.length)return;
        ids.sort(function(a,b){return Math.abs(visibleSections[a])-Math.abs(visibleSections[b]);});
        setCurrentSideLink(ids[0]);
      },{rootMargin:'-96px 0px -62% 0px',threshold:[0,.01,.2]});
      sideTargets.forEach(function(item){observer.observe(item.target);});
    }
  }
})();