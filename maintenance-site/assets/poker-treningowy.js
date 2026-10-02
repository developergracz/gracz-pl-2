(function(){
  'use strict';

  var MESSAGES={
    search:{title:'Wyszukiwarka jest w przygotowaniu',text:'Wyszukiwanie w serwisie zostanie uruchomione wraz z kolejnymi funkcjami gracz.pl.',button:'Zamknij'},
    login:{title:'Logowanie nie jest jeszcze aktywne',text:'System kont użytkowników jest obecnie przygotowywany. Logowanie udostępnimy w kolejnym etapie rozwoju gracz.pl.',button:'Rozumiem'},
    register:{title:'Rejestracja nie jest jeszcze aktywna',text:'Możliwość zakładania kont zostanie uruchomiona po zakończeniu przygotowania systemu użytkowników gracz.pl.',button:'Rozumiem'},
    community:{title:'Funkcje społecznościowe są w przygotowaniu',text:'Profil gracza, turnieje i funkcje społecznościowe zostaną uruchomione w kolejnych etapach.',button:'Rozumiem'},
    rankings:{title:'Historia i statystyki są w przygotowaniu',text:'Historia rozdań, statystyki sesji i narzędzia analizy pojawią się wraz z uruchomieniem stołów treningowych.',button:'Rozumiem'},
    multiplayer:{title:'Stoły treningowe są w przygotowaniu',text:'Stoły treningowe Texas Hold’em dla 2–6 graczy zostaną uruchomione po zakończeniu prac nad trybem edukacyjnym.',button:'Rozumiem'},
    play:{title:'Poker treningowy jest w przygotowaniu',text:'Tryb treningowy nie jest jeszcze aktywny. Ta podstrona przedstawia zasady Texas Hold’em oraz planowany edukacyjny tryb gry na żetonach bez wartości pieniężnej.',button:'Rozumiem'},
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


  var trainer=document.querySelector('[data-poker-trainer]');
  if(trainer){
    var feedback=trainer.querySelector('[data-poker-feedback]');
    trainer.addEventListener('click',function(e){
      var button=e.target.closest('[data-poker-action]');
      if(!button)return;
      Array.prototype.forEach.call(trainer.querySelectorAll('[data-poker-action]'),function(b){b.classList.remove('is-legal','is-illegal');});
      var action=button.getAttribute('data-poker-action');
      if(action==='check'){
        button.classList.add('is-illegal');
        feedback.innerHTML='<strong>Check nie jest legalny.</strong> Przed Tobą jest już zakład, więc nie możesz przekazać akcji bez wyrównania.';
      }else{
        button.classList.add('is-legal');
        if(action==='fold')feedback.innerHTML='<strong>Fold jest legalny.</strong> Możesz zrezygnować z dalszego udziału w rozdaniu.';
        if(action==='call')feedback.innerHTML='<strong>Call jest legalny.</strong> Wyrównujesz aktualny zakład przeciwnika.';
        if(action==='raise')feedback.innerHTML='<strong>Raise może być legalny.</strong> Podbijasz istniejący zakład, o ile spełniasz minimalne wymagania legalnego podbicia i masz wystarczający stack.';
      }
    });
  }

  var potOdds=document.querySelector('[data-pot-odds]');
  if(potOdds){
    var potInput=potOdds.querySelector('[data-pot]');
    var callInput=potOdds.querySelector('[data-call]');
    var result=potOdds.querySelector('[data-pot-result]');
    var calc=potOdds.querySelector('[data-pot-calc]');

    function numeric(value,min){
      var n=Number(value);
      if(!Number.isFinite(n))n=min;
      return Math.max(min,n);
    }

    calc.addEventListener('click',function(){
      var pot=numeric(potInput.value,0);
      var call=numeric(callInput.value,1);
      potInput.value=String(pot);
      callInput.value=String(call);
      var finalPot=pot+call;
      var threshold=(call/finalPot)*100;
      result.innerHTML='<strong>Wymagany udział: '+threshold.toFixed(1)+'%</strong><span>Sprawdzasz '+call+' do puli, która po Twoim callu wyniesie '+finalPot+'. To próg matematyczny, a nie rekomendacja strategiczna.</span>';
    });
  }



  /* POKER ACADEMY PREMIUM MAX R1 */
  var ACADEMY_KEY='graczPokerAcademyProgressV1';
  var MODULES=['zasady','uklady','pozycja','decyzje','matematyka','quiz'];

  function readAcademy(){
    try{
      var raw=window.localStorage.getItem(ACADEMY_KEY);
      var data=raw?JSON.parse(raw):{};
      MODULES.forEach(function(k){data[k]=!!data[k];});
      return data;
    }catch(e){
      return {zasady:false,uklady:false,pozycja:false,decyzje:false,matematyka:false,quiz:false};
    }
  }
  function writeAcademy(state){
    try{window.localStorage.setItem(ACADEMY_KEY,JSON.stringify(state));}catch(e){}
  }
  var academyState=readAcademy();

  function renderAcademy(){
    var done=MODULES.filter(function(k){return academyState[k];}).length;
    var pct=Math.round((done/MODULES.length)*100);
    var percent=document.querySelector('[data-academy-percent]');
    var count=document.querySelector('[data-academy-done]');
    var progress=document.querySelector('[data-academy-progress]');
    var sidePercent=document.querySelector('[data-academy-side-percent]');
    var sideDone=document.querySelector('[data-academy-side-done]');
    var sideBar=document.querySelector('[data-academy-side-bar]');
    var ring=document.querySelector('[data-academy-ring]');
    if(percent)percent.textContent=pct+'%';
    if(count)count.textContent=done;
    if(progress)progress.value=done;
    if(sidePercent)sidePercent.textContent=pct+'%';
    if(sideDone)sideDone.textContent=done;
    if(sideBar)sideBar.value=done;
    if(ring)ring.style.setProperty('--academy-pct',pct+'%');
    document.querySelectorAll('[data-academy-module]').forEach(function(btn){
      btn.classList.toggle('is-done',!!academyState[btn.getAttribute('data-academy-module')]);
    });
    var next=document.querySelector('[data-academy-next]');
    if(next){
      var labels={zasady:'Przebieg rozdania',uklady:'Ranking układów',pozycja:'Pozycje i blindy',decyzje:'Arena decyzji',matematyka:'Pot odds',quiz:'Quiz końcowy'};
      var first=MODULES.filter(function(k){return !academyState[k];})[0];
      next.textContent=first?'Następny krok: '+labels[first]:'Ścieżka ukończona — możesz wracać do dowolnego modułu.';
    }
  }
  function completeModule(key){
    if(MODULES.indexOf(key)<0)return;
    academyState[key]=true;
    writeAcademy(academyState);
    renderAcademy();
  }
  renderAcademy();

  document.addEventListener('click',function(e){
    var tracked=e.target.closest('[data-track-module]');
    if(tracked)completeModule(tracked.getAttribute('data-track-module'));

    var moduleButton=e.target.closest('[data-academy-module]');
    if(moduleButton){
      var key=moduleButton.getAttribute('data-academy-module');
      var map={zasady:'#przebieg-rozdania',uklady:'#ranking-ukladow',pozycja:'#pozycje-poker',decyzje:'#arena-decyzji',matematyka:'#pot-odds',quiz:'#quiz-poker'};
      var target=document.querySelector(map[key]);
      if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
    }

    var academyScroll=e.target.closest('[data-scroll-academy]');
    if(academyScroll){
      var academy=document.getElementById('poker-academy');
      if(academy)academy.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });

  var academyReset=document.querySelector('[data-academy-reset]');
  if(academyReset){
    academyReset.addEventListener('click',function(){
      academyState={zasady:false,uklady:false,pozycja:false,decyzje:false,matematyka:false,quiz:false};
      writeAcademy(academyState);
      renderAcademy();
    });
  }

  // Completing interactions also completes their academy modules.
  if(trainer){
    trainer.addEventListener('click',function(e){
      if(e.target.closest('[data-poker-action]'))completeModule('decyzje');
    });
  }
  if(potOdds){
    var academyCalc=potOdds.querySelector('[data-pot-calc]');
    if(academyCalc)academyCalc.addEventListener('click',function(){completeModule('matematyka');});
  }

  var arenaScenarios=[
    {
      topic:'Legalność akcji',
      title:'Przeciwnik zagrał bet na flopie',
      text:'Masz wystarczający stack. Która akcja NIE jest teraz legalna?',
      cards:[['A','♠',0],['K','♥',1],['Q','♦',1]],
      actions:['Check','Fold','Call','Raise'],
      correct:'Check',
      explain:'Check nie jest legalny, ponieważ przed Tobą jest już zakład. Możesz spasować, wyrównać albo — przy spełnieniu warunków — podbić.'
    },
    {
      topic:'Budowanie układu',
      title:'Masz A♠ K♥, a board to A♥ 10♣ 7♠ Q♦ 2♠',
      text:'Jaki podstawowy układ tworzysz z najlepszych pięciu kart?',
      cards:[['A','♠',0],['K','♥',1],['A','♥',1],['Q','♦',1],['10','♣',0]],
      actions:['Para asów','Dwie pary','Strit','Kolor'],
      correct:'Para asów',
      explain:'Masz parę asów. Do strita brakuje waleta, a pięciu kart jednego koloru nie ma.'
    },
    {
      topic:'Pozycja',
      title:'Button przesuwa się po rozdaniu',
      text:'Która pozycja jest bezpośrednio po lewej stronie buttona i wnosi mniejszy obowiązkowy blind?',
      cards:[['BTN','',0],['SB','',0],['BB','',0]],
      actions:['Small Blind','Big Blind','UTG','Cutoff'],
      correct:'Small Blind',
      explain:'Small Blind znajduje się bezpośrednio po lewej stronie buttona i wnosi mniejszy obowiązkowy wkład.'
    }
  ];
  var arena=document.querySelector('[data-decision-arena]');
  if(arena){
    var arenaIndex=0,arenaScore=0,arenaLocked=false;
    var idxEl=arena.querySelector('[data-arena-index]');
    var topicEl=arena.querySelector('[data-arena-topic]');
    var titleEl=arena.querySelector('[data-arena-title]');
    var textEl=arena.querySelector('[data-arena-text]');
    var cardsEl=arena.querySelector('[data-arena-cards]');
    var actionsEl=arena.querySelector('[data-arena-actions]');
    var feedbackEl=arena.querySelector('[data-arena-feedback]');
    var scoreEl=arena.querySelector('[data-arena-score]');
    var nextBtn=arena.querySelector('[data-arena-next]');
    var restartBtn=arena.querySelector('[data-arena-restart]');

    function renderArena(){
      var s=arenaScenarios[arenaIndex];
      arenaLocked=false;
      idxEl.textContent=arenaIndex+1;
      topicEl.textContent=s.topic;
      titleEl.textContent=s.title;
      textEl.textContent=s.text;
      cardsEl.innerHTML='';
      s.cards.forEach(function(card){
        var el=document.createElement('span');
        el.className='arena-card'+(card[2]?' red':'');
        el.textContent=card[0]+card[1];
        cardsEl.appendChild(el);
      });
      actionsEl.innerHTML='';
      s.actions.forEach(function(action){
        var btn=document.createElement('button');
        btn.type='button';
        btn.textContent=action;
        btn.setAttribute('data-arena-choice',action);
        actionsEl.appendChild(btn);
      });
      feedbackEl.textContent='Wybierz odpowiedź.';
      nextBtn.disabled=true;
      nextBtn.textContent=arenaIndex===arenaScenarios.length-1?'Zakończ sesję':'Następny scenariusz';
    }
    renderArena();

    actionsEl.addEventListener('click',function(e){
      var btn=e.target.closest('[data-arena-choice]');
      if(!btn||arenaLocked)return;
      arenaLocked=true;
      var s=arenaScenarios[arenaIndex];
      var ok=btn.getAttribute('data-arena-choice')===s.correct;
      btn.classList.add(ok?'is-correct':'is-wrong');
      if(ok){arenaScore++;scoreEl.textContent=arenaScore;}
      Array.prototype.forEach.call(actionsEl.querySelectorAll('button'),function(b){
        if(b.getAttribute('data-arena-choice')===s.correct)b.classList.add('is-correct');
      });
      feedbackEl.textContent=(ok?'Dobrze. ':'Nie tym razem. ')+s.explain;
      nextBtn.disabled=false;
      completeModule('decyzje');
    });

    nextBtn.addEventListener('click',function(){
      if(arenaIndex<arenaScenarios.length-1){arenaIndex++;renderArena();}
      else{
        feedbackEl.textContent='Sesja zakończona. Wynik: '+arenaScore+' / '+arenaScenarios.length+'. Możesz rozpocząć ponownie.';
        nextBtn.disabled=true;
      }
    });
    restartBtn.addEventListener('click',function(){arenaIndex=0;arenaScore=0;scoreEl.textContent='0';renderArena();});
  }

  var pokerQuiz=document.querySelector('[data-poker-quiz]');
  if(pokerQuiz){
    pokerQuiz.addEventListener('submit',function(e){
      e.preventDefault();
      var fields=Array.prototype.slice.call(pokerQuiz.querySelectorAll('fieldset[data-answer]'));
      var answered=0,score=0;
      fields.forEach(function(field){
        field.classList.remove('is-correct','is-wrong');
        var checked=field.querySelector('input:checked');
        if(!checked)return;
        answered++;
        var ok=checked.value===field.getAttribute('data-answer');
        if(ok)score++;
        field.classList.add(ok?'is-correct':'is-wrong');
      });
      var result=pokerQuiz.querySelector('[data-poker-quiz-result]');
      var strong=result.querySelector('strong');
      var span=result.querySelector('span');
      if(answered<fields.length){
        strong.textContent='Odpowiedz na wszystkie pytania.';
        span.textContent='Brakuje '+(fields.length-answered)+' odpowiedzi.';
        return;
      }
      strong.textContent='Wynik: '+score+' / '+fields.length;
      span.textContent=score===fields.length?'Świetnie — fundamenty masz opanowane.':score>=3?'Dobry wynik. Sprawdź pytania oznaczone na czerwono.':'Warto wrócić do ścieżki Academy i spróbować ponownie.';
      if(score>=4)completeModule('quiz');
    });
  }

  // Side navigation scroll spy.
  var pokerSideLinks=Array.prototype.slice.call(document.querySelectorAll('.poker-side-nav a[href^="#"]'));
  var pokerSideTargets=pokerSideLinks.map(function(link){
    var target=document.querySelector(link.getAttribute('href'));
    return {link:link,target:target};
  }).filter(function(x){return x.target;});
  function setPokerCurrent(id){
    pokerSideTargets.forEach(function(x){
      var current=x.target.id===id;
      x.link.classList.toggle('is-current',current);
      if(current)x.link.setAttribute('aria-current','location');else x.link.removeAttribute('aria-current');
    });
  }
  if(pokerSideTargets.length && 'IntersectionObserver' in window){
    var visible={};
    var pokerObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting)visible[entry.target.id]=entry.boundingClientRect.top;
        else delete visible[entry.target.id];
      });
      var ids=Object.keys(visible);
      if(!ids.length)return;
      ids.sort(function(a,b){return Math.abs(visible[a])-Math.abs(visible[b]);});
      setPokerCurrent(ids[0]);
    },{rootMargin:'-110px 0px -64% 0px',threshold:[0,.01,.2]});
    pokerSideTargets.forEach(function(x){pokerObserver.observe(x.target);});
  }

})();