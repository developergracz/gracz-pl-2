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


  var bidTrainer=document.querySelector('[data-bid-trainer]');
  if(bidTrainer){
    var bidFeedback=bidTrainer.querySelector('[data-bid-feedback]');
    bidTrainer.addEventListener('click',function(e){
      var button=e.target.closest('[data-bid-choice]');
      if(!button)return;
      Array.prototype.forEach.call(bidTrainer.querySelectorAll('[data-bid-choice]'),function(b){b.classList.remove('is-correct','is-wrong');});
      var choice=button.getAttribute('data-bid-choice');
      if(choice==='120'){
        button.classList.add('is-correct');
        bidFeedback.innerHTML='<strong>Rozsądna decyzja treningowa.</strong> Masz dwa asy i meldunek pik, więc niewielkie podbicie do 120 ma logiczne uzasadnienie. To komentarz edukacyjny, nie automatyczna recepta dla każdej partii.';
      }else if(choice==='140'){
        button.classList.add('is-wrong');
        bidFeedback.innerHTML='<strong>To już agresywna licytacja.</strong> Ręka ma potencjał, ale 140 przed zobaczeniem musiku zwiększa ryzyko. W praktyce trzeba uwzględnić wynik partii i zachowanie przeciwników.';
      }else{
        button.classList.add('is-wrong');
        bidFeedback.innerHTML='<strong>Pas jest bardzo zachowawczy.</strong> Przy dwóch asach i gotowym meldunku pik ręka ma wyraźny potencjał do dalszej licytacji.';
      }
    });
  }

  var playTrainer=document.querySelector('[data-play-trainer]');
  if(playTrainer){
    var playFeedback=playTrainer.querySelector('[data-play-feedback]');
    playTrainer.addEventListener('click',function(e){
      var button=e.target.closest('[data-play-choice]');
      if(!button)return;
      Array.prototype.forEach.call(playTrainer.querySelectorAll('[data-play-choice]'),function(b){b.classList.remove('is-correct','is-wrong');});
      var choice=button.getAttribute('data-play-choice');
      if(choice==='ac'){
        button.classList.add('is-correct');
        playFeedback.innerHTML='<strong>Poprawnie: A♣.</strong> Masz kolor wyjścia, więc musisz zagrać trefl. Ponieważ możesz przebić aktualnie wygrywającego K♣ asem, obowiązek przebicia wskazuje A♣.';
      }else{
        button.classList.add('is-wrong');
        playFeedback.innerHTML='<strong>Nie w tej sytuacji.</strong> Masz trefle i wśród nich kartę, która przebija K♣. Dlatego zgodnie z opisanym wariantem musisz zagrać A♣.';
      }
    });
  }

  var calculator=document.querySelector('[data-score-calculator]');
  if(calculator){
    var cardInput=calculator.querySelector('[data-card-points]');
    var meldInput=calculator.querySelector('[data-meld-points]');
    var contractInput=calculator.querySelector('[data-contract]');
    var declarerInput=calculator.querySelector('[data-is-declarer]');
    var calcButton=calculator.querySelector('[data-calc]');
    var calcResult=calculator.querySelector('[data-calc-result]');

    function clampNumber(value,min,max){
      var n=Number(value);
      if(!Number.isFinite(n))n=min;
      return Math.min(max,Math.max(min,n));
    }

    calcButton.addEventListener('click',function(){
      var cards=clampNumber(cardInput.value,0,120);
      var melds=clampNumber(meldInput.value,0,280);
      var contract=clampNumber(contractInput.value,100,360);
      var total=cards+melds;
      var declarer=declarerInput.checked;
      var score;
      var title;

      if(declarer){
        var made=total>=contract;
        score=made?contract:-contract;
        title=made?'Kontrakt wykonany':'Kontrakt niewykonany';
        calcResult.innerHTML='<strong>'+title+': '+(score>0?'+':'')+score+' pkt do wyniku</strong><span>Zdobyte w rozdaniu: '+total+' pkt. Zadeklarowany kontrakt: '+contract+' pkt.</span>';
      }else{
        score=Math.round(total/10)*10;
        calcResult.innerHTML='<strong>Wynik przeciwnika: '+score+' pkt</strong><span>Zdobyte w rozdaniu: '+total+' pkt, zaokrąglone do najbliższej dziesiątki.</span>';
      }
    });
  }

})();