/** PR #800: owner-approved chess composition. Gomoku remains Warcaby's reference.
 * Measure the real DOM, including scroll offsets: scrolling a control into view
 * must not be mistaken for a layout jump. No geometry or styles are injected.
 */
export async function readChessLayout(page){
  return page.evaluate(()=>{
    if(!document.body.classList.contains('chess-console'))return null;
    const layout=document.querySelector('.layout'),focus=layout.classList.contains('game-focus');
    const minimal=layout.dataset.minimalChess==='yes',minimalDesktop=minimal&&innerWidth>800,minimalMobile=minimal&&innerWidth<=800;
    const approved=layout.dataset.approvedOwnerChess==='yes';
    const selectors={board:'#board',frame:'.boardframe',arena:'.arena',dock:'.side-dock',
      settings:'.sidebar',settingsSlot:'.console-settings-slot',players:'.players',status:'#game-state',
      match:'#match-panel',tabs:'.dock-tabs',moves:'#moves-list',chat:'#chat-messages',composer:'.mini-chat',
      tools:'.game-tools',heading:'.chess-reference-heading',bottom:'.bottom',
      nav:'.premium-quick-links',footer:'.sidebar-footer',configOpen:'#console-config-open',
      chatInput:'#chat-input',chatSend:'#chat-send',configCard:'.console-config-card',configTiles:'#console-config-tiles',focusNav:'#focus-nav',
      restart:'#restart',invite:'.chess-reference-invite',clock1:'#clock-1',clock2:'#clock-2'};
    const elements=Object.fromEntries(Object.entries(selectors).map(([k,s])=>[k,document.querySelector(s)]));
    const rect=el=>{
      if(!el||el.closest('[hidden]')||getComputedStyle(el).visibility==='hidden')return null;
      const r=el.getBoundingClientRect();if(!r.width||!r.height)return null;
      // Layout coordinates, independent of page/dock/settings scrolling.
      let x=r.x+scrollX,y=r.y+scrollY;
      for(let p=el.parentElement;p&&p!==document.body&&p!==document.documentElement;p=p.parentElement){x+=p.scrollLeft;y+=p.scrollTop;}
      return {x,y,width:r.width,height:r.height};
    };
    const boxes=Object.fromEntries(Object.entries(elements).map(([k,e])=>[k,rect(e)]));
    const issues=[],hidden=key=>layout.classList.contains('console-hide-'+key);
    const require=(ok,message)=>{if(!ok)issues.push(message);};
    const inside=(a,b)=>a&&b&&a.x>=b.x-2&&a.y>=b.y-2&&a.x+a.width<=b.x+b.width+2&&a.y+a.height<=b.y+b.height+2;
    const overlap=(a,b)=>a&&b&&Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>2;
    require(boxes.board&&boxes.board.width>=80&&Math.abs(boxes.board.width-boxes.board.height)<=2,'plansza nie jest kwadratowa');
    require(inside(boxes.board,boxes.frame),'plansza wychodzi poza swój obszar');
    if(!focus){
      require(elements.dock?.parentElement===elements.arena?.parentElement,'dock nie jest obok obszaru planszy');
      require(elements.settings?.parentElement===elements.dock,'ustawienia nie należą do prawego panelu');
      if(minimalDesktop)require(elements.players?.parentElement===elements.dock,'zegary nie są w prawym panelu');
      else require(elements.players?.parentElement===elements.arena?.parentElement,'zegary nie są nad planszą');
      require(getComputedStyle(elements.frame).padding==='0px'&&getComputedStyle(elements.frame).borderTopWidth==='0px','zewnętrzna rama planszy');
      const coordinates=[...document.querySelectorAll('.chess-coordinate')];
      require(coordinates.length===16&&coordinates.every(e=>inside(rect(e),rect(e.parentElement))),'oznaczenia poza polami planszy');
      if(minimalDesktop||minimalMobile)require(!boxes.heading,'ozdobny nagłówek powinien być ukryty');
      else require(!!boxes.heading!==hidden('heading'),'niewłaściwa widoczność nagłówka');
      require(!!boxes.dock!==hidden('dock'),'niewłaściwa widoczność prawego panelu');
      if(minimalDesktop||minimalMobile)require(!boxes.nav,'ozdobny pasek linków powinien być ukryty');
      else require(!!boxes.nav!==hidden('quicklinks'),'niewłaściwa widoczność nawigacji');
      if(boxes.dock){
        // The approved mobile console intentionally has no visible advanced-settings panel.
        if(!approved)if(!(approved&&minimalMobile))require(!!boxes.settings!==hidden('sidebar'),'niewłaściwa widoczność ustawień');
        require(!!boxes.players!==hidden('players'),'niewłaściwa widoczność graczy');
        if(approved){
          require(!boxes.tools,'zatwierdzony widok nie może pokazywać paska ikon');
          require(!document.querySelector('.chess-minimal-more')?.getBoundingClientRect().height,'zatwierdzony widok nie może pokazywać Więcej ustawień');
          require(!boxes.status||!!document.querySelector('#game-state .chess-promote'),'status poza wyborem promocji nie powinien zajmować miejsca');
          const shown=[...document.querySelectorAll('.chess-reference-actions button')].filter(e=>{
            const r=e.getBoundingClientRect();return r.width>0&&r.height>0;
          });
          require(shown.length===3,'muszą być dokładnie trzy działania: Nowa gra, Rewanż, Zaproś do gry');
          require(shown.map(e=>e.textContent.trim()).join('|')==='Nowa gra|Rewanż|Zaproś do gry','niewłaściwa kolejność działań');
        }else{
          require(!!boxes.tools!==hidden('tools'),'niewłaściwa widoczność narzędzi');
          require(!!boxes.status!==hidden('status'),'niewłaściwa widoczność komunikatu gry');
        }
        for(const name of ['settings','status','match','tools']){
          const b=boxes[name],d=boxes.dock;
          require(!b||(b.x>=d.x-2&&b.x+b.width<=d.x+d.width+2),name+' wychodzi poza szerokość panelu');
        }
        if(!hidden('players')){require(boxes.clock1&&boxes.clock2,'brak widocznych zegarów');if(minimalDesktop){
            require(inside(boxes.players,boxes.dock),'zegary poza prawym panelem');
            require(boxes.clock1?.width>=48&&boxes.clock2?.width>=48,'zegary nieczytelne w panelu');
          }else require(!boxes.players||!boxes.board||boxes.players.y+boxes.players.height<=boxes.board.y+3,'zegary zachodzą na planszę');}
        if(innerWidth>800){
          require(boxes.dock.x>=boxes.board.x+boxes.board.width-2,'panel nie leży po prawej stronie planszy');
          require(boxes.board.width>=Math.min(boxes.arena.width,boxes.arena.height)-2,'plansza nie wykorzystuje dostępnego miejsca');
        }else{
          require(boxes.dock.y>=boxes.board.y+boxes.board.height-2,'panel nie leży pod planszą');
          if(minimalMobile){
            const mobileMode=layout.querySelector('.boardarea > .chess-mobile-mode');
            const header=layout.querySelector('.boardarea > .chess-mobile-heading');
            const modeBox=rect(mobileMode),headerBox=rect(header);
            require(!!modeBox&&!!headerBox,'brak mobilnego nagłówka lub trybów');
            require(!!modeBox&&!!boxes.players&&boxes.players.y+boxes.players.height<=modeBox.y+2,'zatwierdzone zegary mobilne muszą być nad trybami');
            require(!!modeBox&&!!boxes.board&&modeBox.y+modeBox.height<=boxes.board.y+2,'tryby mobilne muszą być nad szachownicą');
            require(!!boxes.players&&boxes.players.y+boxes.players.height<=boxes.board.y+2,'zegary mobilne nie są nad szachownicą');
            require(boxes.board.width>=innerWidth-2,'szachownica mobilna nie wypełnia szerokości ekranu');
            const squares=[...document.querySelectorAll('#board>.chess-square')];
            require(squares.length===64,'mobilna plansza musi mieć 64 pola');
            require(squares.filter(el=>el.querySelector('.chess-coordinate-rank')).length===8,'cyfry nie są wewnątrz ośmiu lewych pól');
            require(squares.filter(el=>el.querySelector('.chess-coordinate-file')).length===8,'litery nie są wewnątrz ośmiu dolnych pól');
            const overflow=document.documentElement.scrollWidth>innerWidth+2;
            require(!overflow,'mobilny interfejs wychodzi poza ekran');
          }
        }
        for(const [a,b] of (approved?[]:[['settings','status'],['status','match'],['match','tools']]))
          require(!overlap(boxes[a],boxes[b]),'kolizja '+a+' / '+b);
        const history=elements.match.classList.contains('moves-only');
        if(history){
          require(boxes.moves?.height>100,'historia ruchów zwinięta do jednego wiersza');
          require(boxes.moves&&boxes.match&&Math.abs(boxes.match.y+boxes.match.height-boxes.moves.y-boxes.moves.height)<24,'historia nie wypełnia panelu');
          require(!boxes.chat&&!boxes.composer,'czat widoczny w zakładce Ruchy');
        }else if(!hidden('chat-history'))require(boxes.chat?.height>100,'lista wiadomości zwinięta');
        // The browser exercises both actions separately; assert real buttons and
        // their allocated boxes, including when online mode hides local restart.
        if(boxes.restart){
          require(boxes.restart.width>=44&&boxes.restart.height>=30,'Nowa rozgrywka jest obcięta');
          require(boxes.invite?.width>=44&&boxes.invite.height>=30,'Zaproś znajomego jest obcięte');
          require(!overlap(boxes.restart,boxes.invite),'przyciski rozgrywki nakładają się');
        }
      }
    }else{
      require(!boxes.dock&&!boxes.settings,'panel boczny widoczny w trybie Sama gra');
      require(boxes.players&&boxes.clock1&&boxes.clock2,'brak zegarów w trybie Sama gra');
    }
    return {focus,minimal:minimalDesktop,mobile:minimalMobile,boxes,issues};
  });
}

