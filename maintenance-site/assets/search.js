(function(){
  'use strict';

  if(window.GraczSearch)return;

  var INDEX=(window.GRACZ_SEARCH_INDEX||[]).slice();
  var RECENT_KEY='graczSearchRecentR2';
  var ZOOM_KEY='graczSearchZoomR3';
  var ZOOM_LEVELS=[100,115,130,145,160,175];
  var RESULTS_ZOOM_KEY='graczSearchResultsZoomR3';
  var RESULTS_ZOOM_LEVELS=[85,100,115,130,145];
  var MAX_RECENT=8;
  var MODAL_LIMIT=14;
  var PAGE_LIMIT=60;

  var FILTERS=[
    {key:'all',label:'Wszystko'},
    {key:'gry',label:'Gry'},
    {key:'academy',label:'Academy'},
    {key:'zasady',label:'Zasady'},
    {key:'poradniki',label:'Poradniki'},
    {key:'informacje',label:'Informacje'}
  ];

  var COMMANDS={
    '@poker':{scope:'poker',label:'Poker'},
    '@tysiac':{scope:'tysiac',label:'Tysiąc'},
    '@1000':{scope:'tysiac',label:'Tysiąc'},
    '@warcaby':{scope:'warcaby',label:'Warcaby'},
    '@gomoku':{scope:'gomoku',label:'Gomoku'},
    '@gry':{filter:'gry',label:'Gry'},
    '@academy':{filter:'academy',label:'Academy'},
    '@zasady':{filter:'zasady',label:'Zasady'},
    '@poradniki':{filter:'poradniki',label:'Poradniki'},
    '@rodo':{filter:'informacje',inject:'rodo',label:'RODO'},
    '@regulamin':{filter:'informacje',inject:'regulamin',label:'Regulamin'}
  };

  var SYNONYMS={
    'poker':['texas','holdem','hold em','karty'],
    'texas':['poker','holdem'],
    'holdem':['poker','texas'],
    'hold':['poker','texas'],
    'tysiac':['1000','tysiąc'],
    '1000':['tysiac','tysiąc'],
    'warcaby':['checkers','damka','pionki'],
    'checkers':['warcaby'],
    'gomoku':['piec w linii','pięć w linii','kamienie'],
    'rodo':['prywatnosc','prywatność','dane osobowe'],
    'prywatnosc':['rodo','dane osobowe','cookies'],
    'cookies':['ciasteczka','localstorage','prywatnosc'],
    'login':['konto','logowanie'],
    'logowanie':['konto','login'],
    'konto':['rejestracja','login','logowanie'],
    'zasady':['jak grac','jak grać','reguły','reguly'],
    'poradnik':['poradniki','nauka','strategia'],
    'poradniki':['poradnik','nauka','strategia'],
    'academy':['nauka','trening','quiz'],
    'meldunek':['meldunki','atut'],
    'meldunki':['meldunek','atut'],
    'damka':['warcaby','awans'],
    'pot':['odds','poker','matematyka']
  };

  var STOPWORDS={
    'a':1,'aby':1,'albo':1,'ale':1,'bo':1,'by':1,'czy':1,'co':1,'do':1,'dla':1,'gdzie':1,'i':1,
    'jak':1,'jaka':1,'jakie':1,'kiedy':1,'ktory':1,'która':1,'ktore':1,'na':1,'o':1,'od':1,'po':1,
    'się':1,'sie':1,'to':1,'w':1,'we':1,'z':1,'za':1,'ze':1,'że':1,'jest':1,'są':1,'sa':1,'mogę':1,'moge':1
  };

  var CANONICAL=[
    'poker','texas','holdem','tysiac','warcaby','gomoku','academy','zasady','poradniki','rodo','regulamin',
    'prywatnosc','cookies','localstorage','meldunki','licytacja','musik','atut','punktacja','bicie','damka',
    'showdown','preflop','flop','turn','river','blindy','pozycje','ranking','uklady','strategia','quiz',
    'konto','rejestracja','logowanie','reklamacje','bezpieczenstwo','kontakt'
  ];

  var SEARCH_VERSION='R3-SMART-2026-10-03';

  var INTENT_RULES=[
    {key:'rules',label:'Zasady',signals:['zasady','jak grac','jak sie gra','czy mozna','czy musze','kiedy mozna','legalny ruch','reguly','wygrana','remis']},
    {key:'learn',label:'Nauka',signals:['academy','poradnik','poradniki','strategia','trening','cwiczenie','cwiczyc','quiz','nauczyc','nauka']},
    {key:'privacy',label:'Prywatność',signals:['rodo','prywatnosc','dane osobowe','cookies','localstorage','administrator danych']},
    {key:'account',label:'Konto',signals:['konto','rejestracja','zalogowac','logowanie','login','haslo']},
    {key:'support',label:'Pomoc',signals:['kontakt','reklamacja','zgloszenie','problem techniczny']}
  ];

  var GAME_SIGNALS={
    poker:['poker','texas','holdem','hold em','preflop','flop','turn','river','showdown','blindy','pot odds','button'],
    tysiac:['tysiac','1000','musik','meldunek','meldunki','licytacja','kontrakt','atut'],
    warcaby:['warcaby','checkers','damka','pionki','wielokrotne bicie'],
    gomoku:['gomoku','piec w linii','kamien','kamienie','czarne zaczynaja']
  };

  var SMART_CONCEPTS=[
    {key:'poker-hands',game:'poker',signals:['uklad kart','uklady pokerowe','ranking ukladow','kareta','full','strit','kolor'],targets:['uklady','ranking','kareta','full','kolor','strit']},
    {key:'poker-position',game:'poker',signals:['pozycja','button','dealer','blindy','small blind','big blind'],targets:['pozycje','button','blindy']},
    {key:'poker-pot-odds',game:'poker',signals:['pot odds','szanse puli','oplacalnosc call','matematyka pokera'],targets:['pot odds','matematyka','szanse','kalkulator']},
    {key:'poker-rounds',game:'poker',signals:['preflop','flop','turn','river','rundy licytacji'],targets:['preflop','flop','turn','river','rundy']},
    {key:'tysiac-bidding',game:'tysiac',signals:['licytacja','licytowac','kontrakt','ile licytowac'],targets:['licytacja','kontrakt','przebicie']},
    {key:'tysiac-melds',game:'tysiac',signals:['meldunek','meldunki','krol i dama','krol dama','para krol dama','atut'],targets:['meldunki','meldunek','atut','dama','krol']},
    {key:'tysiac-musik',game:'tysiac',signals:['musik','talon','dobieranie kart'],targets:['musik','rozdanie','kontrakt']},
    {key:'tysiac-score',game:'tysiac',signals:['punktacja','punkty','ile punktow','wynik rozdania'],targets:['punktacja','punkty','wynik']},
    {key:'checkers-capture',game:'warcaby',signals:['bicie','musze bic','obowiazkowe bicie','bic pionek'],targets:['bicie','obowiazkowe','skok']},
    {key:'checkers-multi',game:'warcaby',signals:['wielokrotne bicie','kilka bic','seria bic'],targets:['wielokrotne','bicie','seria','skoki']},
    {key:'checkers-king',game:'warcaby',signals:['damka','awans pionka'],targets:['damka','awans','ruch']},
    {key:'gomoku-win',game:'gomoku',signals:['piec w linii','jak wygrac','wygrana','zwycieska linia'],targets:['wygrana','piec w linii','linia']},
    {key:'gomoku-move',game:'gomoku',signals:['legalny ruch','gdzie polozyc kamien','kamien na planszy'],targets:['legalny ruch','kamien','pole','plansza']},
    {key:'gomoku-tactics',game:'gomoku',signals:['atak czy obrona','atakowac','bronic','zagrozenie'],targets:['atak','obrona','zagrozenie','strategia']}
  ];

  var modalCtx=null;
  var pageCtx=null;
  var resultsWindowCtx=null;
  var resultsWindowLastTrigger=null;
  var lastTrigger=null;
  var urlTimer=null;

  function normalize(value){
    return String(value||'')
      .toLocaleLowerCase('pl-PL')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/ł/g,'l')
      .replace(/[^a-z0-9@\s-]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function escapeHtml(value){
    return String(value||'').replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch];
    });
  }

  function rawTokens(value){
    return normalize(value).split(' ').filter(Boolean);
  }

  function meaningfulTokens(value){
    return rawTokens(value).filter(function(t){
      return t.charAt(0)==='@'||(t.length>1&&!STOPWORDS[t]);
    });
  }

  function unique(list){
    var out=[];
    list.forEach(function(x){if(x&&out.indexOf(x)===-1)out.push(x);});
    return out;
  }

  function safeStorageGet(){
    try{
      var raw=window.localStorage.getItem(RECENT_KEY);
      var data=raw?JSON.parse(raw):[];
      return Array.isArray(data)?data.filter(function(x){return typeof x==='string';}).slice(0,MAX_RECENT):[];
    }catch(_){return [];}
  }

  function saveRecent(query){
    query=String(query||'').trim();
    if(query.length<2)return;
    try{
      var list=safeStorageGet().filter(function(x){return normalize(x)!==normalize(query);});
      list.unshift(query);
      window.localStorage.setItem(RECENT_KEY,JSON.stringify(list.slice(0,MAX_RECENT)));
    }catch(_){}
  }

  function clearRecent(){
    try{window.localStorage.removeItem(RECENT_KEY);}catch(_){}
  }

  function readZoom(){
    try{
      var value=parseInt(window.localStorage.getItem(ZOOM_KEY)||'100',10);
      return ZOOM_LEVELS.indexOf(value)!==-1?value:100;
    }catch(_){return 100;}
  }

  function persistZoom(value){
    try{window.localStorage.setItem(ZOOM_KEY,String(value));}catch(_){}
  }

  function applyZoom(ctx,value,persist){
    if(ZOOM_LEVELS.indexOf(value)===-1)value=100;
    ctx.zoom=value;
    ctx.root.setAttribute('data-search-zoom',String(value));
    if(ctx.zoomValue)ctx.zoomValue.textContent=String(value)+'%';
    if(ctx.zoomOut)ctx.zoomOut.disabled=value===ZOOM_LEVELS[0];
    if(ctx.zoomIn)ctx.zoomIn.disabled=value===ZOOM_LEVELS[ZOOM_LEVELS.length-1];
    if(ctx.zoomGroup)ctx.zoomGroup.setAttribute('aria-label','Powiększenie widoku wyszukiwarki: '+String(value)+'%');
    if(ctx.zoomReset)ctx.zoomReset.hidden=value===100;
    if(ctx.zoomSelector){
      ctx.zoomSelector.setAttribute('aria-label','Aktualne powiększenie '+String(value)+'%. Wybierz poziom powiększenia');
      ctx.zoomSelector.removeAttribute('title');
    }
    if(ctx.zoomOptions){
      ctx.zoomOptions.forEach(function(option){
        var selected=parseInt(option.getAttribute('data-search-zoom-level')||'0',10)===value;
        option.classList.toggle('is-active',selected);
        option.setAttribute('aria-checked',selected?'true':'false');
      });
    }
    if(ctx.maximizeButton){
      var isFullscreen=ctx.root.classList.contains('is-search-fullscreen');
      ctx.maximizeButton.setAttribute('aria-pressed',isFullscreen?'true':'false');
      ctx.maximizeButton.innerHTML=isFullscreen?'<span aria-hidden="true">↙</span> Przywróć':'<span aria-hidden="true">⛶</span> Powiększ';
    }
    if(persist!==false)persistZoom(value);
  }

  function changeZoom(ctx,direction){
    var current=ZOOM_LEVELS.indexOf(ctx.zoom||100);
    if(current<0)current=0;
    var next=Math.max(0,Math.min(ZOOM_LEVELS.length-1,current+direction));
    applyZoom(ctx,ZOOM_LEVELS[next],true);
  }

  function setSearchFullscreen(ctx,enabled){
    if(!ctx||ctx.mode!=='modal')return;
    ctx.root.classList.toggle('is-search-fullscreen',!!enabled);
    if(ctx.maximizeButton){
      ctx.maximizeButton.setAttribute('aria-pressed',enabled?'true':'false');
      ctx.maximizeButton.innerHTML=enabled?'<span aria-hidden="true">↙</span> Przywróć':'<span aria-hidden="true">⛶</span> Powiększ';
      ctx.maximizeButton.setAttribute('aria-label',enabled?'Przywróć standardowy rozmiar wyszukiwarki':'Powiększ wyszukiwarkę do rozmiaru okna przeglądarki');
    }
  }

  function toggleSearchFullscreen(ctx){
    setSearchFullscreen(ctx,!ctx.root.classList.contains('is-search-fullscreen'));
  }

  function readResultsZoom(){
    try{
      var value=parseInt(window.localStorage.getItem(RESULTS_ZOOM_KEY)||'100',10);
      return RESULTS_ZOOM_LEVELS.indexOf(value)!==-1?value:100;
    }catch(_){return 100;}
  }

  function persistResultsZoom(value){
    try{window.localStorage.setItem(RESULTS_ZOOM_KEY,String(value));}catch(_){}
  }

  function applyResultsZoom(ctx,value,persist){
    if(RESULTS_ZOOM_LEVELS.indexOf(value)===-1)value=100;
    ctx.zoom=value;
    ctx.root.setAttribute('data-results-zoom',String(value));
    if(ctx.zoomValue)ctx.zoomValue.textContent=String(value)+'%';
    if(ctx.zoomOut)ctx.zoomOut.disabled=value===RESULTS_ZOOM_LEVELS[0];
    if(ctx.zoomIn)ctx.zoomIn.disabled=value===RESULTS_ZOOM_LEVELS[RESULTS_ZOOM_LEVELS.length-1];
    if(ctx.zoomGroup)ctx.zoomGroup.setAttribute('aria-label','Powiększenie okna wyników: '+String(value)+'%');
    if(persist!==false)persistResultsZoom(value);
  }

  function changeResultsZoom(ctx,direction){
    var current=RESULTS_ZOOM_LEVELS.indexOf(ctx.zoom||100);
    if(current<0)current=1;
    var next=Math.max(0,Math.min(RESULTS_ZOOM_LEVELS.length-1,current+direction));
    applyResultsZoom(ctx,RESULTS_ZOOM_LEVELS[next],true);
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
    if(word===q||word.indexOf(q)===0||q.indexOf(word)===0)return true;
    if(q.length<4||word.length<4)return false;
    var max=q.length>=8?2:1;
    if(Math.abs(q.length-word.length)>max)return false;
    return levenshtein(q,word)<=max;
  }

  function parseQuery(raw){
    var tokens=rawTokens(raw);
    var scope='';
    var forcedFilter='';
    var injected=[];
    var clean=[];

    tokens.forEach(function(t){
      if(COMMANDS[t]){
        if(COMMANDS[t].scope)scope=COMMANDS[t].scope;
        if(COMMANDS[t].filter)forcedFilter=COMMANDS[t].filter;
        if(COMMANDS[t].inject)injected.push(COMMANDS[t].inject);
      }else clean.push(t);
    });

    return {
      raw:String(raw||'').trim(),
      clean:unique(clean.concat(injected)).join(' '),
      scope:scope,
      forcedFilter:forcedFilter,
      commands:tokens.filter(function(t){return !!COMMANDS[t];})
    };
  }

  function expandTokens(query){
    var base=meaningfulTokens(query);
    var out=base.slice();
    base.forEach(function(t){
      (SYNONYMS[t]||[]).forEach(function(s){
        meaningfulTokens(s).forEach(function(x){if(out.indexOf(x)===-1)out.push(x);});
      });
    });
    return out;
  }

  INDEX.forEach(function(item){
    item._title=normalize(item.title);
    item._desc=normalize(item.description);
    item._keys=normalize(item.keywords);
    item._game=normalize(item.game);
    item._hay=(item._title+' '+item._desc+' '+item._keys+' '+item._game).trim();
    item._words=unique(item._hay.split(' ').filter(function(x){return x.length>1;}));
  });

  var DICTIONARY=(function(){
    var words=CANONICAL.slice();
    INDEX.forEach(function(item){
      item._words.forEach(function(w){
        if(w.length>=4&&words.indexOf(w)===-1)words.push(w);
      });
    });
    return words;
  })();

  function nearestWord(token){
    if(token.length<4||STOPWORDS[token])return token;
    if(DICTIONARY.indexOf(token)!==-1)return token;
    var best=token,bestDist=99;
    DICTIONARY.forEach(function(w){
      if(Math.abs(w.length-token.length)>2)return;
      var d=levenshtein(token,w);
      if(d<bestDist){bestDist=d;best=w;}
    });
    var limit=token.length>=8?2:1;
    return bestDist<=limit?best:token;
  }

  function suggestionFor(raw){
    var parsed=parseQuery(raw);
    if(!parsed.clean)return '';
    var changed=false;
    var corrected=rawTokens(parsed.clean).map(function(t){
      var next=nearestWord(t);
      if(next!==t)changed=true;
      return next;
    });
    return changed?corrected.join(' '):'';
  }

  function phraseHit(hay,phrase){
    var p=normalize(phrase);
    return p&&hay.indexOf(p)!==-1;
  }

  function detectIntent(query){
    var q=normalize(query);
    var best={key:'navigation',label:'Wyszukiwanie',score:0};
    INTENT_RULES.forEach(function(rule){
      var score=0;
      rule.signals.forEach(function(signal){
        if(phraseHit(q,signal))score+=normalize(signal).indexOf(' ')!==-1?3:1;
      });
      if(score>best.score)best={key:rule.key,label:rule.label,score:score};
    });
    return best;
  }

  function detectGame(query){
    var q=normalize(query);
    var best={key:'',label:'',score:0};
    Object.keys(GAME_SIGNALS).forEach(function(game){
      var score=0;
      GAME_SIGNALS[game].forEach(function(signal,index){
        if(phraseHit(q,signal))score+=index<4?3:1;
      });
      if(score>best.score){
        best={
          key:game,
          label:game==='tysiac'?'Tysiąc':game.charAt(0).toUpperCase()+game.slice(1),
          score:score
        };
      }
    });
    return best;
  }

  function detectConcepts(query){
    var q=normalize(query);
    return SMART_CONCEPTS.filter(function(concept){
      return concept.signals.some(function(signal){return phraseHit(q,signal);});
    });
  }

  function smartAnalysis(query){
    var raw=String(query||'').trim();
    var q=normalize(raw);
    var starters=['jak ','czy ','kiedy ','gdzie ','dlaczego ','co ','ile ','ktory ','ktora ','mam ','musze ','moge '];
    var natural=raw.indexOf('?')!==-1||rawTokens(raw).length>=4||starters.some(function(s){return q.indexOf(s)===0;});
    return {
      intent:detectIntent(raw),
      game:detectGame(raw),
      concepts:detectConcepts(raw),
      natural:natural
    };
  }

  function smartBoost(item,analysis){
    var score=0;
    if(analysis.game.key&&item._game===analysis.game.key)score+=46;

    if(analysis.intent.key==='rules'){
      if(item.category==='zasady')score+=48;
      else if(item.category==='academy')score+=10;
    }else if(analysis.intent.key==='learn'){
      if(item.category==='academy')score+=38;
      if(item.category==='poradniki')score+=30;
    }else if(analysis.intent.key==='privacy'){
      if(item.type==='Prywatność'||item._hay.indexOf('rodo')!==-1||item._hay.indexOf('prywatnosc')!==-1)score+=55;
    }else if(analysis.intent.key==='account'){
      if(item._hay.indexOf('konto')!==-1||item._hay.indexOf('rejestracja')!==-1||item._hay.indexOf('logowanie')!==-1)score+=46;
    }else if(analysis.intent.key==='support'){
      if(item._hay.indexOf('kontakt')!==-1||item._hay.indexOf('reklamac')!==-1||item._hay.indexOf('zgloszen')!==-1)score+=42;
    }

    analysis.concepts.forEach(function(concept){
      if(concept.game&&item._game&&concept.game!==item._game)return;
      var hits=0;
      concept.targets.forEach(function(target){
        if(phraseHit(item._hay,target))hits++;
      });
      if(hits)score+=Math.min(72,28+(hits*14));
    });

    if(analysis.natural){
      if(item.category==='zasady')score+=10;
      if(item.type==='Prywatność'||item.type==='Regulamin')score+=8;
    }
    return score;
  }

  function scoreItem(item,query,scope,analysis){
    var q=normalize(query);
    var qTokens=expandTokens(q);
    if(!qTokens.length)return (item.priority||0)+(scope&&item._game===scope?35:0)+smartBoost(item,analysis||smartAnalysis(query));

    var score=0,matched=0;
    if(item._title===q)score+=220;
    else if(item._title.indexOf(q)===0)score+=145;
    else if(item._title.indexOf(q)!==-1)score+=105;
    if(item._keys.indexOf(q)!==-1)score+=62;
    if(item._desc.indexOf(q)!==-1)score+=36;

    qTokens.forEach(function(t){
      var local=0;
      if(item._title.split(' ').indexOf(t)!==-1)local=Math.max(local,44);
      if(item._title.indexOf(t)!==-1)local=Math.max(local,34);
      if(item._keys.split(' ').indexOf(t)!==-1)local=Math.max(local,27);
      if(item._keys.indexOf(t)!==-1)local=Math.max(local,21);
      if(item._desc.indexOf(t)!==-1)local=Math.max(local,14);
      if(item._game===t)local=Math.max(local,42);
      if(!local){
        for(var i=0;i<item._words.length;i++){
          if(fuzzyTokenMatch(t,item._words[i])){local=9;break;}
        }
      }
      if(local){matched++;score+=local;}
    });

    if(qTokens.length&&matched===qTokens.length)score+=38;
    var smart=smartBoost(item,analysis||smartAnalysis(query));
    if(!matched&&item._title.indexOf(q)===-1&&item._keys.indexOf(q)===-1&&item._desc.indexOf(q)===-1&&smart<=0)return -1;
    if(scope&&item._game===scope)score+=55;
    score+=smart;
    score+=(item.priority||0)*0.2;
    return score;
  }

  function contextScope(){
    var p=window.location.pathname;
    if(p.indexOf('/gry/poker-treningowy/')===0)return {key:'poker',label:'Poker'};
    if(p.indexOf('/gry/tysiac/')===0)return {key:'tysiac',label:'Tysiąc'};
    if(p.indexOf('/gry/warcaby/')===0)return {key:'warcaby',label:'Warcaby'};
    if(p.indexOf('/gry/gomoku/')===0)return {key:'gomoku',label:'Gomoku'};
    return null;
  }

  function effectiveFilter(ctx,parsed){
    return parsed.forcedFilter||ctx.filter||'all';
  }

  function effectiveScope(ctx,parsed){
    return parsed.scope||ctx.scope||'';
  }

  function categoryAllowed(item,filter){
    if(filter==='all')return true;
    if(filter==='gry')return item.category==='gry'||item.category==='academy';
    return item.category===filter;
  }

  function compute(ctx,ignoreFilter){
    var parsed=parseQuery(ctx.query);
    var filter=ignoreFilter?'all':effectiveFilter(ctx,parsed);
    var scope=effectiveScope(ctx,parsed);
    var q=parsed.clean;
    var analysis=smartAnalysis(q||ctx.query);
    var rows=INDEX.map(function(item){
      return {item:item,score:scoreItem(item,q,scope,analysis)};
    }).filter(function(row){
      if(row.score<0)return false;
      if(scope&&row.item.game&&normalize(row.item.game)!==scope)return false;
      if(!categoryAllowed(row.item,filter))return false;
      return true;
    });

    rows.sort(function(a,b){
      if(ctx.sort==='title')return a.item.title.localeCompare(b.item.title,'pl');
      if(b.score!==a.score)return b.score-a.score;
      return (b.item.priority||0)-(a.item.priority||0);
    });

    return {rows:rows,parsed:parsed,scope:scope,filter:filter,query:q,analysis:analysis};
  }

  function categoryCounts(ctx){
    var base=compute(ctx,true).rows;
    var counts={all:base.length,gry:0,academy:0,zasady:0,poradniki:0,informacje:0};
    base.forEach(function(row){
      var c=row.item.category;
      if(counts[c]!==undefined)counts[c]++;
      if(c==='academy')counts.gry++;
      else if(c==='gry')counts.gry++;
    });
    return counts;
  }

  function categoryLabel(key){
    var f=FILTERS.filter(function(x){return x.key===key;})[0];
    return f?f.label:key;
  }

  function iconFor(item){
    if(item.category==='academy')return 'A';
    if(item.category==='zasady')return '§';
    if(item.category==='poradniki')return '?';
    if(item.category==='gry')return '♠';
    if(item.type==='Prywatność')return 'R';
    if(item.type==='Regulamin'||item.type==='Dokument')return 'D';
    return 'i';
  }

  function highlight(text,query){
    var raw=String(text||'');
    var norm=normalize(raw);
    var qs=meaningfulTokens(query).filter(function(x){return x.charAt(0)!=='@';}).sort(function(a,b){return b.length-a.length;});
    if(!qs.length)return escapeHtml(raw);
    var spans=[];
    qs.forEach(function(q){
      var from=0,idx;
      while((idx=norm.indexOf(q,from))!==-1){
        spans.push([idx,idx+q.length]);
        from=idx+q.length;
      }
    });
    if(!spans.length)return escapeHtml(raw);
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
    return out+escapeHtml(raw.slice(last));
  }

  function searchUrl(ctx){
    var params=new URLSearchParams();
    if(ctx.query)params.set('q',ctx.query);
    if(ctx.filter&&ctx.filter!=='all')params.set('filter',ctx.filter);
    if(ctx.scope)params.set('scope',ctx.scope);
    if(ctx.sort&&ctx.sort!=='relevance')params.set('sort',ctx.sort);
    var q=params.toString();
    return '/szukaj/'+(q?'?'+q:'');
  }

  function renderFilters(ctx){
    var counts=categoryCounts(ctx);
    ctx.filters.innerHTML=FILTERS.map(function(f){
      var active=ctx.filter===f.key;
      return '<button type="button" class="gracz-search__filter'+(active?' is-active':'')+'" data-search-filter="'+f.key+'" aria-pressed="'+(active?'true':'false')+'">'+
        '<span>'+f.label+'</span><b>'+String(counts[f.key]||0)+'</b>'+
      '</button>';
    }).join('');
  }

  function renderScope(ctx){
    if(!ctx.scopeWrap)return;
    var contextual=contextScope();
    var buttons=[];
    if(contextual){
      buttons.push('<button type="button" class="gracz-search__scope'+(ctx.scope===contextual.key?' is-active':'')+'" data-search-scope="'+contextual.key+'" aria-pressed="'+(ctx.scope===contextual.key?'true':'false')+'">Tylko '+escapeHtml(contextual.label)+'</button>');
    }
    if(ctx.scope){
      var labels={poker:'Poker',tysiac:'Tysiąc',warcaby:'Warcaby',gomoku:'Gomoku'};
      if(!contextual||contextual.key!==ctx.scope){
        buttons.push('<button type="button" class="gracz-search__scope is-active" data-search-scope="'+ctx.scope+'" aria-pressed="true">Tylko '+escapeHtml(labels[ctx.scope]||ctx.scope)+'</button>');
      }
      buttons.push('<button type="button" class="gracz-search__scope-clear" data-search-scope-clear>Wyczyść zakres</button>');
    }
    ctx.scopeWrap.innerHTML=buttons.join('');
    ctx.scopeWrap.hidden=!buttons.length;
  }

  function renderRecent(ctx){
    if(!ctx.recent)return;
    var list=safeStorageGet();
    if(ctx.query||!list.length){
      ctx.recent.hidden=true;
      ctx.recent.innerHTML='';
      return;
    }
    ctx.recent.hidden=false;
    ctx.recent.innerHTML='<div class="gracz-search__recent-head"><strong>Ostatnie wyszukiwania</strong><button type="button" data-search-clear-history>Wyczyść historię</button></div>'+
      '<div class="gracz-search__recent-list">'+list.map(function(q){
        return '<button type="button" data-search-query="'+escapeHtml(q)+'"><span>↺</span>'+escapeHtml(q)+'</button>';
      }).join('')+'</div>';
  }

  function renderSuggestions(ctx,result){
    if(!ctx.suggestions)return;
    if(!ctx.query){
      ctx.suggestions.hidden=true;
      ctx.suggestions.innerHTML='';
      return;
    }
    var correction=suggestionFor(ctx.query);
    var top=result.rows.slice(0,4);
    var parts=[];
    if(correction&&normalize(correction)!==normalize(parseQuery(ctx.query).clean)){
      parts.push('<button type="button" class="gracz-search__correction" data-search-query="'+escapeHtml(correction)+'"><span>Czy chodziło Ci o:</span> <strong>'+escapeHtml(correction)+'</strong></button>');
    }
    if(top.length){
      parts.push('<div class="gracz-search__suggestion-row"><span>Podpowiedzi:</span>'+top.map(function(row){
        return '<button type="button" data-search-query="'+escapeHtml(row.item.title)+'">'+highlight(row.item.title,ctx.query)+'</button>';
      }).join('')+'</div>');
    }
    ctx.suggestions.innerHTML=parts.join('');
    ctx.suggestions.hidden=!parts.length;
  }

  function renderSmart(ctx,result){
    if(!ctx.smart)return;
    var analysis=result.analysis;
    if(!ctx.query||!analysis){
      ctx.smart.hidden=true;
      ctx.smart.innerHTML='';
      return;
    }

    var labels=[];
    if(analysis.game.key)labels.push(analysis.game.label);
    if(analysis.intent.key!=='navigation')labels.push(analysis.intent.label);
    if(analysis.concepts.length)labels.push('kontekst tematyczny');

    var top=result.rows[0];
    var showCard=analysis.natural&&top&&top.score>=45;
    if(!labels.length&&!showCard){
      ctx.smart.hidden=true;
      ctx.smart.innerHTML='';
      return;
    }

    var html='<div class="gracz-search__smart-meta"><span class="gracz-search__smart-badge">R3 Smart</span>'+
      '<span>'+(labels.length?('Rozpoznano: '+escapeHtml(labels.join(' · '))):'Zapytanie w języku naturalnym')+'</span>'+
      '<strong>lokalnie · bez zewnętrznego AI</strong></div>';

    if(showCard){
      html+='<div class="gracz-search__smart-card">'+
        '<div><span>Najlepsze źródło w gracz.pl</span><strong>'+escapeHtml(top.item.title)+'</strong><p>'+escapeHtml(top.item.description)+'</p></div>'+
        '<a href="'+escapeHtml(top.item.url)+'" data-search-smart-open>Otwórz źródło <span aria-hidden="true">→</span></a>'+
      '</div>';
    }

    ctx.smart.innerHTML=html;
    ctx.smart.hidden=false;
  }

  function resultMarkup(row,index,query,best,idPrefix){
    var item=row.item;
    var game=item.game?('<span class="gracz-search__game">'+escapeHtml(item.game==='tysiac'?'Tysiąc':item.game.charAt(0).toUpperCase()+item.game.slice(1))+'</span>'):'';
    idPrefix=idPrefix||'gracz-search-result-';
    return '<a class="gracz-search__result'+(best?' is-best':'')+'" href="'+escapeHtml(item.url)+'" data-search-result data-index="'+index+'" role="option" id="'+idPrefix+index+'">'+
      '<span class="gracz-search__result-icon" aria-hidden="true">'+iconFor(item)+'</span>'+
      '<span class="gracz-search__result-main">'+
        '<span class="gracz-search__result-top"><strong>'+highlight(item.title,query)+'</strong><em>'+escapeHtml(item.type||categoryLabel(item.category))+'</em>'+game+(best?'<small>Najlepsze dopasowanie</small>':'')+'</span>'+
        '<span class="gracz-search__result-desc">'+highlight(item.description,query)+'</span>'+
        '<span class="gracz-search__result-url">'+escapeHtml(item.url)+'</span>'+
      '</span>'+
      '<span class="gracz-search__result-arrow" aria-hidden="true">→</span>'+
    '</a>';
  }

  function render(ctx){
    var result=compute(ctx,false);
    var rows=result.rows;
    var limit=ctx.mode==='page'?PAGE_LIMIT:MODAL_LIMIT;
    var shown=rows.slice(0,limit);
    ctx.active=-1;

    renderFilters(ctx);
    renderScope(ctx);
    renderRecent(ctx);
    renderSuggestions(ctx,result);
    renderSmart(ctx,result);

    if(ctx.resultsWindowButton){
      ctx.resultsWindowButton.hidden=!rows.length;
      ctx.resultsWindowButton.textContent=rows.length?('Pokaż wyniki w nowym oknie · '+rows.length):'Pokaż wyniki w nowym oknie';
    }

    if(!ctx.query)ctx.status.textContent=ctx.scope?'Popularne treści w wybranym zakresie':'Popularne miejsca w gracz.pl';
    else ctx.status.textContent=rows.length?('Znaleziono '+rows.length+(rows.length===1?' wynik':' wyników')):'Brak wyników';

    if(ctx.commandInfo){
      var parsed=result.parsed;
      if(parsed.commands.length){
        ctx.commandInfo.hidden=false;
        ctx.commandInfo.textContent='Aktywne skróty: '+parsed.commands.join(', ');
      }else{
        ctx.commandInfo.hidden=true;
        ctx.commandInfo.textContent='';
      }
    }

    if(!shown.length){
      var correction=suggestionFor(ctx.query);
      ctx.results.innerHTML='<div class="gracz-search__empty">'+
        '<strong>Nie znaleźliśmy pasującej treści.</strong>'+
        '<span>Spróbuj krótszej frazy, nazwy gry, filtra lub komendy np. <b>@poker</b>.</span>'+
        (correction?'<button type="button" data-search-query="'+escapeHtml(correction)+'">Szukaj: '+escapeHtml(correction)+'</button>':'')+
      '</div>';
    }else{
      ctx.results.innerHTML=shown.map(function(row,index){
        return resultMarkup(row,index,ctx.query,!!ctx.query&&index===0);
      }).join('');
    }

    if(ctx.more){
      if(ctx.mode==='modal'&&ctx.query&&rows.length){
        ctx.more.hidden=false;
        ctx.more.href=searchUrl(ctx);
        ctx.more.textContent=rows.length>limit?'Pokaż wszystkie '+rows.length+' wyników':'Otwórz pełną stronę wyników';
      }else ctx.more.hidden=true;
    }

    if(ctx.sortWrap){
      ctx.sortWrap.hidden=ctx.mode!=='page';
      if(ctx.sortSelect)ctx.sortSelect.value=ctx.sort;
    }

    if(ctx.mode==='page')scheduleUrlUpdate(ctx);
  }

  function setActive(ctx,index){
    var nodes=Array.prototype.slice.call(ctx.results.querySelectorAll('[data-search-result]'));
    if(!nodes.length){ctx.active=-1;ctx.input.removeAttribute('aria-activedescendant');return;}
    if(index<0)index=nodes.length-1;
    if(index>=nodes.length)index=0;
    ctx.active=index;
    nodes.forEach(function(node,i){node.classList.toggle('is-active',i===index);});
    var current=nodes[index];
    ctx.input.setAttribute('aria-activedescendant',current.id);
    current.scrollIntoView({block:'nearest'});
  }

  function setQuery(ctx,value){
    ctx.query=String(value||'').trim();
    ctx.input.value=ctx.query;
    render(ctx);
    ctx.input.focus();
  }

  function scheduleUrlUpdate(ctx){
    if(urlTimer)window.clearTimeout(urlTimer);
    urlTimer=window.setTimeout(function(){
      try{window.history.replaceState(null,'',searchUrl(ctx));}catch(_){}
    },120);
  }

  function copySearchLink(ctx,button){
    var url=window.location.origin+searchUrl(ctx);
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){
        var old=button.textContent;
        button.textContent='Skopiowano';
        window.setTimeout(function(){button.textContent=old;},1200);
      }).catch(function(){});
    }
  }

  function resultsWindowMarkup(){
    return '<div class="gracz-results-window__panel">'+
      '<header class="gracz-results-window__nav">'+
        '<div class="gracz-results-window__brand"><span class="gracz-search__brand">gracz<span>.pl</span></span><div><strong>Wyniki wyszukiwania</strong><small>Tylko wyniki · bez pozostałych elementów wyszukiwarki</small></div></div>'+
        '<div class="gracz-results-window__zoom" data-results-zoom-group role="group" aria-label="Powiększenie okna wyników: 100%">'+
          '<button type="button" data-results-zoom-out aria-label="Zmniejsz wyniki">A−</button>'+
          '<span data-results-zoom-value>100%</span>'+
          '<button type="button" data-results-zoom-in aria-label="Powiększ wyniki">A+</button>'+
        '</div>'+
        '<button type="button" class="gracz-results-window__close" data-results-window-close aria-label="Zamknij okno wyników"><span aria-hidden="true">×</span>Zamknij</button>'+
      '</header>'+
      '<div class="gracz-results-window__summary">'+
        '<div><span>Aktualne wyszukiwanie</span><strong data-results-window-title></strong></div>'+
        '<b data-results-window-count></b>'+
      '</div>'+
      '<div class="gracz-search__results gracz-results-window__list" data-results-window-list role="listbox" aria-label="Wyniki wyszukiwania w osobnym oknie"></div>'+
      '<footer class="gracz-results-window__foot"><span>Możesz zmniejszyć lub powiększyć tylko to okno wyników.</span><strong>Esc · zamknij</strong></footer>'+
    '</div>';
  }

  function createResultsWindow(){
    if(resultsWindowCtx)return resultsWindowCtx;
    var dialog=document.createElement('dialog');
    dialog.className='gracz-search-results-window';
    dialog.innerHTML=resultsWindowMarkup();
    document.body.appendChild(dialog);

    var ctx={
      root:dialog,
      list:dialog.querySelector('[data-results-window-list]'),
      title:dialog.querySelector('[data-results-window-title]'),
      count:dialog.querySelector('[data-results-window-count]'),
      zoomGroup:dialog.querySelector('[data-results-zoom-group]'),
      zoomOut:dialog.querySelector('[data-results-zoom-out]'),
      zoomIn:dialog.querySelector('[data-results-zoom-in]'),
      zoomValue:dialog.querySelector('[data-results-zoom-value]'),
      zoom:readResultsZoom(),
      query:''
    };

    applyResultsZoom(ctx,ctx.zoom,false);

    dialog.addEventListener('click',function(event){
      if(event.target===dialog||event.target.closest('[data-results-window-close]')){
        closeResultsWindow();return;
      }
      if(event.target.closest('[data-results-zoom-out]')){
        changeResultsZoom(ctx,-1);return;
      }
      if(event.target.closest('[data-results-zoom-in]')){
        changeResultsZoom(ctx,1);return;
      }
      var result=event.target.closest('[data-search-result]');
      if(result&&ctx.query)saveRecent(ctx.query);
    });

    dialog.addEventListener('cancel',function(event){
      event.preventDefault();
      closeResultsWindow();
    });

    dialog.addEventListener('close',function(){
      document.body.classList.remove('gracz-results-window-open');
      if(resultsWindowLastTrigger&&document.contains(resultsWindowLastTrigger)){
        try{resultsWindowLastTrigger.focus();}catch(_){}
      }
      resultsWindowLastTrigger=null;
    });

    resultsWindowCtx=ctx;
    return ctx;
  }

  function openResultsWindow(sourceCtx,trigger){
    var result=compute(sourceCtx,false);
    var rows=result.rows.slice(0,PAGE_LIMIT);
    if(!rows.length)return;

    var ctx=createResultsWindow();
    resultsWindowLastTrigger=trigger||document.activeElement;
    ctx.query=sourceCtx.query||'';
    ctx.title.textContent=ctx.query?('„'+ctx.query+'”'):(sourceCtx.scope?'Popularne wyniki w wybranym zakresie':'Popularne miejsca w gracz.pl');
    ctx.count.textContent=String(result.rows.length)+(result.rows.length===1?' wynik':' wyników');
    ctx.list.innerHTML=rows.map(function(row,index){
      return resultMarkup(row,index,sourceCtx.query,!!sourceCtx.query&&index===0,'gracz-search-window-result-');
    }).join('');
    applyResultsZoom(ctx,readResultsZoom(),false);

    if(typeof ctx.root.showModal==='function')ctx.root.showModal();
    else ctx.root.setAttribute('open','');
    document.body.classList.add('gracz-results-window-open');
    window.setTimeout(function(){
      var first=ctx.list.querySelector('[data-search-result]');
      if(first){try{first.focus({preventScroll:true});}catch(_){try{first.focus();}catch(__){}}}
    },0);
  }

  function closeResultsWindow(){
    if(!resultsWindowCtx)return;
    if(typeof resultsWindowCtx.root.close==='function'&&resultsWindowCtx.root.open)resultsWindowCtx.root.close();
    else{
      resultsWindowCtx.root.removeAttribute('open');
      document.body.classList.remove('gracz-results-window-open');
    }
  }

  function bindContext(ctx){
    ctx.input.addEventListener('input',function(){
      ctx.query=ctx.input.value.trim();
      render(ctx);
    });

    ctx.input.addEventListener('keydown',function(event){
      if(event.key==='ArrowDown'){event.preventDefault();setActive(ctx,ctx.active+1);}
      else if(event.key==='ArrowUp'){event.preventDefault();setActive(ctx,ctx.active-1);}
      else if(event.key==='Enter'){
        var active=ctx.results.querySelector('[data-index="'+ctx.active+'"]');
        if(active){
          event.preventDefault();
          saveRecent(ctx.query);
          window.location.assign(active.href);
        }else{
          var first=ctx.results.querySelector('[data-search-result]');
          if(first&&ctx.query){
            event.preventDefault();
            saveRecent(ctx.query);
            window.location.assign(first.href);
          }
        }
      }
    });

    ctx.root.addEventListener('click',function(event){
      var filter=event.target.closest('[data-search-filter]');
      if(filter){
        ctx.filter=filter.getAttribute('data-search-filter')||'all';
        render(ctx);ctx.input.focus();return;
      }

      var q=event.target.closest('[data-search-query]');
      if(q){
        setQuery(ctx,q.getAttribute('data-search-query')||'');return;
      }

      var scope=event.target.closest('[data-search-scope]');
      if(scope){
        var key=scope.getAttribute('data-search-scope')||'';
        ctx.scope=ctx.scope===key?'':key;
        render(ctx);ctx.input.focus();return;
      }

      if(event.target.closest('[data-search-scope-clear]')){
        ctx.scope='';render(ctx);ctx.input.focus();return;
      }

      if(event.target.closest('[data-search-clear]')){
        setQuery(ctx,'');return;
      }

      if(event.target.closest('[data-search-clear-history]')){
        clearRecent();render(ctx);ctx.input.focus();return;
      }

      var resultsWindowButton=event.target.closest('[data-search-results-window]');
      if(resultsWindowButton){
        openResultsWindow(ctx,resultsWindowButton);return;
      }

      if(event.target.closest('[data-search-fullscreen]')){
        toggleSearchFullscreen(ctx);return;
      }

      if(event.target.closest('[data-search-zoom-out]')){
        changeZoom(ctx,-1);return;
      }

      if(event.target.closest('[data-search-zoom-in]')){
        changeZoom(ctx,1);return;
      }

      var zoomLevel=event.target.closest('[data-search-zoom-level]');
      if(zoomLevel){
        var level=parseInt(zoomLevel.getAttribute('data-search-zoom-level')||'100',10);
        applyZoom(ctx,level,true);return;
      }

      if(event.target.closest('[data-search-zoom-reset]')){
        applyZoom(ctx,100,true);return;
      }

      var result=event.target.closest('[data-search-result]');
      if(result)saveRecent(ctx.query);

      var copy=event.target.closest('[data-search-copy]');
      if(copy){copySearchLink(ctx,copy);return;}

      if(ctx.mode==='modal'&&(event.target===ctx.root||event.target.closest('[data-search-close]')))closeModal();
    });

    if(ctx.sortSelect){
      ctx.sortSelect.addEventListener('change',function(){
        ctx.sort=ctx.sortSelect.value||'relevance';
        render(ctx);
      });
    }

    if(ctx.mode==='modal'){
      ctx.root.addEventListener('cancel',function(event){event.preventDefault();closeModal();});
      ctx.root.addEventListener('close',function(){
        document.body.classList.remove('gracz-search-open');
        if(lastTrigger&&document.contains(lastTrigger)){try{lastTrigger.focus();}catch(_){}}
        lastTrigger=null;
      });
    }
  }

  function shellMarkup(mode){
    var page=mode==='page';
    return '<div class="'+(page?'gracz-search-page__panel':'gracz-search__panel')+'">'+
      '<div class="gracz-search__head">'+
        '<div class="gracz-search__head-copy"><span class="gracz-search__brand">gracz<span>.pl</span></span><p>Inteligentna wyszukiwarka stworzona specjalnie dla naszych użytkowników portalu gracz.pl.</p></div>'+
        '<div class="gracz-search__head-actions">'+
          '<a class="gracz-search__learn-more" href="/wyszukiwarka/">Poznaj zalety naszej wyszukiwarki</a>'+
          (page
            ?'<a class="gracz-search__home" href="/">Wróć do serwisu</a>'
            :'<button type="button" class="gracz-search__maximize" data-search-fullscreen aria-pressed="false" aria-label="Powiększ wyszukiwarkę do rozmiaru okna przeglądarki"><span aria-hidden="true">⛶</span> Powiększ</button><button type="button" class="gracz-search__close" data-search-close aria-label="Zamknij wyszukiwarkę">×</button>')+
        '</div>'+
      '</div>'+
      '<h1 class="sr-only">'+(page?'Wyniki wyszukiwania gracz.pl':'Wyszukiwarka gracz.pl')+'</h1>'+
      '<div class="gracz-search__box">'+
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.8 15.8l4.6 4.6" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>'+
        '<input type="search" data-search-input autocomplete="off" spellcheck="false" placeholder="Szukaj lub wpisz całe pytanie…" aria-label="Szukaj w gracz.pl" aria-autocomplete="list">'+
        '<div class="gracz-search__field-actions">'+
          '<button type="button" class="gracz-search__clear" data-search-clear aria-label="Wyczyść wyszukiwanie">Wyczyść</button>'+
          '<div class="gracz-search__zoom" data-search-zoom-group role="group" aria-label="Powiększenie widoku wyszukiwarki: 100%">'+
            '<button type="button" data-search-zoom-out aria-label="Pomniejsz widok wyszukiwarki" title="Pomniejsz widok">A−</button>'+
            '<div class="gracz-search__zoom-selector">'+
              '<button type="button" class="gracz-search__zoom-value" data-search-zoom-selector aria-haspopup="true" aria-label="Aktualne powiększenie 100%. Wybierz poziom powiększenia"><span data-search-zoom-value>100%</span><span class="gracz-search__zoom-caret" aria-hidden="true">⌄</span></button>'+
              '<span class="gracz-search__zoom-tooltip" role="tooltip" aria-hidden="true">Wybierz poziom powiększenia</span>'+
              '<div class="gracz-search__zoom-menu" role="menu" aria-label="Poziomy powiększenia">'+
                '<button type="button" role="menuitemradio" data-search-zoom-level="100" aria-checked="true">100%</button>'+
                '<button type="button" role="menuitemradio" data-search-zoom-level="115" aria-checked="false">115%</button>'+
                '<button type="button" role="menuitemradio" data-search-zoom-level="130" aria-checked="false">130%</button>'+
                '<button type="button" role="menuitemradio" data-search-zoom-level="145" aria-checked="false">145%</button>'+
                '<button type="button" role="menuitemradio" data-search-zoom-level="160" aria-checked="false">160%</button>'+
                '<button type="button" role="menuitemradio" data-search-zoom-level="175" aria-checked="false">175%</button>'+
              '</div>'+
            '</div>'+
            '<button type="button" data-search-zoom-in aria-label="Powiększ widok wyszukiwarki" title="Powiększ widok">A+</button>'+
          '</div>'+
          '<button type="button" class="gracz-search__zoom-reset-note" data-search-zoom-reset hidden>Przywróć 100%</button>'+
        '</div>'+
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
      '<div class="gracz-search__commands"><span>Skróty:</span><button type="button" data-search-query="@poker ">@poker</button><button type="button" data-search-query="@zasady ">@zasady</button><button type="button" data-search-query="@academy ">@academy</button><button type="button" data-search-query="@rodo ">@rodo</button></div>'+
      '<div class="gracz-search__recent" data-search-recent hidden></div>'+
      '<div class="gracz-search__suggestions" data-search-suggestions hidden></div>'+
      '<div class="gracz-search__smart" data-search-smart hidden></div>'+
      '<div class="gracz-search__scope-wrap" data-search-scope-wrap hidden></div>'+
      '<div class="gracz-search__filters" data-search-filters aria-label="Filtry wyszukiwarki"></div>'+
      '<div class="gracz-search__results-window-bar"><button type="button" data-search-results-window hidden>Pokaż wyniki w nowym oknie</button></div>'+
      '<div class="gracz-search__meta">'+
        '<span data-search-status aria-live="polite"></span>'+
        '<span data-search-command-info hidden></span>'+
        (page?'<span class="gracz-search__sort" data-search-sort-wrap><label for="gracz-search-sort">Sortuj</label><select id="gracz-search-sort" data-search-sort><option value="relevance">Trafność</option><option value="title">A–Z</option></select></span>':'<span class="gracz-search__hint"><kbd>↑</kbd><kbd>↓</kbd> wybór <kbd>Enter</kbd> otwórz <kbd>Esc</kbd> zamknij</span>')+
      '</div>'+
      '<div class="gracz-search__results" data-search-results role="listbox" aria-label="Wyniki wyszukiwania"></div>'+
      '<div class="gracz-search__actions-row">'+
        '<a class="gracz-search__more" data-search-more href="/szukaj/" hidden></a>'+
        (page?'<button type="button" class="gracz-search__copy" data-search-copy>Skopiuj link do wyników</button>':'')+
      '</div>'+
      '<div class="gracz-search__foot"><span>SEARCH R3 działa lokalnie w gracz.pl. Rozumie pytania, intencję i kontekst bez wysyłania frazy do zewnętrznego AI.</span><strong>R3 · Ctrl K</strong></div>'+
    '</div>';
  }

  function contextFromRoot(root,mode){
    var params=mode==='page'?new URLSearchParams(window.location.search):new URLSearchParams();
    var ctx={
      root:root,
      mode:mode,
      query:mode==='page'?(params.get('q')||''):'',
      filter:mode==='page'?(params.get('filter')||'all'):'all',
      scope:mode==='page'?(params.get('scope')||''):'',
      sort:mode==='page'?(params.get('sort')||'relevance'):'relevance',
      active:-1
    };
    if(!FILTERS.some(function(f){return f.key===ctx.filter;}))ctx.filter='all';
    if(['','poker','tysiac','warcaby','gomoku'].indexOf(ctx.scope)===-1)ctx.scope='';
    if(['relevance','title'].indexOf(ctx.sort)===-1)ctx.sort='relevance';

    ctx.input=root.querySelector('[data-search-input]');
    ctx.results=root.querySelector('[data-search-results]');
    ctx.status=root.querySelector('[data-search-status]');
    ctx.filters=root.querySelector('[data-search-filters]');
    ctx.recent=root.querySelector('[data-search-recent]');
    ctx.suggestions=root.querySelector('[data-search-suggestions]');
    ctx.smart=root.querySelector('[data-search-smart]');
    ctx.scopeWrap=root.querySelector('[data-search-scope-wrap]');
    ctx.commandInfo=root.querySelector('[data-search-command-info]');
    ctx.resultsWindowButton=root.querySelector('[data-search-results-window]');
    ctx.more=root.querySelector('[data-search-more]');
    ctx.sortWrap=root.querySelector('[data-search-sort-wrap]');
    ctx.sortSelect=root.querySelector('[data-search-sort]');
    ctx.zoomGroup=root.querySelector('[data-search-zoom-group]');
    ctx.zoomOut=root.querySelector('[data-search-zoom-out]');
    ctx.zoomIn=root.querySelector('[data-search-zoom-in]');
    ctx.zoomValue=root.querySelector('[data-search-zoom-value]');
    ctx.zoomSelector=root.querySelector('[data-search-zoom-selector]');
    ctx.zoomReset=root.querySelector('[data-search-zoom-reset]');
    ctx.zoomOptions=Array.prototype.slice.call(root.querySelectorAll('[data-search-zoom-level]'));
    ctx.maximizeButton=root.querySelector('[data-search-fullscreen]');
    ctx.zoom=readZoom();
    ctx.input.value=ctx.query;
    ctx.input.setAttribute('aria-controls','gracz-search-results');
    ctx.results.id='gracz-search-results';
    applyZoom(ctx,ctx.zoom,false);
    bindContext(ctx);
    render(ctx);
    return ctx;
  }

  function createModal(){
    if(modalCtx)return modalCtx;
    var dialog=document.createElement('dialog');
    dialog.className='gracz-search';
    dialog.innerHTML=shellMarkup('modal');
    document.body.appendChild(dialog);
    modalCtx=contextFromRoot(dialog,'modal');
    return modalCtx;
  }

  function openModal(trigger,preset){
    lastTrigger=trigger||document.activeElement;
    var ctx=createModal();
    ctx.filter='all';
    ctx.scope='';
    ctx.sort='relevance';
    ctx.query=String(preset||'');
    ctx.input.value=ctx.query;
    setSearchFullscreen(ctx,false);
    render(ctx);
    if(typeof ctx.root.showModal==='function')ctx.root.showModal();
    else ctx.root.setAttribute('open','');
    document.body.classList.add('gracz-search-open');
    window.setTimeout(function(){ctx.input.focus();},0);
  }

  function closeModal(){
    if(!modalCtx)return;
    if(typeof modalCtx.root.close==='function'&&modalCtx.root.open)modalCtx.root.close();
    else{
      modalCtx.root.removeAttribute('open');
      document.body.classList.remove('gracz-search-open');
    }
  }

  function initPage(){
    var root=document.querySelector('[data-search-page-root]');
    if(!root)return;
    root.innerHTML=shellMarkup('page');
    pageCtx=contextFromRoot(root,'page');
    window.setTimeout(function(){pageCtx.input.focus();},0);
  }

  document.addEventListener('click',function(event){
    var trigger=event.target.closest('[data-modal="search"],[data-gracz-search]');
    if(!trigger)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openModal(trigger,trigger.getAttribute('data-search-preset')||'');
  },true);

  document.addEventListener('keydown',function(event){
    var target=event.target;
    var typing=target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();
      if(resultsWindowCtx&&resultsWindowCtx.root.open)closeResultsWindow();
      else if(modalCtx&&modalCtx.root.open)closeModal();
      else openModal(target,'');
      return;
    }
    if(!typing&&event.key==='/'&&!(modalCtx&&modalCtx.root.open)){
      event.preventDefault();
      openModal(target,'');
    }
  },true);

  initPage();

  window.GraczSearch={
    open:openModal,
    close:closeModal,
    search:function(query){openModal(null,query||'');},
    indexSize:INDEX.length,
    version:SEARCH_VERSION
  };
})();