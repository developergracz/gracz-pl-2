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


  var finder=document.querySelector('[data-game-finder]');
  if(finder){
    var state={info:null,mechanic:null,focus:null};
    var result=finder.querySelector('[data-finder-result]');
    var profiles=[
      {name:'Poker treningowy',href:'/gry/poker-treningowy/',tags:{info:'hidden',mechanic:'cards',focus:'calculation'},why:'Niepełna informacja, pozycja i decyzje przy ryzyku sprawiają, że poker pasuje do osób lubiących analizować możliwe scenariusze.'},
      {name:'Tysiąc',href:'/gry/tysiac/',tags:{info:'hidden',mechanic:'cards',focus:'calculation'},why:'Licytacja, kontrakt, meldunki i liczenie punktów łączą ocenę ręki z planowaniem kolejnych lew.'},
      {name:'Warcaby',href:'/gry/warcaby/',tags:{info:'open',mechanic:'board',focus:'tactics'},why:'Cała pozycja jest jawna, a kluczowe są wymuszone bicia, sekwencje skoków i ocena skutków kolejnych ruchów.'},
      {name:'Gomoku',href:'/gry/gomoku/',tags:{info:'open',mechanic:'board',focus:'tactics'},why:'Jawna plansza, budowanie gróźb i blokowanie przeciwnika premiują planowanie przestrzenne i przewidywanie odpowiedzi.'}
    ];

    function score(profile){
      var points=0;
      Object.keys(state).forEach(function(key){
        if(state[key] && profile.tags[key]===state[key])points+=1;
      });
      return points;
    }

    function renderFinder(){
      var chosen=Object.keys(state).filter(function(k){return state[k];}).length;
      if(!chosen){
        result.innerHTML='<h3>Zaznacz preferencje</h3><p>Po wyborze cech pokażemy pasujące gry i wyjaśnimy, dlaczego.</p>';
        return;
      }
      var ranked=profiles.map(function(p){return {profile:p,score:score(p)};}).sort(function(a,b){return b.score-a.score;});
      var top=ranked[0].score;
      var matches=ranked.filter(function(item){return item.score===top;});
      var html='<h3>'+(matches.length===1?'Najbliższe dopasowanie':'Pasujące gry')+'</h3><ul>';
      matches.forEach(function(item){
        html+='<li><strong>'+item.profile.name+'</strong> — '+item.profile.why+'</li>';
      });
      html+='</ul>';
      if(matches.length===1)html+='<a href="'+matches[0].profile.href+'">Otwórz '+matches[0].profile.name+' →</a>';
      result.innerHTML=html;
    }

    finder.addEventListener('click',function(e){
      var option=e.target.closest('[data-filter-key]');
      if(option){
        var key=option.getAttribute('data-filter-key');
        var value=option.getAttribute('data-filter-value');
        state[key]=(state[key]===value)?null:value;
        Array.prototype.forEach.call(finder.querySelectorAll('[data-filter-key="'+key+'"]'),function(btn){
          btn.classList.toggle('is-active',btn===option && state[key]===value);
          btn.setAttribute('aria-pressed',btn===option && state[key]===value?'true':'false');
        });
        renderFinder();
        return;
      }
      if(e.target.closest('[data-finder-reset]')){
        state={info:null,mechanic:null,focus:null};
        Array.prototype.forEach.call(finder.querySelectorAll('[data-filter-key]'),function(btn){
          btn.classList.remove('is-active');
          btn.setAttribute('aria-pressed','false');
        });
        renderFinder();
      }
    });

    Array.prototype.forEach.call(finder.querySelectorAll('[data-filter-key]'),function(btn){btn.setAttribute('aria-pressed','false');});
  }



  var hubQuiz=document.querySelector('[data-game-hub-quiz]');
  var compareRoot=document.querySelector('[data-game-compare]');
  if(hubQuiz || compareRoot){
    fetch('/assets/games-hub-data.json',{credentials:'same-origin'})
      .then(function(response){
        if(!response.ok)throw new Error('catalog');
        return response.json();
      })
      .then(function(catalog){
        var games=Array.isArray(catalog.games)?catalog.games:[];
        if(hubQuiz)initHubQuiz(games);
        if(compareRoot)initCompare(games);
      })
      .catch(function(){
        if(hubQuiz){
          var result=hubQuiz.querySelector('[data-quiz-result]');
          if(result)result.innerHTML='<span class="recommendation-label">Twoja rekomendacja</span><h2>Katalog jest chwilowo niedostępny</h2><p>Możesz nadal otworzyć jedną z czterech gier poniżej.</p>';
        }
      });
  }

  function initHubQuiz(games){
    var state={time:null,company:null,medium:null};
    var result=hubQuiz.querySelector('[data-quiz-result]');
    var progress=hubQuiz.querySelector('[data-quiz-progress]');

    function answeredCount(){
      return Object.keys(state).filter(function(key){return state[key];}).length;
    }

    function scoreGame(game){
      var score=0;
      if(state.time && game.quiz && Array.isArray(game.quiz.time) && game.quiz.time.indexOf(state.time)!==-1)score+=1;
      if(state.company && game.quiz && Array.isArray(game.quiz.company) && game.quiz.company.indexOf(state.company)!==-1)score+=2;
      if(state.medium && game.quiz && game.quiz.medium===state.medium)score+=3;
      return score;
    }

    function reasonFor(game){
      var parts=[];
      if(state.medium && game.quiz.medium===state.medium)parts.push(game.medium.toLowerCase());
      if(state.company && game.quiz.company.indexOf(state.company)!==-1)parts.push('pasuje do wybranego sposobu grania');
      if(state.time && game.quiz.time.indexOf(state.time)!==-1)parts.push('pasuje do wybranego czasu sesji');
      if(!parts.length)return 'To najbliższe dopasowanie spośród obecnych czterech gier.';
      return 'Dopasowanie: '+parts.join(', ')+'.';
    }

    function render(){
      var answered=answeredCount();
      progress.style.width=String(answered/3*100)+'%';
      if(!answered){
        result.innerHTML='<span class="recommendation-label">Twoja rekomendacja</span><h2>Odpowiedz na trzy pytania</h2><p>Wynik będzie oparty wyłącznie na czterech grach obecnych w katalogu gracz.pl.</p>';
        return;
      }

      var ranked=games.map(function(game,index){
        return {game:game,score:scoreGame(game),index:index};
      }).sort(function(a,b){
        if(b.score!==a.score)return b.score-a.score;
        return a.index-b.index;
      });

      var primary=ranked[0] && ranked[0].game;
      if(!primary)return;
      var alternatives=ranked.slice(1,3).map(function(item){return item.game.name;});

      var html='<span class="recommendation-label">Twoja rekomendacja</span>';
      html+='<h2>'+primary.icon+' '+primary.name+'</h2>';
      html+='<p>'+reasonFor(primary)+'</p>';
      if(alternatives.length)html+='<ul><li>Alternatywy: '+alternatives.join(' • ')+'</li></ul>';
      html+='<a href="'+primary.url+'">Otwórz '+primary.name+' →</a>';
      result.innerHTML=html;
    }

    hubQuiz.addEventListener('click',function(e){
      var option=e.target.closest('[data-quiz-key]');
      if(option){
        var key=option.getAttribute('data-quiz-key');
        var value=option.getAttribute('data-quiz-value');
        state[key]=state[key]===value?null:value;
        Array.prototype.forEach.call(hubQuiz.querySelectorAll('[data-quiz-key="'+key+'"]'),function(btn){
          var active=btn===option && state[key]===value;
          btn.setAttribute('aria-pressed',active?'true':'false');
        });
        render();
        return;
      }

      if(e.target.closest('[data-quiz-reset]')){
        state={time:null,company:null,medium:null};
        Array.prototype.forEach.call(hubQuiz.querySelectorAll('[data-quiz-key]'),function(btn){
          btn.setAttribute('aria-pressed','false');
        });
        render();
      }
    });
  }

  function initCompare(games){
    var selectA=compareRoot.querySelector('[data-compare-a]');
    var selectB=compareRoot.querySelector('[data-compare-b]');
    var result=compareRoot.querySelector('[data-compare-result]');

    function addOptions(select){
      games.forEach(function(game){
        var option=document.createElement('option');
        option.value=game.id;
        option.textContent=game.name;
        select.appendChild(option);
      });
    }

    addOptions(selectA);
    addOptions(selectB);
    if(games.length>1)selectB.selectedIndex=1;

    function gameById(id){
      return games.filter(function(game){return game.id===id;})[0]||null;
    }

    function safeTime(game){
      return game.verifiedTime || 'brak ustalonego czasu';
    }

    function renderCompare(){
      var a=gameById(selectA.value);
      var b=gameById(selectB.value);
      if(!a || !b || a.id===b.id){
        result.innerHTML='<p>Wybierz dwie różne gry.</p>';
        return;
      }
      var rows=[
        ['Liczba graczy',a.players,b.players],
        ['Rodzaj',a.medium,b.medium],
        ['Informacja',a.information,b.information],
        ['Czas',safeTime(a),safeTime(b)],
        ['Mechaniki',a.mechanics.join(', '),b.mechanics.join(', ')]
      ];
      var html='<table class="compare-table-r2"><thead><tr><th>Cecha</th><th>'+a.name+'</th><th>'+b.name+'</th></tr></thead><tbody>';
      rows.forEach(function(row){
        html+='<tr><th>'+row[0]+'</th><td>'+row[1]+'</td><td>'+row[2]+'</td></tr>';
      });
      html+='</tbody></table>';
      result.innerHTML=html;
    }

    selectA.addEventListener('change',renderCompare);
    selectB.addEventListener('change',renderCompare);
    renderCompare();
  }

})();