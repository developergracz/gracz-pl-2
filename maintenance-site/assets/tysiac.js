(function(){
  'use strict';

  var MESSAGES={
    search:{title:'Wyszukiwarka jest w przygotowaniu',text:'Wyszukiwanie w serwisie zostanie uruchomione wraz z kolejnymi funkcjami gracz.pl.',button:'Zamknij'},
    login:{title:'Logowanie nie jest jeszcze aktywne',text:'System kont użytkowników jest obecnie przygotowywany. Logowanie udostępnimy w kolejnym etapie rozwoju gracz.pl.',button:'Rozumiem'},
    register:{title:'Rejestracja nie jest jeszcze aktywna',text:'Możliwość zakładania kont zostanie uruchomiona po zakończeniu przygotowania systemu użytkowników gracz.pl.',button:'Rozumiem'},
    community:{title:'Funkcje społecznościowe są w przygotowaniu',text:'Profil gracza, turnieje i funkcje społecznościowe zostaną uruchomione w kolejnych etapach.',button:'Rozumiem'},
    rankings:{title:'Rankingi i statystyki są w przygotowaniu',text:'Rankingi, historia wyników i statystyki Tysiąca pojawią się wraz z uruchomieniem rozgrywki online.',button:'Rozumiem'},
    multiplayer:{title:'Multiplayer jest w przygotowaniu',text:'Rozgrywka z innymi graczami zostanie uruchomiona po zakończeniu prac nad Tysiącem online.',button:'Rozumiem'},
    play:{title:'Tysiąc online jest w przygotowaniu',text:'Gra online nie jest jeszcze aktywna. Ta podstrona przedstawia Tysiąca, jego zasady i przygotowywany kierunek rozwoju gry online na gracz.pl.',button:'Rozumiem'},
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


  var variantLab=document.querySelector('[data-player-variant]');
  if(variantLab){
    var variantData={
      2:{hand:'11 kart',talon:'2 karty',after:'po 11 kart',note:'Rozgrywający odrzuca 2 karty po przejęciu musiku.'},
      3:{hand:'7 kart',talon:'3 karty',after:'po 8 kart',note:'Rozgrywający przekazuje po 1 karcie każdemu przeciwnikowi.'},
      4:{hand:'5 kart',talon:'4 karty',after:'po 6 kart',note:'Rozgrywający przekazuje po 1 karcie każdemu z 3 przeciwników.'}
    };
    variantLab.addEventListener('click',function(e){
      var button=e.target.closest('[data-players]');
      if(!button)return;
      var players=button.getAttribute('data-players');
      var data=variantData[players];
      if(!data)return;
      Array.prototype.forEach.call(variantLab.querySelectorAll('[data-players]'),function(b){b.classList.toggle('is-active',b===button);});
      variantLab.querySelector('[data-variant-hand]').textContent=data.hand;
      variantLab.querySelector('[data-variant-talon]').textContent=data.talon;
      variantLab.querySelector('[data-variant-after]').textContent=data.after;
      variantLab.querySelector('[data-variant-note]').textContent=data.note;
    });
  }

  var marriageLab=document.querySelector('[data-marriage-lab]');
  if(marriageLab){
    var marriageNames={
      spades:{name:'pik',points:40,symbol:'♠'},
      clubs:{name:'trefl',points:60,symbol:'♣'},
      diamonds:{name:'karo',points:80,symbol:'♦'},
      hearts:{name:'kier',points:100,symbol:'♥'}
    };
    var marriageResult=marriageLab.querySelector('[data-marriage-result]');
    marriageLab.addEventListener('click',function(e){
      var button=e.target.closest('[data-marriage]');
      if(!button)return;
      var key=button.getAttribute('data-marriage');
      var item=marriageNames[key];
      if(!item)return;
      Array.prototype.forEach.call(marriageLab.querySelectorAll('[data-marriage]'),function(b){b.setAttribute('aria-pressed',b===button?'true':'false');});
      marriageResult.innerHTML='<strong>'+item.symbol+' '+item.name.charAt(0).toUpperCase()+item.name.slice(1)+': '+item.points+' pkt.</strong> Zgłoszony kolor staje się aktualnym atutem.';
    });
  }

  var legalTrainer=document.querySelector('[data-legal-trainer]');
  if(legalTrainer){
    var legalFeedback=legalTrainer.querySelector('[data-legal-feedback]');
    legalTrainer.addEventListener('click',function(e){
      var button=e.target.closest('[data-card-choice]');
      if(!button)return;
      Array.prototype.forEach.call(legalTrainer.querySelectorAll('[data-card-choice]'),function(b){b.classList.remove('is-correct','is-wrong');});
      if(button.getAttribute('data-card-choice')==='ac'){
        button.classList.add('is-correct');
        legalFeedback.innerHTML='<strong>Poprawnie: A♣.</strong> Masz kolor wyjścia i kartę, która przebija aktualnie wygrywającego K♣, więc musisz zagrać A♣.';
      }else{
        button.classList.add('is-wrong');
        legalFeedback.innerHTML='<strong>Nie w tej sytuacji.</strong> Masz trefle, a A♣ przebija K♣. Obowiązek koloru i przebicia wskazuje A♣.';
      }
    });
  }

  var scoreLab=document.querySelector('[data-score-lab]');
  if(scoreLab){
    var cardsInput=scoreLab.querySelector('[data-score-cards]');
    var marriagesInput=scoreLab.querySelector('[data-score-marriages]');
    var contractInput=scoreLab.querySelector('[data-score-contract]');
    var declarerInput=scoreLab.querySelector('[data-score-declarer]');
    var scoreButton=scoreLab.querySelector('[data-score-calc]');
    var scoreOutput=scoreLab.querySelector('[data-score-output]');

    function clampNumber(value,min,max){
      var n=Number(value);
      if(!Number.isFinite(n))n=min;
      return Math.min(max,Math.max(min,n));
    }

    scoreButton.addEventListener('click',function(){
      var cards=Math.round(clampNumber(cardsInput.value,0,120));
      var marriages=Math.round(clampNumber(marriagesInput.value,0,280));
      var contract=Math.round(clampNumber(contractInput.value,100,360));
      cardsInput.value=String(cards);
      marriagesInput.value=String(marriages);
      contractInput.value=String(contract);

      if(contract%10!==0){
        scoreOutput.innerHTML='<strong>Kontrakt musi być wielokrotnością 10.</strong><span>Wpisz wartość od 100 do 360, np. 120, 130 lub 140.</span>';
        contractInput.focus();
        return;
      }

      var total=cards+marriages;
      if(declarerInput.checked){
        var made=total>=contract;
        var delta=made?contract:-contract;
        scoreOutput.innerHTML='<strong>'+(made?'Kontrakt wykonany: +':'Kontrakt niewykonany: ')+delta+' pkt</strong><span>Zdobyte w rozdaniu: '+total+' pkt. Kontrakt: '+contract+' pkt.</span>';
      }else{
        var rounded=Math.round(total/10)*10;
        scoreOutput.innerHTML='<strong>Wynik przeciwnika: '+rounded+' pkt</strong><span>Zdobyte w rozdaniu: '+total+' pkt, zaokrąglone do najbliższej dziesiątki.</span>';
      }
    });
  }



  /* TYSIAC ACADEMY PREMIUM MAX R1 */
  var TYSIAC_ACADEMY_KEY='graczTysiacAcademyProgressV1';
  var TYSIAC_MODULES=['zasady','licytacja','meldunki','ruch','punktacja','quiz'];

  function readTysiacAcademy(){
    try{
      var raw=window.localStorage.getItem(TYSIAC_ACADEMY_KEY);
      var data=raw?JSON.parse(raw):{};
      TYSIAC_MODULES.forEach(function(k){data[k]=!!data[k];});
      return data;
    }catch(e){
      return {zasady:false,licytacja:false,meldunki:false,ruch:false,punktacja:false,quiz:false};
    }
  }
  function writeTysiacAcademy(state){
    try{window.localStorage.setItem(TYSIAC_ACADEMY_KEY,JSON.stringify(state));}catch(e){}
  }
  var tysiacAcademyState=readTysiacAcademy();

  function renderTysiacAcademy(){
    var done=TYSIAC_MODULES.filter(function(k){return tysiacAcademyState[k];}).length;
    var pct=Math.round((done/TYSIAC_MODULES.length)*100);
    var percent=document.querySelector('[data-tysiac-percent]');
    var count=document.querySelector('[data-tysiac-done]');
    var progress=document.querySelector('[data-tysiac-progress]');
    var sidePercent=document.querySelector('[data-tysiac-side-percent]');
    var sideDone=document.querySelector('[data-tysiac-side-done]');
    var sideBar=document.querySelector('[data-tysiac-side-bar]');
    var ring=document.querySelector('[data-tysiac-ring]');
    if(percent)percent.textContent=pct+'%';
    if(count)count.textContent=done;
    if(progress)progress.value=done;
    if(sidePercent)sidePercent.textContent=pct+'%';
    if(sideDone)sideDone.textContent=done;
    if(sideBar)sideBar.value=done;
    if(ring)ring.style.setProperty('--tysiac-pct',pct+'%');

    document.querySelectorAll('[data-tysiac-module]').forEach(function(btn){
      var key=btn.getAttribute('data-tysiac-module');
      var complete=!!tysiacAcademyState[key];
      btn.classList.toggle('is-done',complete);
      btn.setAttribute('aria-pressed',complete?'true':'false');
    });

    var next=document.querySelector('[data-tysiac-next]');
    if(next){
      var labels={zasady:'Fundament gry',licytacja:'Trener licytacji',meldunki:'Meldunki i atut',ruch:'Legalny ruch',punktacja:'Kalkulator punktów',quiz:'Quiz końcowy'};
      var first=TYSIAC_MODULES.filter(function(k){return !tysiacAcademyState[k];})[0];
      next.textContent=first?'Następny krok: '+labels[first]:'Ścieżka ukończona — możesz powtarzać dowolny moduł.';
    }
  }
  function completeTysiacModule(key){
    if(TYSIAC_MODULES.indexOf(key)<0)return;
    tysiacAcademyState[key]=true;
    writeTysiacAcademy(tysiacAcademyState);
    renderTysiacAcademy();
  }
  renderTysiacAcademy();

  function tysiacScroll(target){
    if(!target)return;
    var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  }

  document.addEventListener('click',function(e){
    var tracked=e.target.closest('[data-track-tysiac]');
    if(tracked)completeTysiacModule(tracked.getAttribute('data-track-tysiac'));

    var moduleButton=e.target.closest('[data-tysiac-module]');
    if(moduleButton){
      var key=moduleButton.getAttribute('data-tysiac-module');
      var map={zasady:'#tysiac-5-minut',licytacja:'#trener-licytacji',meldunki:'#meldunki-lab',ruch:'#legalny-ruch',punktacja:'#kalkulator-tysiac',quiz:'#quiz-tysiac'};
      tysiacScroll(document.querySelector(map[key]));
    }

    var academyButton=e.target.closest('[data-scroll-tysiac-academy]');
    if(academyButton){
      e.preventDefault();
      tysiacScroll(document.getElementById('tysiac-academy'));
    }
  });

  var tysiacReset=document.querySelector('[data-tysiac-reset]');
  if(tysiacReset){
    tysiacReset.addEventListener('click',function(){
      tysiacAcademyState={zasady:false,licytacja:false,meldunki:false,ruch:false,punktacja:false,quiz:false};
      writeTysiacAcademy(tysiacAcademyState);
      renderTysiacAcademy();
    });
  }

  // Existing interactive labs count toward the Academy path.
  if(variantLab){
    variantLab.addEventListener('click',function(e){
      if(e.target.closest('[data-players]'))completeTysiacModule('zasady');
    });
  }
  if(marriageLab){
    marriageLab.addEventListener('click',function(e){
      if(e.target.closest('[data-marriage]'))completeTysiacModule('meldunki');
    });
  }
  if(legalTrainer){
    legalTrainer.addEventListener('click',function(e){
      if(e.target.closest('[data-card-choice]'))completeTysiacModule('ruch');
    });
  }
  if(scoreLab){
    var academyScoreButton=scoreLab.querySelector('[data-score-calc]');
    if(academyScoreButton)academyScoreButton.addEventListener('click',function(){completeTysiacModule('punktacja');});
  }

  var biddingScenarios=[
    {
      topic:'Minimalne przebicie',
      title:'Aktualna oferta wynosi 120',
      text:'Jaka jest najmniejsza legalna kolejna oferta?',
      actions:['120','125','130','140'],
      correct:'130',
      explain:'Każda kolejna oferta musi przebić aktualną co najmniej o 10 punktów i być wielokrotnością 10.'
    },
    {
      topic:'Górna granica',
      title:'Aktualna oferta wynosi 350',
      text:'Która z tych ofert jest jeszcze legalna?',
      actions:['355','360','370','400'],
      correct:'360',
      explain:'W wariancie gracz.pl maksymalna oferta to 360 punktów, a oferty są wielokrotnościami 10.'
    },
    {
      topic:'Pas',
      title:'Wcześniej spasowałeś',
      text:'Czy możesz wrócić do licytacji w tym samym rozdaniu?',
      actions:['Tak','Nie'],
      correct:'Nie',
      explain:'Pas wyłącza gracza z dalszej licytacji w tym rozdaniu.'
    }
  ];
  var biddingLab=document.querySelector('[data-bidding-lab]');
  if(biddingLab){
    var bidIndex=0,bidScore=0,bidLocked=false;
    var bidIndexEl=biddingLab.querySelector('[data-bid-index]');
    var bidTopicEl=biddingLab.querySelector('[data-bid-topic]');
    var bidTitleEl=biddingLab.querySelector('[data-bid-title]');
    var bidTextEl=biddingLab.querySelector('[data-bid-text]');
    var bidActionsEl=biddingLab.querySelector('[data-bid-actions]');
    var bidFeedbackEl=biddingLab.querySelector('[data-bid-feedback]');
    var bidScoreEl=biddingLab.querySelector('[data-bid-score]');
    var bidNext=biddingLab.querySelector('[data-bid-next]');
    var bidRestart=biddingLab.querySelector('[data-bid-restart]');

    function renderBid(){
      var s=biddingScenarios[bidIndex];
      bidLocked=false;
      bidIndexEl.textContent=bidIndex+1;
      bidTopicEl.textContent=s.topic;
      bidTitleEl.textContent=s.title;
      bidTextEl.textContent=s.text;
      bidActionsEl.innerHTML='';
      s.actions.forEach(function(action){
        var b=document.createElement('button');
        b.type='button';
        b.textContent=action;
        b.setAttribute('data-bid-choice',action);
        bidActionsEl.appendChild(b);
      });
      bidFeedbackEl.textContent='Wybierz odpowiedź.';
      bidNext.disabled=true;
      bidNext.textContent=bidIndex===biddingScenarios.length-1?'Zakończ sesję':'Następny scenariusz';
    }
    renderBid();

    bidActionsEl.addEventListener('click',function(e){
      var btn=e.target.closest('[data-bid-choice]');
      if(!btn||bidLocked)return;
      bidLocked=true;
      var s=biddingScenarios[bidIndex];
      var ok=btn.getAttribute('data-bid-choice')===s.correct;
      btn.classList.add(ok?'is-correct':'is-wrong');
      Array.prototype.forEach.call(bidActionsEl.querySelectorAll('button'),function(b){
        if(b.getAttribute('data-bid-choice')===s.correct)b.classList.add('is-correct');
      });
      if(ok){bidScore++;bidScoreEl.textContent=bidScore;}
      bidFeedbackEl.textContent=(ok?'Dobrze. ':'Nie tym razem. ')+s.explain;
      bidNext.disabled=false;
      completeTysiacModule('licytacja');
    });
    bidNext.addEventListener('click',function(){
      if(bidIndex<biddingScenarios.length-1){bidIndex++;renderBid();}
      else{bidFeedbackEl.textContent='Sesja zakończona. Wynik: '+bidScore+' / '+biddingScenarios.length+'.';bidNext.disabled=true;}
    });
    bidRestart.addEventListener('click',function(){bidIndex=0;bidScore=0;bidScoreEl.textContent='0';renderBid();});
  }

  var tysiacQuiz=document.querySelector('[data-tysiac-quiz]');
  if(tysiacQuiz){
    tysiacQuiz.addEventListener('submit',function(e){
      e.preventDefault();
      var fields=Array.prototype.slice.call(tysiacQuiz.querySelectorAll('fieldset[data-answer]'));
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
      var result=tysiacQuiz.querySelector('[data-tysiac-quiz-result]');
      var strong=result.querySelector('strong');
      var span=result.querySelector('span');
      if(answered<fields.length){
        strong.textContent='Odpowiedz na wszystkie pytania.';
        span.textContent='Brakuje '+(fields.length-answered)+' odpowiedzi.';
        return;
      }
      strong.textContent='Wynik: '+score+' / '+fields.length;
      span.textContent=score===5?'Świetnie — fundamenty Tysiąca masz opanowane.':score>=3?'Dobry wynik. Wróć do pytań oznaczonych na czerwono.':'Warto wrócić do ścieżki Academy i spróbować ponownie.';
      if(score>=4)completeTysiacModule('quiz');
    });
  }

  // Highlight current chapter in top and side navigation.
  var topTysiacLinks=Array.prototype.slice.call(document.querySelectorAll('[data-tysiac-section-nav] a[href^="#"]'));
  var sideTysiacLinks=Array.prototype.slice.call(document.querySelectorAll('.tysiac-side-nav a[href^="#"]'));
  var allTysiacLinks=topTysiacLinks.concat(sideTysiacLinks);
  var targetMap={};
  allTysiacLinks.forEach(function(link){
    var target=document.querySelector(link.getAttribute('href'));
    if(target)targetMap[target.id]=target;
  });
  var targetList=Object.keys(targetMap).map(function(id){return targetMap[id];});
  function setTysiacCurrent(id){
    allTysiacLinks.forEach(function(link){
      var current=link.getAttribute('href')==='#'+id;
      link.classList.toggle('is-current',current);
      if(current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
    });
  }
  if(targetList.length && 'IntersectionObserver' in window){
    var visibleTysiac={};
    var tysiacObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting)visibleTysiac[entry.target.id]=entry.boundingClientRect.top;
        else delete visibleTysiac[entry.target.id];
      });
      var ids=Object.keys(visibleTysiac);
      if(!ids.length)return;
      ids.sort(function(a,b){return Math.abs(visibleTysiac[a])-Math.abs(visibleTysiac[b]);});
      setTysiacCurrent(ids[0]);
    },{rootMargin:'-120px 0px -64% 0px',threshold:[0,.01,.2]});
    targetList.forEach(function(target){tysiacObserver.observe(target);});
  }

})();