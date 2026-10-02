(function(){
  'use strict';

  var MESSAGES={
    search:{title:'Wyszukiwarka jest w przygotowaniu',text:'Wyszukiwanie w serwisie zostanie uruchomione wraz z kolejnymi funkcjami gracz.pl.',button:'Zamknij'},
    login:{title:'Logowanie nie jest jeszcze aktywne',text:'System kont użytkowników jest obecnie przygotowywany. Logowanie udostępnimy w kolejnym etapie rozwoju gracz.pl.',button:'Rozumiem'},
    register:{title:'Rejestracja nie jest jeszcze aktywna',text:'Możliwość zakładania kont zostanie uruchomiona po zakończeniu przygotowania systemu użytkowników gracz.pl.',button:'Rozumiem'},
    community:{title:'Funkcje społecznościowe są w przygotowaniu',text:'Profil gracza, turnieje i funkcje społecznościowe zostaną uruchomione w kolejnych etapach.',button:'Rozumiem'},
    rankings:{title:'Rankingi i statystyki są w przygotowaniu',text:'Rankingi, historia wyników i statystyki Gomoku pojawią się wraz z uruchomieniem rozgrywki online.',button:'Rozumiem'},
    multiplayer:{title:'Multiplayer jest w przygotowaniu',text:'Rozgrywka z innymi graczami zostanie uruchomiona po zakończeniu prac nad Gomoku online.',button:'Rozumiem'},
    play:{title:'Gomoku online jest w przygotowaniu',text:'Gra online nie jest jeszcze aktywna. Ta podstrona przedstawia zasady, planszę i przygotowywany kierunek rozwoju Gomoku na gracz.pl.',button:'Rozumiem'},
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


  /* GOMOKU ACADEMY PREMIUM MAX R1 */
  var GOMOKU_KEY='graczGomokuAcademyProgressV1';
  var GOMOKU_MODULES=['podstawy','zagrozenia','atak','ruch','strategia','quiz'];

  function readGomokuProgress(){
    try{
      var raw=window.localStorage.getItem(GOMOKU_KEY);
      var data=raw?JSON.parse(raw):{};
      GOMOKU_MODULES.forEach(function(k){data[k]=!!data[k];});
      return data;
    }catch(e){return {podstawy:false,zagrozenia:false,atak:false,ruch:false,strategia:false,quiz:false};}
  }
  function saveGomokuProgress(state){try{window.localStorage.setItem(GOMOKU_KEY,JSON.stringify(state));}catch(e){}}
  var gomokuState=readGomokuProgress();

  function renderGomokuProgress(){
    var done=GOMOKU_MODULES.filter(function(k){return gomokuState[k];}).length;
    var pct=Math.round(done/GOMOKU_MODULES.length*100);
    var map=[['[data-gomoku-percent]',pct+'%'],['[data-gomoku-done]',done],['[data-gomoku-side-percent]',pct+'%'],['[data-gomoku-side-done]',done]];
    map.forEach(function(item){var el=document.querySelector(item[0]);if(el)el.textContent=item[1];});
    var progress=document.querySelector('[data-gomoku-progress]');if(progress)progress.value=done;
    var sideBar=document.querySelector('[data-gomoku-side-bar]');if(sideBar)sideBar.value=done;
    var ring=document.querySelector('[data-gomoku-ring]');if(ring)ring.style.setProperty('--gomoku-pct',pct+'%');
    document.querySelectorAll('[data-gomoku-module]').forEach(function(btn){
      var key=btn.getAttribute('data-gomoku-module'),complete=!!gomokuState[key];
      btn.classList.toggle('is-done',complete);btn.setAttribute('aria-pressed',complete?'true':'false');
    });
    var labels={podstawy:'podstawy ruchu',zagrozenia:'laboratorium zagrożeń',atak:'trener atak / obrona',ruch:'legalny ruch',strategia:'strategia i błędy',quiz:'quiz końcowy'};
    var next=document.querySelector('[data-gomoku-next]');
    var first=GOMOKU_MODULES.filter(function(k){return !gomokuState[k];})[0];
    if(next)next.textContent=first?'Następny krok: '+labels[first]:'Ścieżka ukończona — możesz powtarzać dowolny moduł.';
  }
  function completeGomoku(key){
    if(GOMOKU_MODULES.indexOf(key)<0)return;
    gomokuState[key]=true;saveGomokuProgress(gomokuState);renderGomokuProgress();
  }
  function gomokuScroll(target){
    if(!target)return;
    var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  }
  renderGomokuProgress();

  document.addEventListener('click',function(e){
    var hero=e.target.closest('[data-scroll-gomoku-academy]');
    if(hero){e.preventDefault();gomokuScroll(document.getElementById('gomoku-academy'));}
    var tracked=e.target.closest('[data-track-gomoku]');
    if(tracked)completeGomoku(tracked.getAttribute('data-track-gomoku'));
    var moduleBtn=e.target.closest('[data-gomoku-module]');
    if(moduleBtn){
      var key=moduleBtn.getAttribute('data-gomoku-module');
      var targets={podstawy:'#zasady',zagrozenia:'#threat-lab',atak:'#attack-defense',ruch:'#legal-move-lab',strategia:'#strategia-gomoku',quiz:'#quiz-gomoku'};
      gomokuScroll(document.querySelector(targets[key]));
    }
  });

  var reset=document.querySelector('[data-gomoku-reset]');
  if(reset){
    reset.addEventListener('click',function(){
      gomokuState={podstawy:false,zagrozenia:false,atak:false,ruch:false,strategia:false,quiz:false};
      saveGomokuProgress(gomokuState);renderGomokuProgress();
    });
  }

  var threat=document.querySelector('[data-threat-lab]');
  if(threat){
    var threatInfo={
      trojka:['Trójka','Trzy kamienie mogą być początkiem ataku, szczególnie gdy układ ma wolne możliwości rozwoju po obu stronach.'],
      czworka:['Czwórka','Cztery połączone kamienie z możliwością dostawienia piątego są zagrożeniem wymagającym natychmiastowej reakcji, jeśli przeciwnik nie ma własnej wygranej.'],
      piatka:['Piątka','Pięć połączonych kamieni w poziomie, pionie lub po przekątnej natychmiast kończy partię zwycięstwem.'],
      nadlinia:['6+ kamieni','W podstawowym wariancie gracz.pl linia sześciu lub większej liczby kamieni również spełnia warunek co najmniej pięciu i wygrywa.']
    };
    var result=threat.querySelector('[data-threat-result]');
    threat.addEventListener('click',function(e){
      var btn=e.target.closest('[data-threat]');if(!btn)return;
      Array.prototype.forEach.call(threat.querySelectorAll('[data-threat]'),function(b){b.classList.toggle('is-active',b===btn);});
      var d=threatInfo[btn.getAttribute('data-threat')];
      result.innerHTML='<strong>'+d[0]+'</strong><span>'+d[1]+'</span>';
      completeGomoku('zagrozenia');
    });
  }

  var scenarios=[
    {topic:'Natychmiastowa wygrana',title:'Masz cztery kamienie w linii i wolne pole na końcu',text:'Co powinieneś zrobić w pierwszej kolejności?',actions:['Zagrać piąty kamień','Bronić innego miejsca'],correct:'Zagrać piąty kamień',explain:'Natychmiastowa wygrana ma najwyższy priorytet — zakończ partię, jeśli możesz.'},
    {topic:'Obrona',title:'Przeciwnik ma cztery kamienie i jedno wolne pole kończące linię',text:'Nie masz własnej natychmiastowej wygranej. Co robisz?',actions:['Blokuję wolne pole','Buduję własną trójkę gdzie indziej'],correct:'Blokuję wolne pole',explain:'Bez własnej natychmiastowej wygranej musisz powstrzymać piąty kamień przeciwnika.'},
    {topic:'Podwójne zagrożenie',title:'Możesz zagrać ruch rozwijający dwa kierunki jednocześnie',text:'Co jest zwykle silniejsze?',actions:['Ruch tworzący dwa zagrożenia','Ruch rozwijający tylko jeden kierunek'],correct:'Ruch tworzący dwa zagrożenia',explain:'Dwa jednoczesne kierunki zwiększają presję i utrudniają obronę jednym ruchem.'}
  ];
  var decision=document.querySelector('[data-attack-defense]');
  if(decision){
    var di=0,ds=0,locked=false;
    var idx=decision.querySelector('[data-decision-index]');
    var topic=decision.querySelector('[data-decision-topic]');
    var titleEl=decision.querySelector('[data-decision-title]');
    var textEl=decision.querySelector('[data-decision-text]');
    var actions=decision.querySelector('[data-decision-actions]');
    var feedback=decision.querySelector('[data-decision-feedback]');
    var score=decision.querySelector('[data-decision-score]');
    var next=decision.querySelector('[data-decision-next]');
    var restart=decision.querySelector('[data-decision-restart]');
    function renderDecision(){
      var s=scenarios[di];locked=false;idx.textContent=di+1;topic.textContent=s.topic;titleEl.textContent=s.title;textEl.textContent=s.text;actions.innerHTML='';
      s.actions.forEach(function(a){var b=document.createElement('button');b.type='button';b.textContent=a;b.setAttribute('data-decision-choice',a);actions.appendChild(b);});
      feedback.textContent='Wybierz odpowiedź.';next.disabled=true;next.textContent=di===scenarios.length-1?'Zakończ sesję':'Następna sytuacja';
    }
    renderDecision();
    actions.addEventListener('click',function(e){
      var btn=e.target.closest('[data-decision-choice]');if(!btn||locked)return;locked=true;
      var s=scenarios[di],ok=btn.getAttribute('data-decision-choice')===s.correct;
      btn.classList.add(ok?'is-correct':'is-wrong');
      Array.prototype.forEach.call(actions.querySelectorAll('button'),function(b){if(b.getAttribute('data-decision-choice')===s.correct)b.classList.add('is-correct');});
      if(ok){ds++;score.textContent=ds;}
      feedback.textContent=(ok?'Dobrze. ':'Nie tym razem. ')+s.explain;next.disabled=false;completeGomoku('atak');
    });
    next.addEventListener('click',function(){
      if(di<scenarios.length-1){di++;renderDecision();}
      else{feedback.textContent='Sesja zakończona. Wynik: '+ds+' / '+scenarios.length+'.';next.disabled=true;}
    });
    restart.addEventListener('click',function(){di=0;ds=0;score.textContent='0';renderDecision();});
  }

  var legal=document.querySelector('[data-legal-move]');
  if(legal){
    var feedbackLegal=legal.querySelector('[data-legal-feedback]');
    legal.addEventListener('click',function(e){
      var btn=e.target.closest('[data-legal-choice]');if(!btn)return;
      Array.prototype.forEach.call(legal.querySelectorAll('[data-legal-choice]'),function(b){b.classList.remove('is-correct','is-wrong');});
      var key=btn.getAttribute('data-legal-choice');
      var ok=key==='wolne';btn.classList.add(ok?'is-correct':'is-wrong');
      var messages={
        wolne:'Tak. W podstawowym Gomoku możesz położyć swój kamień na dowolnym wolnym przecięciu planszy.',
        zajete:'Nie. Na zajętym przecięciu nie można położyć drugiego kamienia.',
        przesun:'Nie. Raz położony kamień pozostaje na swoim miejscu do końca partii.'
      };
      feedbackLegal.textContent=messages[key];
      completeGomoku('ruch');
    });
  }

  var strategy=document.getElementById('strategia-gomoku');
  if(strategy && 'IntersectionObserver' in window){
    var strategyObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){if(entry.isIntersecting){completeGomoku('strategia');strategyObserver.disconnect();}});
    },{threshold:.35});
    strategyObserver.observe(strategy);
  }

  var basics=document.getElementById('zasady');
  if(basics && 'IntersectionObserver' in window){
    var basicsObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){if(entry.isIntersecting){completeGomoku('podstawy');basicsObserver.disconnect();}});
    },{threshold:.3});
    basicsObserver.observe(basics);
  }

  var quiz=document.querySelector('[data-gomoku-quiz]');
  if(quiz){
    quiz.addEventListener('submit',function(e){
      e.preventDefault();
      var fields=Array.prototype.slice.call(quiz.querySelectorAll('fieldset[data-answer]'));
      var answered=0,points=0;
      fields.forEach(function(field){
        field.classList.remove('is-correct','is-wrong');
        var checked=field.querySelector('input:checked');if(!checked)return;
        answered++;var ok=checked.value===field.getAttribute('data-answer');if(ok)points++;
        field.classList.add(ok?'is-correct':'is-wrong');
      });
      var result=quiz.querySelector('[data-gomoku-quiz-result]');
      var strong=result.querySelector('strong'),span=result.querySelector('span');
      if(answered<fields.length){strong.textContent='Odpowiedz na wszystkie pytania.';span.textContent='Brakuje '+(fields.length-answered)+' odpowiedzi.';return;}
      strong.textContent='Wynik: '+points+' / '+fields.length;
      span.textContent=points===5?'Świetnie — fundamenty Gomoku masz opanowane.':points>=3?'Dobry wynik. Wróć do pytań oznaczonych na czerwono.':'Warto przejść ścieżkę Academy jeszcze raz.';
      if(points>=4)completeGomoku('quiz');
    });
  }

  var topLinks=Array.prototype.slice.call(document.querySelectorAll('[data-gomoku-section-nav] a[href^="#"]'));
  var sideLinks=Array.prototype.slice.call(document.querySelectorAll('.gomoku-side-nav a[href^="#"]'));
  var allLinks=topLinks.concat(sideLinks);
  var targetMap={};
  allLinks.forEach(function(link){var target=document.querySelector(link.getAttribute('href'));if(target)targetMap[target.id]=target;});
  var targetList=Object.keys(targetMap).map(function(id){return targetMap[id];});
  function setGomokuCurrent(id){
    allLinks.forEach(function(link){
      var current=link.getAttribute('href')==='#'+id;
      link.classList.toggle('is-current',current);
      if(current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
    });
  }
  if(targetList.length && 'IntersectionObserver' in window){
    var visible={};
    var navObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){if(entry.isIntersecting)visible[entry.target.id]=entry.boundingClientRect.top;else delete visible[entry.target.id];});
      var ids=Object.keys(visible);if(!ids.length)return;
      ids.sort(function(a,b){return Math.abs(visible[a])-Math.abs(visible[b]);});
      setGomokuCurrent(ids[0]);
    },{rootMargin:'-120px 0px -64% 0px',threshold:[0,.01,.2]});
    targetList.forEach(function(target){navObserver.observe(target);});
  }

})();