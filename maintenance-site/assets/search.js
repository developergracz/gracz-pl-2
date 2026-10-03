(function(){
  'use strict';

  if (window.GraczSearch) return;

  var ITEMS = [
    {title:'gracz.pl — strona główna',url:'/',category:'informacje',type:'Start',description:'Gry online, Academy, wiedza i rozwijana społeczność graczy.',keywords:'gracz portal start strona glowna gry online academy wiedza spolecznosc',priority:100},
    {title:'Gry online',url:'/gry/',category:'gry',type:'Gry',description:'Poker, Tysiąc, Warcaby i Gomoku w jednym miejscu.',keywords:'gry wszystkie gry online poker tysiac warcaby gomoku',priority:98},
    {title:'Gry karciane',url:'/gry-karciane/',category:'gry',type:'Gry karciane',description:'Poker treningowy, Tysiąc i materiały do nauki gier karcianych.',keywords:'gry karciane karty poker tysiac texas holdem',priority:96},

    {title:'Poker Academy',url:'/gry/poker-treningowy/',category:'academy',type:'Academy',description:'Texas Hold’em: zasady, pozycje, układy, pot odds, quizy i trening decyzji.',keywords:'poker academy texas holdem hold em karty pozycja blindy pot odds quiz strategia',priority:100},
    {title:'Zasady Texas Hold’em',url:'/gry/poker-treningowy/zasady/',category:'zasady',type:'Zasady',description:'Blindy, preflop, flop, turn, river, showdown, all-in i pule boczne.',keywords:'poker texas holdem zasady preflop flop turn river showdown all in blindy',priority:98},
    {title:'Ranking układów pokerowych',url:'/gry/poker-treningowy/#ranking-ukladow',category:'academy',type:'Poker',description:'Poznaj kolejność układów w Texas Hold’em.',keywords:'poker układy uklady ranking royal flush kareta full kolor strit para',priority:90},
    {title:'Pozycje, button i blindy',url:'/gry/poker-treningowy/#pozycje-poker',category:'academy',type:'Poker',description:'Jak pozycja przy stole wpływa na decyzje w pokerze.',keywords:'poker pozycja button dealer small blind big blind blindy',priority:88},
    {title:'Kalkulator pot odds',url:'/gry/poker-treningowy/#pot-odds',category:'academy',type:'Poker',description:'Ćwicz ocenę opłacalności sprawdzenia na podstawie pot odds.',keywords:'poker pot odds matematyka szanse pula call kalkulator',priority:88},
    {title:'Trener decyzji pokerowych',url:'/gry/poker-treningowy/#arena-decyzji',category:'academy',type:'Poker',description:'Podejmij decyzję i zobacz wyjaśnienie.',keywords:'poker trening decyzja fold call raise check trener',priority:86},

    {title:'Tysiąc Academy',url:'/gry/tysiac/',category:'academy',type:'Academy',description:'Licytacja, musik, meldunki, atuty, punktacja, quiz i trening decyzji.',keywords:'tysiac 1000 academy karty licytacja musik meldunki atut punktacja',priority:100},
    {title:'Zasady gry w Tysiąca',url:'/gry/tysiac/zasady/',category:'zasady',type:'Zasady',description:'Talia 24 kart, licytacja 100–360, musik, meldunki, atuty i punktacja.',keywords:'tysiac 1000 zasady talia 24 licytacja musik meldunki atuty punktacja',priority:98},
    {title:'Licytacja w Tysiącu',url:'/gry/tysiac/#licytacja-tysiac',category:'academy',type:'Tysiąc',description:'Zasady licytacji i podejmowanie świadomych decyzji.',keywords:'tysiac licytacja kontrakt 100 120 360 przebicie',priority:88},
    {title:'Meldunki i atut w Tysiącu',url:'/gry/tysiac/#meldunki-atut',category:'academy',type:'Tysiąc',description:'Wartości meldunków i ustanawianie atutu.',keywords:'tysiac meldunek meldunki atut dama krol pik kier karo trefl',priority:88},
    {title:'Punktacja w Tysiącu',url:'/gry/tysiac/#punktacja-koniec',category:'academy',type:'Tysiąc',description:'Jak liczyć wynik rozdania i zakończenie gry.',keywords:'tysiac punktacja punkty wynik 1000 beczka',priority:86},

    {title:'Warcaby Academy',url:'/gry/warcaby/',category:'academy',type:'Academy',description:'Ruchy, obowiązkowe bicie, wielokrotne bicie, damka i strategia.',keywords:'warcaby academy plansza 8x8 bicie damka pionki strategia',priority:100},
    {title:'Zasady gry w Warcaby 8×8',url:'/gry/warcaby/zasady/',category:'zasady',type:'Zasady',description:'Ustawienie pionków, ruch, bicie, damka, zwycięstwo i remis.',keywords:'warcaby zasady 8x8 pionki ruch bicie damka remis',priority:98},
    {title:'Bicie w Warcabach',url:'/gry/warcaby/zasady/#bicie',category:'zasady',type:'Warcaby',description:'Obowiązkowe bicie pionków przeciwnika.',keywords:'warcaby bicie obowiązkowe skok pionek',priority:87},
    {title:'Wielokrotne bicie',url:'/gry/warcaby/zasady/#wielokrotne',category:'zasady',type:'Warcaby',description:'Kiedy jedna tura obejmuje kilka kolejnych bić.',keywords:'warcaby wielokrotne bicie seria skoki',priority:86},
    {title:'Damka — ruch i bicie',url:'/gry/warcaby/zasady/#damka',category:'zasady',type:'Warcaby',description:'Awans pionka oraz zasady ruchu i bicia damką.',keywords:'warcaby damka awans ruch bicie',priority:86},

    {title:'Gomoku Academy',url:'/gry/gomoku/',category:'academy',type:'Academy',description:'Plansza 15×15, pięć w linii, atak, obrona, strategia i quiz.',keywords:'gomoku academy 15x15 pięć w linii piec kamienie atak obrona strategia',priority:100},
    {title:'Zasady Gomoku 15×15',url:'/gry/gomoku/zasady/',category:'zasady',type:'Zasady',description:'Czarne zaczynają, jeden kamień na turę i zwycięskie pięć w linii.',keywords:'gomoku zasady 15x15 czarne zaczynają kamien ruch pięć w linii remis',priority:98},
    {title:'Atakować czy bronić w Gomoku?',url:'/gry/gomoku/#attack-defense',category:'academy',type:'Gomoku',description:'Trening rozpoznawania sytuacji ataku i obrony.',keywords:'gomoku atak obrona zagrozenie strategia trening',priority:87},
    {title:'Legalny ruch w Gomoku',url:'/gry/gomoku/#legal-move-lab',category:'academy',type:'Gomoku',description:'Sprawdź, gdzie wolno położyć kamień.',keywords:'gomoku legalny ruch kamien pole plansza',priority:85},

    {title:'Poradniki',url:'/poradniki/',category:'poradniki',type:'Poradniki',description:'Centrum wiedzy: Poker, Tysiąc, Warcaby i Gomoku.',keywords:'poradnik poradniki wiedza nauka strategia poker tysiac warcaby gomoku',priority:96},
    {title:'Ścieżki nauki',url:'/poradniki/#sciezki-nauki',category:'poradniki',type:'Poradniki',description:'Od podstaw do świadomej gry — uporządkowane ścieżki nauki.',keywords:'poradniki nauka ścieżka sciezka podstawy zaawansowane',priority:86},
    {title:'Najczęstsze błędy graczy',url:'/poradniki/#bledy',category:'poradniki',type:'Poradniki',description:'Ucz się nie tylko co robić, ale też czego unikać.',keywords:'poradniki błędy bledy graczy strategia nauka',priority:82},
    {title:'Słownik pojęć',url:'/poradniki/#slownik',category:'poradniki',type:'Poradniki',description:'Najważniejsze pojęcia związane z grami i nauką.',keywords:'slownik słownik pojęcia pojecia terminologia',priority:80},

    {title:'O gracz.pl',url:'/o-gracz-pl/',category:'informacje',type:'Informacje',description:'Poznaj ideę i kierunek rozwoju portalu gracz.pl.',keywords:'o gracz pl informacje portal projekt misja rozwój rozwoj',priority:88},
    {title:'Regulamin serwisu',url:'/regulamin/',category:'informacje',type:'Dokument',description:'Zasady korzystania z gracz.pl, kont, gier, społeczności i fair play.',keywords:'regulamin zasady serwis prawo konto fair play reklamacje moderacja',priority:86},
    {title:'Konto i rejestracja — Regulamin',url:'/regulamin/#konto',category:'informacje',type:'Regulamin',description:'Zasady dotyczące kont użytkowników i rejestracji.',keywords:'regulamin konto rejestracja login haslo hasło',priority:77},
    {title:'Fair play, boty i automatyzacja',url:'/regulamin/#fair-play',category:'informacje',type:'Regulamin',description:'Zasady fair play i niedozwolonej automatyzacji.',keywords:'fair play bot boty automat automatyzacja oszustwa',priority:76},
    {title:'Reklamacje i zgłoszenia',url:'/regulamin/#reklamacje',category:'informacje',type:'Regulamin',description:'Informacje o reklamacjach i obsłudze zgłoszeń.',keywords:'reklamacja reklamacje zgłoszenie zgloszenie problem',priority:75},

    {title:'Polityka prywatności',url:'/polityka-prywatnosci/',category:'informacje',type:'Prywatność',description:'RODO, dane osobowe, cookies, localStorage, Render, Resend i bezpieczeństwo.',keywords:'polityka prywatności prywatnosc rodo dane osobowe cookies localstorage render resend bezpieczeństwo',priority:92},
    {title:'Formularz kontaktowy i dane osobowe',url:'/polityka-prywatnosci/#kontakt',category:'informacje',type:'Prywatność',description:'Jak przetwarzane są dane przesłane przez formularz kontaktowy.',keywords:'rodo prywatność formularz kontakt dane email wiadomość resend render',priority:84},
    {title:'Cookies i localStorage',url:'/polityka-prywatnosci/#cookies',category:'informacje',type:'Prywatność',description:'Informacje o pamięci przeglądarki i technologiach podobnych.',keywords:'cookies ciasteczka localstorage sessionstorage pamięć przeglądarki',priority:82},
    {title:'Prawa użytkownika — RODO',url:'/polityka-prywatnosci/#prawa',category:'informacje',type:'Prywatność',description:'Dostęp, sprostowanie, usunięcie, ograniczenie, sprzeciw i przenoszenie danych.',keywords:'rodo prawa dostęp dostep usunięcie usuniecie sprostowanie sprzeciw przenoszenie',priority:82},
    {title:'Kontakt w sprawach RODO',url:'/polityka-prywatnosci/#kontakt-rodo',category:'informacje',type:'Prywatność',description:'Kanał kontaktowy w sprawach prywatności i ochrony danych.',keywords:'rodo kontakt prywatność prywatnosc dane administrator email',priority:80}
  ];

  var FILTERS = [
    {key:'all',label:'Wszystko'},
    {key:'gry',label:'Gry'},
    {key:'academy',label:'Academy'},
    {key:'zasady',label:'Zasady'},
    {key:'poradniki',label:'Poradniki'},
    {key:'informacje',label:'Informacje'}
  ];

  var SYNONYMS = {
    'poker':['texas','holdem','hold em','karty'],
    'texas':['poker','holdem'],
    'holdem':['poker','texas'],
    'tysiac':['1000','tysiąc'],
    '1000':['tysiac','tysiąc'],
    'warcaby':['checkers','damka','pionki'],
    'gomoku':['piec w linii','pięć w linii','kamienie'],
    'rodo':['prywatnosc','prywatność','dane osobowe'],
    'prywatnosc':['rodo','dane osobowe','cookies'],
    'login':['konto','logowanie'],
    'logowanie':['konto','login'],
    'konto':['rejestracja','login','logowanie'],
    'zasady':['regulamin','jak grac','jak grać'],
    'poradnik':['poradniki','nauka','strategia'],
    'academy':['nauka','trening','quiz']
  };

  var state={dialog:null,input:null,results:null,status:null,filter:'all',query:'',active:-1,lastTrigger:null};

  function normalize(value){
    return String(value||'')
      .toLocaleLowerCase('pl-PL')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/ł/g,'l')
      .replace(/[^a-z0-9\s-]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function escapeHtml(value){
    return String(value||'').replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch];
    });
  }

  function tokens(value){
    return normalize(value).split(' ').filter(function(t){return t.length>1;});
  }

  function levenshtein(a,b){
    if(a===b)return 0;
    if(!a.length)return b.length;
    if(!b.length)return a.length;
    var prev=[],cur=[],i,j;
    for(j=0;j<=b.length;j++)prev[j]=j;
    for(i=1;i<=a.length;i++){
      cur[0]=i;
      for(j=1;j<=b.length;j++){
        cur[j]=Math.min(
          cur[j-1]+1,
          prev[j]+1,
          prev[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1)
        );
      }
      prev=cur.slice();
    }
    return prev[b.length];
  }

  function fuzzyTokenMatch(q,word){
    if(!q||!word)return false;
    if(word.indexOf(q)===0||q.indexOf(word)===0)return true;
    if(q.length<4||word.length<4)return false;
    var max=q.length>=7?2:1;
    if(Math.abs(q.length-word.length)>max)return false;
    return levenshtein(q,word)<=max;
  }

  function expandedTokens(query){
    var base=tokens(query);
    var out=base.slice();
    base.forEach(function(t){
      (SYNONYMS[t]||[]).forEach(function(s){
        tokens(s).forEach(function(x){if(out.indexOf(x)===-1)out.push(x);});
      });
    });
    return out;
  }

  function scoreItem(item,query){
    var q=normalize(query);
    if(!q)return item.priority||0;

    var title=normalize(item.title);
    var desc=normalize(item.description);
    var keys=normalize(item.keywords);
    var hay=title+' '+desc+' '+keys;
    var qTokens=expandedTokens(query);
    var hayWords=hay.split(' ');
    var score=0;
    var matched=0;

    if(title===q)score+=180;
    else if(title.indexOf(q)===0)score+=120;
    else if(title.indexOf(q)!==-1)score+=90;
    if(keys.indexOf(q)!==-1)score+=55;
    if(desc.indexOf(q)!==-1)score+=32;

    qTokens.forEach(function(t){
      var local=0;
      if(title.split(' ').indexOf(t)!==-1)local=Math.max(local,38);
      if(title.indexOf(t)!==-1)local=Math.max(local,30);
      if(keys.split(' ').indexOf(t)!==-1)local=Math.max(local,24);
      if(keys.indexOf(t)!==-1)local=Math.max(local,18);
      if(desc.indexOf(t)!==-1)local=Math.max(local,12);

      if(!local){
        for(var i=0;i<hayWords.length;i++){
          if(fuzzyTokenMatch(t,hayWords[i])){local=8;break;}
        }
      }
      if(local){matched++;score+=local;}
    });

    if(qTokens.length&&matched===qTokens.length)score+=32;
    if(!matched&&title.indexOf(q)===-1&&keys.indexOf(q)===-1&&desc.indexOf(q)===-1)return -1;
    score+=(item.priority||0)*0.18;
    return score;
  }

  function categoryLabel(key){
    var found=FILTERS.filter(function(f){return f.key===key;})[0];
    return found?found.label:key;
  }

  function highlight(text,query){
    var safe=escapeHtml(text);
    var qs=tokens(query).sort(function(a,b){return b.length-a.length;});
    if(!qs.length)return safe;
    var raw=String(text||'');
    var norm=normalize(raw);
    var spans=[];
    qs.forEach(function(q){
      var from=0,idx;
      while((idx=norm.indexOf(q,from))!==-1){
        spans.push([idx,idx+q.length]);
        from=idx+q.length;
      }
    });
    if(!spans.length)return safe;
    spans.sort(function(a,b){return a[0]-b[0]||b[1]-a[1];});
    var merged=[];
    spans.forEach(function(s){
      if(!merged.length||s[0]>merged[merged.length-1][1])merged.push(s.slice());
      else merged[merged.length-1][1]=Math.max(merged[merged.length-1][1],s[1]);
    });
    var out='',last=0;
    merged.forEach(function(s){
      out+=escapeHtml(raw.slice(last,s[0]))+'<mark>'+escapeHtml(raw.slice(s[0],s[1]))+'</mark>';
      last=s[1];
    });
    out+=escapeHtml(raw.slice(last));
    return out;
  }

  function getResults(){
    var q=state.query;
    var list=ITEMS.filter(function(item){
      return state.filter==='all'||item.category===state.filter||(state.filter==='gry'&&item.category==='academy');
    }).map(function(item){
      return {item:item,score:scoreItem(item,q)};
    }).filter(function(x){return x.score>=0;});

    list.sort(function(a,b){
      if(b.score!==a.score)return b.score-a.score;
      return (b.item.priority||0)-(a.item.priority||0);
    });
    return list.slice(0,q?10:8);
  }

  function renderFilters(){
    var holder=state.dialog.querySelector('[data-search-filters]');
    holder.innerHTML=FILTERS.map(function(f){
      return '<button type="button" class="gracz-search__filter'+(state.filter===f.key?' is-active':'')+'" data-search-filter="'+f.key+'" aria-pressed="'+(state.filter===f.key?'true':'false')+'">'+f.label+'</button>';
    }).join('');
  }

  function render(){
    var results=getResults();
    state.active=-1;
    renderFilters();

    if(!state.query){
      state.status.textContent='Popularne miejsca w gracz.pl';
    }else{
      state.status.textContent=results.length?('Znaleziono '+results.length+(results.length===1?' wynik':' wyników')):'Brak wyników';
    }

    if(!results.length){
      state.results.innerHTML='<div class="gracz-search__empty"><strong>Nie znaleźliśmy pasującej treści.</strong><span>Spróbuj krótszej frazy, innej nazwy gry albo wybierz inny filtr.</span></div>';
      return;
    }

    state.results.innerHTML=results.map(function(x,index){
      var item=x.item;
      return '<a class="gracz-search__result" href="'+escapeHtml(item.url)+'" data-search-result data-index="'+index+'">'+
        '<span class="gracz-search__result-icon" aria-hidden="true">'+iconFor(item.category)+'</span>'+
        '<span class="gracz-search__result-main">'+
          '<span class="gracz-search__result-top"><strong>'+highlight(item.title,state.query)+'</strong><em>'+escapeHtml(item.type||categoryLabel(item.category))+'</em></span>'+
          '<span class="gracz-search__result-desc">'+highlight(item.description,state.query)+'</span>'+
          '<span class="gracz-search__result-url">'+escapeHtml(item.url)+'</span>'+
        '</span>'+
        '<span class="gracz-search__result-arrow" aria-hidden="true">→</span>'+
      '</a>';
    }).join('');
  }

  function iconFor(category){
    if(category==='academy')return 'A';
    if(category==='zasady')return '§';
    if(category==='poradniki')return '?';
    if(category==='gry')return '♠';
    return 'i';
  }

  function setActive(index){
    var nodes=Array.prototype.slice.call(state.results.querySelectorAll('[data-search-result]'));
    if(!nodes.length){state.active=-1;return;}
    if(index<0)index=nodes.length-1;
    if(index>=nodes.length)index=0;
    state.active=index;
    nodes.forEach(function(node,i){
      node.classList.toggle('is-active',i===index);
      if(i===index)node.scrollIntoView({block:'nearest'});
    });
  }

  function createDialog(){
    if(state.dialog)return state.dialog;
    var dialog=document.createElement('dialog');
    dialog.className='gracz-search';
    dialog.setAttribute('aria-labelledby','gracz-search-title');
    dialog.innerHTML=
      '<div class="gracz-search__panel">'+
        '<div class="gracz-search__head">'+
          '<div><span class="gracz-search__brand">gracz<span>.pl</span></span><p>Zaawansowana wyszukiwarka portalu</p></div>'+
          '<button type="button" class="gracz-search__close" data-search-close aria-label="Zamknij wyszukiwarkę">×</button>'+
        '</div>'+
        '<h2 id="gracz-search-title" class="sr-only">Wyszukiwarka gracz.pl</h2>'+
        '<div class="gracz-search__box">'+
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.8 15.8l4.6 4.6" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>'+
          '<input type="search" data-search-input autocomplete="off" spellcheck="false" placeholder="Szukaj gry, zasad, Academy, poradnika…" aria-label="Szukaj w gracz.pl">'+
          '<button type="button" class="gracz-search__clear" data-search-clear aria-label="Wyczyść wyszukiwanie">Wyczyść</button>'+
        '</div>'+
        '<div class="gracz-search__quick" aria-label="Popularne wyszukiwania">'+
          '<span>Popularne:</span>'+
          '<button type="button" data-search-query="poker">Poker</button>'+
          '<button type="button" data-search-query="tysiąc">Tysiąc</button>'+
          '<button type="button" data-search-query="warcaby">Warcaby</button>'+
          '<button type="button" data-search-query="gomoku">Gomoku</button>'+
          '<button type="button" data-search-query="zasady">Zasady</button>'+
          '<button type="button" data-search-query="RODO">RODO</button>'+
        '</div>'+
        '<div class="gracz-search__filters" data-search-filters aria-label="Filtry wyszukiwarki"></div>'+
        '<div class="gracz-search__meta"><span data-search-status aria-live="polite"></span><span class="gracz-search__hint"><kbd>↑</kbd><kbd>↓</kbd> wybór <kbd>Enter</kbd> otwórz <kbd>Esc</kbd> zamknij</span></div>'+
        '<div class="gracz-search__results" data-search-results role="listbox" aria-label="Wyniki wyszukiwania"></div>'+
        '<div class="gracz-search__foot"><span>Wyszukiwanie działa lokalnie w gracz.pl — wpisywana fraza nie jest wysyłana do zewnętrznej wyszukiwarki.</span><strong>Ctrl K</strong></div>'+
      '</div>';
    document.body.appendChild(dialog);
    state.dialog=dialog;
    state.input=dialog.querySelector('[data-search-input]');
    state.results=dialog.querySelector('[data-search-results]');
    state.status=dialog.querySelector('[data-search-status]');

    state.input.addEventListener('input',function(){
      state.query=state.input.value.trim();
      render();
    });

    dialog.addEventListener('click',function(event){
      var filter=event.target.closest('[data-search-filter]');
      if(filter){
        state.filter=filter.getAttribute('data-search-filter')||'all';
        render();
        state.input.focus();
        return;
      }
      var q=event.target.closest('[data-search-query]');
      if(q){
        state.query=q.getAttribute('data-search-query')||'';
        state.input.value=state.query;
        render();
        state.input.focus();
        return;
      }
      if(event.target.closest('[data-search-clear]')){
        state.query='';
        state.input.value='';
        render();
        state.input.focus();
        return;
      }
      if(event.target===dialog||event.target.closest('[data-search-close]'))close();
    });

    dialog.addEventListener('cancel',function(event){
      event.preventDefault();
      close();
    });

    dialog.addEventListener('close',function(){
      document.body.classList.remove('gracz-search-open');
      if(state.lastTrigger&&document.contains(state.lastTrigger)){
        try{state.lastTrigger.focus();}catch(_){}
      }
      state.lastTrigger=null;
    });

    dialog.addEventListener('keydown',function(event){
      if(event.key==='ArrowDown'){
        event.preventDefault();
        setActive(state.active+1);
      }else if(event.key==='ArrowUp'){
        event.preventDefault();
        setActive(state.active-1);
      }else if(event.key==='Enter'&&state.active>=0){
        var active=state.results.querySelector('[data-index="'+state.active+'"]');
        if(active){
          event.preventDefault();
          window.location.assign(active.href);
        }
      }
    });

    render();
    return dialog;
  }

  function open(trigger){
    state.lastTrigger=trigger||document.activeElement;
    var dialog=createDialog();
    state.filter='all';
    state.query='';
    state.input.value='';
    render();
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    document.body.classList.add('gracz-search-open');
    window.setTimeout(function(){state.input.focus();},0);
  }

  function close(){
    if(!state.dialog)return;
    if(typeof state.dialog.close==='function'&&state.dialog.open)state.dialog.close();
    else{
      state.dialog.removeAttribute('open');
      document.body.classList.remove('gracz-search-open');
    }
  }

  document.addEventListener('click',function(event){
    var trigger=event.target.closest('[data-modal="search"],[data-gracz-search]');
    if(!trigger)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(trigger);
  },true);

  document.addEventListener('keydown',function(event){
    var target=event.target;
    var typing=target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();
      if(state.dialog&&state.dialog.open)close(); else open(target);
      return;
    }
    if(!typing&&event.key==='/'&&!(state.dialog&&state.dialog.open)){
      event.preventDefault();
      open(target);
    }
  },true);

  window.GraczSearch={open:open,close:close};
})();