(function(){
  'use strict';

  // Progress integrity helpers (assets/academy-progress.js); safe no-op fallback keeps the page working without them.
  var GA=window.GraczAcademy||{passMark:function(n){return Math.ceil(n*2/3);},refresh:function(){},mark:function(){},explore:function(){},status:function(){}};

  var MESSAGES={
    search:{title:'Wyszukiwarka jest w przygotowaniu',text:'Wyszukiwanie w serwisie zostanie uruchomione wraz z kolejnymi funkcjami gracz.pl.',button:'Zamknij'},
    login:{title:'Logowanie nie jest jeszcze aktywne',text:'System kont użytkowników jest obecnie przygotowywany. Logowanie udostępnimy w kolejnym etapie rozwoju gracz.pl.',button:'Rozumiem'},
    register:{title:'Rejestracja nie jest jeszcze aktywna',text:'Możliwość zakładania kont zostanie uruchomiona po zakończeniu przygotowania systemu użytkowników gracz.pl.',button:'Rozumiem'},
    community:{title:'Funkcje społecznościowe są w przygotowaniu',text:'Profil gracza, turnieje i funkcje społecznościowe zostaną uruchomione w kolejnych etapach.',button:'Rozumiem'},
    forum:{title:'Forum gracz.pl jest w trakcie budowy',text:'Budujemy profesjonalne forum połączone z kontem gracza, wyszukiwarką i całym ekosystemem gracz.pl. Uruchomimy je po zakończeniu prac integracyjnych.',button:'Rozumiem'},
    rankings:{title:'Rankingi i statystyki są w przygotowaniu',text:'Rankingi, historia wyników i statystyki Warcabów pojawią się wraz z uruchomieniem rozgrywki online.',button:'Rozumiem'},
    multiplayer:{title:'Multiplayer jest w przygotowaniu',text:'Rozgrywka z innymi graczami zostanie uruchomiona po zakończeniu prac nad Warcabami online.',button:'Rozumiem'},
    play:{title:'Warcaby online są w przygotowaniu',text:'Gra online nie jest jeszcze aktywna. Ta strona przedstawia zasady, planszę i przygotowywany kierunek rozwoju Warcabów na gracz.pl.',button:'Rozumiem'},
    updates:{title:'Aktualności są w przygotowaniu',text:'Sekcję aktualności uruchomimy wraz z kolejnymi publicznymi funkcjami gracz.pl.',button:'Rozumiem'},
    newsletter:{title:'Newsletter jest w przygotowaniu',text:'Możliwość zapisu na informacje o nowych funkcjach uruchomimy w kolejnym etapie.',button:'Rozumiem'},
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
        closeMenus(item);setMenu(item,true);
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
  burger.addEventListener('click',function(){setPanel(!header.classList.contains('menu-open'));});
  mobile.addEventListener('change',function(){setPanel(false);});

  var modal=document.getElementById('modal');
  var modalTitle=document.getElementById('modal-title');
  var modalText=document.getElementById('modal-text');
  var modalOk=modal.querySelector('.modal-ok');
  var lastTrigger=null;

  function openModal(key,trigger){
    var msg=MESSAGES[key];
    if(!msg)return;
    lastTrigger=trigger||document.activeElement;
    closeMenus();setPanel(false);
    modalTitle.textContent=msg.title;
    modalText.textContent=msg.text;
    modalOk.textContent=msg.button;
    if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');
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
    else{modal.removeAttribute('open');onClosed();}
  }

  modal.addEventListener('close',onClosed);
  modal.addEventListener('cancel',function(e){e.preventDefault();closeModal();});
  modal.addEventListener('click',function(e){if(e.target===modal||e.target.closest('[data-close]'))closeModal();});
  document.addEventListener('click',function(e){
    var trigger=e.target.closest('[data-modal]');
    if(!trigger)return;
    e.preventDefault();
    openModal(trigger.getAttribute('data-modal'),trigger);
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape' && !modal.open){
      var openItem=menuItems.filter(function(i){return i.classList.contains('is-open');})[0];
      if(openItem){setMenu(openItem,false);var t=toggleOf(openItem);if(t)t.focus();}
      else if(header.classList.contains('menu-open')){setPanel(false);burger.focus();}
    }
  });


  /* WARCABY ACADEMY PREMIUM MAX R1 */
  var WARCABY_KEY='graczWarcabyAcademyProgressV1';
  var WARCABY_MODULES=['podstawy','bicie','seria','damka','strategia','quiz'];

  function readWarcabyProgress(){
    try{
      var raw=window.localStorage.getItem(WARCABY_KEY);
      var data=raw?JSON.parse(raw):{};
      WARCABY_MODULES.forEach(function(k){data[k]=!!data[k];});
      return data;
    }catch(e){return {podstawy:false,bicie:false,seria:false,damka:false,strategia:false,quiz:false};}
  }
  function saveWarcabyProgress(state){
    try{window.localStorage.setItem(WARCABY_KEY,JSON.stringify(state));}catch(e){}
  }
  var warcabyState=readWarcabyProgress();

  function renderWarcabyProgress(){
    var done=WARCABY_MODULES.filter(function(k){return warcabyState[k];}).length;
    var pct=Math.round(done/WARCABY_MODULES.length*100);
    var map=[
      ['[data-warcaby-percent]',pct+'%'],['[data-warcaby-done]',done],
      ['[data-warcaby-side-percent]',pct+'%'],['[data-warcaby-side-done]',done]
    ];
    map.forEach(function(item){var el=document.querySelector(item[0]);if(el)el.textContent=item[1];});
    var progress=document.querySelector('[data-warcaby-progress]');if(progress)progress.value=done;
    var sideBar=document.querySelector('[data-warcaby-side-bar]');if(sideBar)sideBar.value=done;
    var ring=document.querySelector('[data-warcaby-ring]');if(ring)ring.style.setProperty('--warcaby-pct',pct+'%');
    document.querySelectorAll('[data-warcaby-module]').forEach(function(btn){
      var key=btn.getAttribute('data-warcaby-module');
      var complete=!!warcabyState[key];
      btn.classList.toggle('is-done',complete);
      btn.setAttribute('aria-pressed',complete?'true':'false');
    });
    var labels={podstawy:'podstawy ruchu',bicie:'trener obowiązkowego bicia',seria:'wielokrotne bicie',damka:'laboratorium damki',strategia:'strategia i błędy',quiz:'quiz końcowy'};
    var next=document.querySelector('[data-warcaby-next]');
    var first=WARCABY_MODULES.filter(function(k){return !warcabyState[k];})[0];
    if(next)next.textContent=first?'Następny krok: '+labels[first]:'Ścieżka ukończona — możesz powtarzać dowolny moduł.';
    GA.refresh();
  }
  function completeWarcaby(key){
    if(WARCABY_MODULES.indexOf(key)<0)return;
    warcabyState[key]=true;
    saveWarcabyProgress(warcabyState);
    renderWarcabyProgress();
  }
  function toggleWarcaby(key){
    if(WARCABY_MODULES.indexOf(key)<0)return;
    warcabyState[key]=!warcabyState[key];
    saveWarcabyProgress(warcabyState);
    renderWarcabyProgress();
  }
  function warcabyScroll(target){
    if(!target)return;
    var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  }
  renderWarcabyProgress();

  document.addEventListener('click',function(e){
    var hero=e.target.closest('[data-scroll-warcaby-academy]');
    if(hero){e.preventDefault();warcabyScroll(document.getElementById('warcaby-academy'));}

    var moduleBtn=e.target.closest('[data-warcaby-module]');
    if(moduleBtn){
      var key=moduleBtn.getAttribute('data-warcaby-module');
      var targets={podstawy:'#zasady',bicie:'#trener-bicia',seria:'#multi-capture',damka:'#damka-lab',strategia:'#strategia-warcaby',quiz:'#quiz-warcaby'};
      warcabyScroll(document.querySelector(targets[key]));
    }
  });

  var reset=document.querySelector('[data-warcaby-reset]');
  if(reset){
    reset.addEventListener('click',function(){
      warcabyState={podstawy:false,bicie:false,seria:false,damka:false,strategia:false,quiz:false};
      saveWarcabyProgress(warcabyState);renderWarcabyProgress();
    });
  }

  var captureScenarios=[
    {topic:'Obowiązek bicia',title:'Masz możliwość przeskoczenia pionka przeciwnika',text:'Czy możesz zamiast tego przesunąć inny pionek o jedno pole?',actions:['Tak','Nie'],correct:'Nie',explain:'Jeżeli istnieje legalne bicie, zwykły ruch jest niedozwolony.'},
    {topic:'Wybór bicia',title:'Dwa Twoje pionki mogą bić',text:'Czy wolno wybrać jedno z legalnych bić?',actions:['Tak','Nie'],correct:'Tak',explain:'W wariancie gracz.pl możesz wybrać dowolne legalne bicie; nie ma obowiązku wybierania najdłuższej sekwencji.'},
    {topic:'Dalszy skok',title:'Po pierwszym biciu ta sama bierka może bić jeszcze raz',text:'Czy możesz zakończyć turę?',actions:['Tak','Nie'],correct:'Nie',explain:'Jeśli ta sama bierka ma kolejne legalne bicie, musisz kontynuować sekwencję.'}
  ];
  var trainer=document.querySelector('[data-capture-trainer]');
  if(trainer){
    var ci=0,cs=0,locked=false;
    var idx=trainer.querySelector('[data-capture-index]');
    var topic=trainer.querySelector('[data-capture-topic]');
    var titleEl=trainer.querySelector('[data-capture-title]');
    var textEl=trainer.querySelector('[data-capture-text]');
    var actions=trainer.querySelector('[data-capture-actions]');
    var feedback=trainer.querySelector('[data-capture-feedback]');
    var score=trainer.querySelector('[data-capture-score]');
    var next=trainer.querySelector('[data-capture-next]');
    var restart=trainer.querySelector('[data-capture-restart]');
    function renderCapture(){
      var s=captureScenarios[ci];locked=false;
      idx.textContent=ci+1;topic.textContent=s.topic;titleEl.textContent=s.title;textEl.textContent=s.text;
      actions.innerHTML='';
      s.actions.forEach(function(a){var b=document.createElement('button');b.type='button';b.textContent=a;b.setAttribute('data-capture-choice',a);actions.appendChild(b);});
      feedback.textContent='Wybierz odpowiedź.';next.disabled=true;next.textContent=ci===captureScenarios.length-1?'Zakończ sesję':'Następna sytuacja';
    }
    renderCapture();
    actions.addEventListener('click',function(e){
      var btn=e.target.closest('[data-capture-choice]');if(!btn||locked)return;locked=true;
      var s=captureScenarios[ci],ok=btn.getAttribute('data-capture-choice')===s.correct;
      btn.classList.add(ok?'is-correct':'is-wrong');
      Array.prototype.forEach.call(actions.querySelectorAll('button'),function(b){if(b.getAttribute('data-capture-choice')===s.correct)b.classList.add('is-correct');});
      if(ok){cs++;score.textContent=cs;}
      feedback.textContent=(ok?'Dobrze. ':'Nie tym razem. ')+s.explain;
      next.disabled=false;
      if(ci===captureScenarios.length-1){
        var need=GA.passMark(captureScenarios.length);
        if(cs>=need)completeWarcaby('bicie');
        else feedback.textContent+=' Wynik sesji: '+cs+' / '+captureScenarios.length+' — do zaliczenia kroku potrzeba co najmniej '+need+'. Zacznij od początku.';
      }
    });
    GA.status(trainer,function(){return warcabyState.bicie?'Krok zaliczony.':'Zaliczenie kroku: ukończ sesję z wynikiem co najmniej '+GA.passMark(captureScenarios.length)+' z '+captureScenarios.length+'.';});
    next.addEventListener('click',function(){
      if(ci<captureScenarios.length-1){ci++;renderCapture();}
      else{feedback.textContent='Sesja zakończona. Wynik: '+cs+' / '+captureScenarios.length+'.';next.disabled=true;}
    });
    restart.addEventListener('click',function(){ci=0;cs=0;score.textContent='0';renderCapture();});
  }

  var seq=document.querySelector('[data-multi-capture]');
  if(seq){
    var sequenceStep=1;
    var stepEl=seq.querySelector('[data-sequence-step]');
    var titleSeq=seq.querySelector('[data-sequence-title]');
    var textSeq=seq.querySelector('[data-sequence-text]');
    var nextSeq=seq.querySelector('[data-sequence-next]');
    var resetSeq=seq.querySelector('[data-sequence-reset]');
    var nodes=Array.prototype.slice.call(seq.querySelectorAll('.sequence-node'));
    var sequence=[
      ['Pierwsze bicie','Przeskocz pierwszy pionek przeciwnika.'],
      ['Sprawdź dalsze bicie','Ta sama bierka ma kolejny legalny skok — tura trwa.'],
      ['Zakończ sekwencję','Po ostatnim skoku nie ma dalszego bicia, więc tura się kończy.']
    ];
    function renderSequence(){
      stepEl.textContent=sequenceStep;titleSeq.textContent=sequence[sequenceStep-1][0];textSeq.textContent=sequence[sequenceStep-1][1];
      nodes.forEach(function(n,i){n.classList.toggle('is-active',i===sequenceStep-1);n.classList.toggle('is-done',i<sequenceStep-1);});
      nextSeq.textContent=sequenceStep===3?'Zakończ moduł':'Wykonaj krok';
    }
    nextSeq.addEventListener('click',function(){
      if(sequenceStep<3){sequenceStep++;renderSequence();}
      else{completeWarcaby('seria');textSeq.textContent='Moduł ukończony: sekwencję bicia prowadzisz tą samą bierką do końca.';}
    });
    resetSeq.addEventListener('click',function(){sequenceStep=1;renderSequence();});
    GA.status(seq,function(){return warcabyState.seria?'Krok zaliczony.':'Zaliczenie kroku: przejdź wszystkie trzy kroki sekwencji bicia.';});
  }

  var damka=document.querySelector('[data-damka-lab]');
  if(damka){
    var info={
      ruch:['Ruch damki','Damka może przesuwać się po przekątnej o dowolną liczbę wolnych pól.'],
      kierunki:['Oba kierunki','Damka porusza się i bije zarówno do przodu, jak i do tyłu.'],
      bicie:['Bicie damką','Przeskakuje nad jedną bierką przeciwnika i może lądować na wolnym polu dalej na tej samej przekątnej.'],
      awans:['Awans w trakcie serii','Jeśli pionek podczas bicia dociera do ostatniego rzędu, natychmiast staje się damką i może kontynuować dalsze bicie jako damka.']
    };
    var result=damka.querySelector('[data-damka-result]');
    damka.addEventListener('click',function(e){
      var btn=e.target.closest('[data-damka]');if(!btn)return;
      Array.prototype.forEach.call(damka.querySelectorAll('[data-damka]'),function(b){b.classList.toggle('is-active',b===btn);});
      var d=info[btn.getAttribute('data-damka')];
      result.innerHTML='<strong>'+d[0]+'</strong><span>'+d[1]+'</span>';
    });
    GA.explore({root:damka,items:'[data-damka]',attr:'data-damka',isDone:function(){return warcabyState.damka;},done:function(){completeWarcaby('damka');}});
  }

  var quiz=document.querySelector('[data-warcaby-quiz]');
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
      var result=quiz.querySelector('[data-warcaby-quiz-result]');
      var strong=result.querySelector('strong'),span=result.querySelector('span');
      if(answered<fields.length){strong.textContent='Odpowiedz na wszystkie pytania.';span.textContent='Brakuje '+(fields.length-answered)+' odpowiedzi.';return;}
      strong.textContent='Wynik: '+points+' / '+fields.length;
      span.textContent=points===5?'Świetnie — fundamenty Warcabów masz opanowane.':points>=3?'Dobry wynik. Wróć do pytań oznaczonych na czerwono.':'Warto przejść ścieżkę Academy jeszcze raz.';
      if(points>=4)completeWarcaby('quiz');
    });
  }

  // Reading-only steps have no exercise: scrolling past never completes them; the learner confirms explicitly.
  GA.mark({sectionId:'zasady',key:'podstawy',label:'Podstawy',isDone:function(){return warcabyState.podstawy;},toggle:function(){toggleWarcaby('podstawy');}});
  GA.mark({sectionId:'strategia-warcaby',key:'strategia',label:'Strategia',isDone:function(){return warcabyState.strategia;},toggle:function(){toggleWarcaby('strategia');}});

  var topLinks=Array.prototype.slice.call(document.querySelectorAll('[data-warcaby-section-nav] a[href^="#"]'));
  var sideLinks=Array.prototype.slice.call(document.querySelectorAll('.warcaby-side-nav a[href^="#"]'));
  var allLinks=topLinks.concat(sideLinks);
  var targetMap={};
  allLinks.forEach(function(link){var target=document.querySelector(link.getAttribute('href'));if(target)targetMap[target.id]=target;});
  var targetList=Object.keys(targetMap).map(function(id){return targetMap[id];});
  function setWarcabyCurrent(id){
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
      setWarcabyCurrent(ids[0]);
    },{rootMargin:'-120px 0px -64% 0px',threshold:[0,.01,.2]});
    targetList.forEach(function(target){navObserver.observe(target);});
  }

  var newsletter=document.querySelector('[data-newsletter]');
  if(newsletter){
    newsletter.addEventListener('submit',function(e){e.preventDefault();openModal('newsletter',newsletter.querySelector('button'));});
  }

})();