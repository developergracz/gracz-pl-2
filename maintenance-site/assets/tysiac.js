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

})();