const STABLE=['board','frame','arena','dock','settings','players','status','match','tabs','tools','heading','bottom','nav','footer','configOpen','clock1','clock2','chatInput','chatSend','configCard','configTiles','focusNav'];
const deltas=(from,to,names,props)=>names.filter(name=>{
  const a=from?.boxes[name],b=to?.boxes[name];
  return a&&b&&props.some(p=>Math.abs(a[p]-b[p])>2);
});
export function analyseChessStep({step,viewport,records,initial,reference}){
  const issues=[...(records.settled.chess?.issues||['brak pomiaru układu Szachów'])];
  const mobile=Number(viewport.split('x')[0])<=800;
  // A mode change may reveal/hide Online room controls above clocks and chat,
  // legitimately moving downstream content on desktop as well as mobile.
  // Their horizontal position and width must remain stable; all ordinary
  // interactions still require full x/y/width/height stability.
  const modeChange=['online','online-time','training','invite','invite-close'].includes(step.id);
  const props=modeChange?['x','width']:['x','y','width','height'];
  if(!records.performed)issues.push('akcja niedostępna: '+(records.error||step.id));
  const expandedMinimalSettings=records.settled.chess?.minimal&&['time-bonus','config-open'].includes(step.id);
  if(step.kind==='click'&&!expandedMinimalSettings)for(const phase of ['after','settled']){
    const jumps=deltas(records.before.chess,records[phase].chess,STABLE,props);
    if(jumps.length)issues.push('skok '+phase+': '+jumps.join(', '));
  }
  if(step.kind==='restore'){
    const changed=deltas(initial.chess,records.settled.chess,STABLE,['x','y','width','height']);
    for(const name of STABLE.filter(n=>!['configCard','configTiles'].includes(n)))if(!!initial.chess.boxes[name]!==!!records.settled.chess.boxes[name])changed.push(name+' (widoczność)');
    if(changed.length)issues.push('brak powrotu do geometrii początkowej: '+changed.join(', '));
  }
  const s=records.settled,p=records.settledProbe;
  if(s.documentOverflow)issues.push('poziome przewijanie dokumentu');
  if(!p.boardInViewport)issues.push('plansza poza widokiem');
  if(p.overlaps?.length)issues.push('nakładające się elementy: '+p.overlaps.join(', '));
  if(p.versusMissing)issues.push('brak VS w trybie Sama gra');
  if(p.clockOutsideCard?.length)issues.push('zegar poza kartą gracza');
  if(p.clippedControls.length)issues.push('obcięte kontrolki: '+p.clippedControls.map(c=>c.control+' przez '+c.by).join(', '));
  const chat=p.chat;
  if(chat&&(chat.horizontalOverflow||chat.widerChildren||!chat.insideDock))issues.push('wiadomości wychodzą poza czat');
  if(reference&&p.fullscreenElement!==reference.settledProbe.fullscreenElement)issues.push('nieprawidłowy element pełnego ekranu');
  return {id:step.id,label:step.label,kind:step.kind,game:'szachy',viewport,
    performed:records.performed,error:records.error,issues,pass:!issues.length,
    geometry:s.chess?.boxes,chat,fullscreenElement:p.fullscreenElement,layoutClasses:p.layoutClasses};
}
