(function(){
  'use strict';

  if(window.GRACZ_SEARCH_INDEX)return;

  var items=[];
  function add(item){
    item.priority=Number(item.priority||60);
    item.keywords=String(item.keywords||'');
    item.description=String(item.description||'');
    item.category=item.category||'informacje';
    item.type=item.type||'Treść';
    item.game=item.game||'';
    items.push(item);
  }
  function section(base,id,title,category,type,game,keywords,description,priority){
    add({
      title:title,
      url:base+'#'+id,
      category:category,
      type:type,
      game:game||'',
      keywords:(keywords||'')+' '+title,
      description:description||('Przejdź bezpośrednio do sekcji „'+title+'”.'),
      priority:priority||72
    });
  }

  add({title:'gracz.pl — strona główna',url:'/',category:'informacje',type:'Start',description:'Gry online, Academy, wiedza i rozwijana społeczność graczy.',keywords:'gracz portal start strona główna glowna gry online academy wiedza społeczność spolecznosc',priority:100});
  add({title:'Gry online',url:'/gry/',category:'gry',type:'Gry',description:'Poker, Tysiąc, Warcaby i Gomoku w jednym miejscu.',keywords:'gry wszystkie gry online poker tysiąc tysiac warcaby gomoku',priority:99});
  add({title:'Gry karciane',url:'/gry-karciane/',category:'gry',type:'Gry karciane',description:'Poker treningowy, Tysiąc i materiały do nauki gier karcianych.',keywords:'gry karciane karty poker tysiąc tysiac texas holdem',priority:96});
  add({title:'Poradniki',url:'/poradniki/',category:'poradniki',type:'Poradniki',description:'Centrum wiedzy gracz.pl: Poker, Tysiąc, Warcaby i Gomoku.',keywords:'poradnik poradniki wiedza nauka strategia poker tysiąc tysiac warcaby gomoku',priority:96});
  add({title:'O gracz.pl',url:'/o-gracz-pl/',category:'informacje',type:'Informacje',description:'Poznaj ideę i kierunek rozwoju portalu gracz.pl.',keywords:'o gracz informacje portal projekt misja rozwój rozwoj',priority:88});
  add({title:'Inteligentna wyszukiwarka gracz.pl — zalety',url:'/wyszukiwarka/',category:'informacje',type:'Wyszukiwarka',description:'Poznaj funkcje SEARCH R3: pytania naturalnym językiem, kontekst gier, literówki, filtry, prywatność i szybkie wyniki.',keywords:'wyszukiwarka inteligentna search r3 zalety funkcje pytania naturalny język kontekst prywatność filtry literówki',priority:94});
  add({title:'Regulamin serwisu',url:'/regulamin/',category:'informacje',type:'Dokument',description:'Zasady korzystania z gracz.pl, kont, gier, społeczności i fair play.',keywords:'regulamin zasady serwis prawo konto fair play reklamacje moderacja',priority:90});
  add({title:'Polityka prywatności',url:'/polityka-prywatnosci/',category:'informacje',type:'Prywatność',description:'RODO, dane osobowe, cookies, localStorage, Render, Resend i bezpieczeństwo.',keywords:'polityka prywatności prywatnosc rodo dane osobowe cookies localstorage render resend bezpieczeństwo bezpieczenstwo',priority:92});

  add({title:'Poker Academy',url:'/gry/poker-treningowy/',category:'academy',type:'Academy',game:'poker',description:'Texas Hold’em: zasady, pozycje, układy, pot odds, quizy i trening decyzji.',keywords:'poker academy texas holdem hold em karty pozycja blindy pot odds quiz strategia',priority:100});
  add({title:'Zasady Texas Hold’em',url:'/gry/poker-treningowy/zasady/',category:'zasady',type:'Zasady',game:'poker',description:'Blindy, preflop, flop, turn, river, showdown, all-in i pule boczne.',keywords:'poker texas holdem zasady preflop flop turn river showdown all in blindy',priority:99});
  [
    ['poker-academy','Nie tylko czytaj zasady. Ucz się podejmować decyzje.','academy','Poker','nauka decyzje academy trening'],
    ['academy-path','Sześć kroków od podstaw do świadomej decyzji','academy','Poker','ścieżka nauki poker academy'],
    ['poker-5-minut','Najpierw zrozum logikę rozdania','academy','Poker','poker 5 minut rozdanie logika'],
    ['przebieg-rozdania','Jak przebiega rozdanie Texas Hold’em?','academy','Poker','preflop flop turn river showdown rozdanie'],
    ['ranking-ukladow','Ranking układów pokerowych','academy','Poker','układy uklady royal flush poker kareta full kolor strit para'],
    ['pozycje-poker','Pozycje, button i blindy','academy','Poker','pozycja button dealer small blind big blind blindy'],
    ['trener-decyzji','Trener legalnych decyzji','academy','Poker','fold call raise check trener legalne decyzje'],
    ['arena-decyzji','Podejmij decyzję i zobacz wyjaśnienie','academy','Poker','trening decyzji poker wyjaśnienie'],
    ['pot-odds','Kalkulator pot odds','academy','Poker','pot odds kalkulator matematyka szanse call pula'],
    ['strategia-poker','Strategia, błędy i tryb gracz.pl','poradniki','Poker','strategia błędy poker'],
    ['quiz-poker','Quiz pokerowy — 5 pytań kontrolnych','academy','Poker','quiz test wiedza poker']
  ].forEach(function(x){section('/gry/poker-treningowy/',x[0],x[1],x[2],x[3],'poker',x[4],null,86);});
  [
    ['cel','Cel gry w Texas Hold’em','zasady poker cel wygrana'],
    ['pozycje','Pozycje, button i blindy — zasady','poker pozycje button blindy'],
    ['akcje','Możliwe akcje w pokerze','check bet call raise fold akcje'],
    ['rundy','Przebieg rozdania — rundy licytacji','preflop flop turn river rundy'],
    ['uklady','Ranking układów pokerowych — zasady','ranking układy pokerowe'],
    ['showdown','Showdown i rozstrzyganie remisów','showdown remis poker'],
    ['allin','All-in i pule boczne','all in side pot pule boczne'],
    ['faq','Najczęstsze pytania o Texas Hold’em','faq pytania poker zasady']
  ].forEach(function(x){section('/gry/poker-treningowy/zasady/',x[0],x[1],'zasady','Poker','poker',x[2],null,84);});

  add({title:'Tysiąc Academy',url:'/gry/tysiac/',category:'academy',type:'Academy',game:'tysiac',description:'Licytacja, musik, meldunki, atuty, punktacja, quiz i trening decyzji.',keywords:'tysiąc tysiac 1000 academy karty licytacja musik meldunki atut punktacja',priority:100});
  add({title:'Zasady gry w Tysiąca',url:'/gry/tysiac/zasady/',category:'zasady',type:'Zasady',game:'tysiac',description:'Talia 24 kart, licytacja 100–360, musik, meldunki, atuty i punktacja.',keywords:'tysiąc tysiac 1000 zasady talia 24 licytacja musik meldunki atuty punktacja',priority:99});
  [
    ['tysiac-academy','Od zasad do świadomej licytacji','academy','Tysiąc','nauka licytacja'],
    ['tysiac-path','Sześć etapów, które porządkują całą grę','academy','Tysiąc','ścieżka nauki'],
    ['tysiac-5-minut','Zrozum całą grę w siedmiu krokach','academy','Tysiąc','5 minut podstawy'],
    ['wariant-graczy','Warianty dla 2, 3 lub 4 graczy','zasady','Tysiąc','wariant gracze dwóch trzech czterech'],
    ['trener-licytacji','Trener licytacji — która decyzja jest legalna?','academy','Tysiąc','trener licytacja decyzja legalna'],
    ['meldunki-lab','Laboratorium meldunków','academy','Tysiąc','meldunki kier karo pik trefl'],
    ['legalny-ruch','Test legalnego ruchu w Tysiącu','academy','Tysiąc','kolor przebijanie legalny ruch'],
    ['kalkulator-tysiac','Kalkulator wyniku w Tysiącu','academy','Tysiąc','wynik kalkulator punktacja'],
    ['quiz-tysiac','Quiz Tysiąc — 5 pytań kontrolnych','academy','Tysiąc','quiz wiedza test'],
    ['talia-wartosci','Talia i wartości kart','zasady','Tysiąc','talia wartości karty'],
    ['rozdanie-musik','Rozdanie i musik','zasady','Tysiąc','rozdanie musik'],
    ['licytacja-tysiac','Licytacja w Tysiącu','zasady','Tysiąc','licytacja 100 120 360'],
    ['kontrakt-tysiac','Musik i deklaracja kontraktu','zasady','Tysiąc','kontrakt musik deklaracja'],
    ['meldunki-atut','Meldunki i ustanowienie atutu','zasady','Tysiąc','meldunki atut dama król krol'],
    ['rozgrywanie-lew','Rozgrywanie lew','zasady','Tysiąc','lewy dokładanie do koloru przebijanie'],
    ['punktacja-koniec','Punktacja i koniec gry','zasady','Tysiąc','punktacja wynik koniec 1000'],
    ['przyklad-rozdania','Przykład całego rozdania','poradniki','Tysiąc','przykład rozdanie'],
    ['strategia-tysiac','Strategia podstawowa i zaawansowana','poradniki','Tysiąc','strategia'],
    ['bledy-tysiac','Najczęstsze błędy w Tysiącu','poradniki','Tysiąc','błędy bledy'],
    ['faq-tysiac','FAQ — szybkie odpowiedzi o Tysiącu','zasady','Tysiąc','faq pytania'],
    ['slownik-tysiac','Słownik pojęć Tysiąca','poradniki','Tysiąc','słownik slownik pojęcia']
  ].forEach(function(x){section('/gry/tysiac/',x[0],x[1],x[2],x[3],'tysiac',x[4],null,85);});
  [
    ['talia','Talia i wartości kart — zasady Tysiąca','talia wartości'],
    ['rozdanie','Rozdanie i musik — zasady Tysiąca','rozdanie musik'],
    ['licytacja','Licytacja — zasady Tysiąca','licytacja'],
    ['kontrakt','Musik i deklaracja kontraktu — zasady','kontrakt musik'],
    ['meldunki','Meldunki i ustanowienie atutu — zasady','meldunki atut'],
    ['lewy','Rozgrywanie lew — zasady Tysiąca','lewy kolor przebijanie'],
    ['punktacja','Punktacja rozdania i koniec gry','punktacja koniec'],
    ['faq','Najczęstsze pytania o Tysiąca','faq pytania']
  ].forEach(function(x){section('/gry/tysiac/zasady/',x[0],x[1],'zasady','Tysiąc','tysiac',x[2],null,84);});

  add({title:'Warcaby Academy',url:'/gry/warcaby/',category:'academy',type:'Academy',game:'warcaby',description:'Ruchy, obowiązkowe bicie, wielokrotne bicie, damka i strategia.',keywords:'warcaby academy plansza 8x8 bicie damka pionki strategia',priority:100});
  add({title:'Zasady gry w Warcaby 8×8',url:'/gry/warcaby/zasady/',category:'zasady',type:'Zasady',game:'warcaby',description:'Ustawienie pionków, ruch, bicie, damka, zwycięstwo i remis.',keywords:'warcaby zasady 8x8 pionki ruch bicie damka remis',priority:99});
  [
    ['warcaby-academy','Od pierwszego ruchu do świadomej taktyki','academy','Warcaby','nauka taktyka'],
    ['warcaby-path','Sześć etapów od ruchu do taktyki','academy','Warcaby','ścieżka nauki'],
    ['trener-bicia','Trener obowiązkowego bicia','academy','Warcaby','bicie obowiązkowe trener'],
    ['multi-capture','Wielokrotne bicie — kilka skoków w jednej turze','academy','Warcaby','wielokrotne bicie seria skoki'],
    ['damka-lab','Laboratorium damki','academy','Warcaby','damka awans ruch'],
    ['quiz-warcaby','Quiz Warcaby — 5 pytań kontrolnych','academy','Warcaby','quiz test wiedza'],
    ['zasady','Cel gry w Warcaby','zasady','Warcaby','cel wygrana'],
    ['strategia-warcaby','Strategia i wskazówki do Warcabów','poradniki','Warcaby','strategia taktyka'],
    ['warianty','Warianty gry w Warcaby','zasady','Warcaby','warianty']
  ].forEach(function(x){section('/gry/warcaby/',x[0],x[1],x[2],x[3],'warcaby',x[4],null,85);});
  [
    ['plansza','Plansza, pionki i rozpoczęcie','plansza pionki rozpoczęcie'],
    ['ruch','Zwykły ruch pionka','ruch pionek'],
    ['bicie','Bicie pionków przeciwnika','bicie obowiązkowe'],
    ['wielokrotne','Wielokrotne bicie','wielokrotne bicie seria'],
    ['damka','Damka — ruch i bicie','damka ruch bicie'],
    ['koniec','Zwycięstwo i remis','koniec wygrana remis'],
    ['faq','Najczęstsze pytania o Warcaby','faq pytania']
  ].forEach(function(x){section('/gry/warcaby/zasady/',x[0],x[1],'zasady','Warcaby','warcaby',x[2],null,84);});

  add({title:'Gomoku Academy',url:'/gry/gomoku/',category:'academy',type:'Academy',game:'gomoku',description:'Plansza 15×15, pięć w linii, atak, obrona, strategia i quiz.',keywords:'gomoku academy 15x15 pięć piec w linii kamienie atak obrona strategia',priority:100});
  add({title:'Zasady Gomoku 15×15',url:'/gry/gomoku/zasady/',category:'zasady',type:'Zasady',game:'gomoku',description:'Czarne zaczynają, jeden kamień na turę i zwycięskie pięć w linii.',keywords:'gomoku zasady 15x15 czarne zaczynają zaczynaja kamień kamien ruch pięć piec w linii remis',priority:99});
  [
    ['gomoku-academy','Od pierwszego kamienia do świadomego ataku','academy','Gomoku','nauka atak'],
    ['gomoku-path','Sześć etapów od ruchu do taktyki','academy','Gomoku','ścieżka nauki'],
    ['threat-lab','Rozpoznaj siłę układu','academy','Gomoku','zagrożenie układ'],
    ['attack-defense','Atakować czy bronić?','academy','Gomoku','atak obrona decyzja'],
    ['legal-move-lab','Gdzie wolno położyć kamień?','academy','Gomoku','legalny ruch kamień pole'],
    ['quiz-gomoku','Quiz Gomoku — 5 pytań kontrolnych','academy','Gomoku','quiz test wiedza'],
    ['zasady','Cel gry w Gomoku','zasady','Gomoku','cel pięć w linii'],
    ['strategia-gomoku','Strategia i wskazówki do Gomoku','poradniki','Gomoku','strategia taktyka'],
    ['warianty','Warianty Gomoku','zasady','Gomoku','warianty']
  ].forEach(function(x){section('/gry/gomoku/',x[0],x[1],x[2],x[3],'gomoku',x[4],null,85);});
  [
    ['cel','Cel gry w Gomoku','cel pięć w linii'],
    ['plansza','Plansza i rozpoczęcie partii','plansza 15x15 rozpoczęcie'],
    ['ruch','Jak wygląda legalny ruch','legalny ruch kamień'],
    ['wygrana','Kiedy powstaje zwycięska linia','wygrana pięć w linii'],
    ['remis','Remis w Gomoku','remis'],
    ['warianty','Wariant podstawowy a inne odmiany','warianty'],
    ['faq','Najczęstsze pytania o Gomoku','faq pytania']
  ].forEach(function(x){section('/gry/gomoku/zasady/',x[0],x[1],'zasady','Gomoku','gomoku',x[2],null,84);});

  [
    ['centrum-wiedzy','Centrum wiedzy — znajdź właściwy materiał','poradniki wiedza materiały'],
    ['twoj-postep','Twój postęp w nauce','postęp academy nauka'],
    ['dobierz-poradnik','Dobierz poradnik w 10 sekund','dobór poradnika'],
    ['sciezki-nauki','Ścieżki nauki — od podstaw do świadomej gry','ścieżka nauki'],
    ['polecane','Polecane materiały','polecane poradniki'],
    ['biblioteka-gier','Poradniki pokerowe','poker poradnik'],
    ['tysiac','Poradniki do Tysiąca','tysiąc poradnik'],
    ['warcaby','Poradniki do Warcabów','warcaby poradnik'],
    ['gomoku','Poradniki do Gomoku','gomoku poradnik'],
    ['5-minut','Poradniki w 5 minut','krótki poradnik 5 minut'],
    ['poradnik-tygodnia','Poradnik tygodnia','poradnik tygodnia'],
    ['bledy','Najczęstsze błędy graczy','błędy bledy'],
    ['poker-academy','Poker Academy — kierunek edukacyjny','poker academy'],
    ['tematy','Ucz się według problemu','tematy problem'],
    ['sprawdz-wiedze','Sprawdź wiedzę','quiz test wiedza'],
    ['slownik','Słownik najważniejszych pojęć','słownik slownik pojęcia'],
    ['zapisane','Zapisane na później','zapisane ulubione'],
    ['faq','Najczęstsze pytania o poradniki','faq pytania']
  ].forEach(function(x){section('/poradniki/',x[0],x[1],'poradniki','Poradniki','',x[2],null,80);});

  [
    ['postanowienia','Postanowienia ogólne'],
    ['definicje','Definicje'],
    ['operator','Operator serwisu'],
    ['zakres','Zakres usług i status funkcji'],
    ['techniczne','Wymagania techniczne'],
    ['konto','Konto i rejestracja'],
    ['obowiazki','Obowiązki użytkownika i działania zabronione'],
    ['fair-play','Fair play, boty i niedozwolona automatyzacja'],
    ['tresci','Treści użytkowników, komunikacja i społeczność'],
    ['wyniki','Gry, wyniki i rankingi'],
    ['academy','Academy, poradniki i treści edukacyjne'],
    ['turnieje','Turnieje, konkursy i nagrody'],
    ['platnosci','Płatności i usługi odpłatne'],
    ['ip','Własność intelektualna'],
    ['bezpieczenstwo','Bezpieczeństwo'],
    ['dostepnosc','Dostępność usług, konserwacja i awarie'],
    ['reklamacje','Reklamacje i zgłoszenia'],
    ['sankcje','Moderacja, ograniczenia i sankcje'],
    ['zakonczenie','Zakończenie korzystania i usunięcie konta'],
    ['prywatnosc','Prywatność, dane osobowe i pamięć przeglądarki'],
    ['maloletni','Małoletni'],
    ['zmiany','Zmiany Regulaminu'],
    ['koncowe','Postanowienia końcowe']
  ].forEach(function(x){section('/regulamin/',x[0],x[1],'informacje','Regulamin','',('regulamin '+x[1]),null,70);});

  [
    ['administrator','Administrator danych osobowych'],
    ['zakres','Zakres polityki i stan funkcji gracz.pl'],
    ['kategorie','Kategorie danych osobowych'],
    ['kontakt','Formularz kontaktowy i korespondencja e-mail'],
    ['academy','Academy, postęp użytkownika i localStorage'],
    ['cele','Cele i podstawy prawne przetwarzania'],
    ['interesy','Prawnie uzasadnione interesy administratora'],
    ['odbiorcy','Odbiorcy danych i dostawcy usług'],
    ['transfery','Przekazywanie danych poza Europejski Obszar Gospodarczy'],
    ['cookies','Cookies, localStorage i podobne technologie'],
    ['retencja','Okresy przechowywania danych'],
    ['dobrowolnosc','Źródło danych i dobrowolność ich podania'],
    ['prawa','Prawa osoby, której dane dotyczą'],
    ['sprzeciw','Sprzeciw i wycofanie zgody'],
    ['skarga','Prawo wniesienia skargi do UODO'],
    ['maloletni','Małoletni i prywatność'],
    ['automatyzacja','AI, profilowanie i zautomatyzowane podejmowanie decyzji'],
    ['bezpieczenstwo','Środki bezpieczeństwa danych'],
    ['naruszenia','Naruszenia ochrony danych'],
    ['zmiany','Zmiany Polityki i wersjonowanie'],
    ['kontakt-rodo','Kontakt w sprawach prywatności i RODO']
  ].forEach(function(x){section('/polityka-prywatnosci/',x[0],x[1],'informacje','Prywatność','',('rodo prywatność dane '+x[1]),null,73);});

  window.GRACZ_SEARCH_INDEX=items;
  window.GRACZ_SEARCH_INDEX_VERSION='R3-SMART-2026-10-03';
})();