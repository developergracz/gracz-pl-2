const $=(selector)=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
let gameId=params.get('game');
let view=null;
let eventSource=null;
let selectedGiftCards=[];

const suitSymbol={spades:'♠',clubs:'♣',diamonds:'♦',hearts:'♥'};
const suitName={spades:'pik',clubs:'trefl',diamonds:'karo',hearts:'kier'};
const phaseName={bidding:'LICYTACJA',talon:'MUSIK',discard:'PRZEKAZANIE KART',contract:'KONTRAKT',playing:'ROZGRYWKA','round-ended':'KONIEC ROZDANIA','game-ended':'KONIEC GRY',redeal:'PONOWNE ROZDANIE'};

init().catch(showFatal);

async function init(){
  if(!gameId){await showSetup();return}
  $('#game').hidden=false;
  await refresh();
  connectRealtime();
}

async function showSetup(){
  $('#setup').hidden=false;
  $('#connection-state').textContent='nowy stół';
  let me;
  try{
    const result=await request('/auth/me');
    me=result.user;
    $('#me-name').textContent=`${me.displayName} (${me.userId})`;
  }catch(error){
    $('#setup-message').className='message error';
    $('#setup-message').textContent='Najpierw zaloguj się do Gracz.pl.';
    $('#setup-form button').disabled=true;
    return;
  }
  $('#setup-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=$('#setup-form button');
    button.disabled=true;
    setSetupMessage('Tworzę stół…');
    try{
      const players=[
        {userId:me.userId,displayName:me.displayName},
        {userId:$('#player2-id').value.trim(),displayName:$('#player2-name').value.trim()},
        {userId:$('#player3-id').value.trim(),displayName:$('#player3-name').value.trim()},
      ];
      const result=await request('/thousand/games',{method:'POST',body:{players}});
      location.href=`/thousand.html?game=${encodeURIComponent(result.gameId)}`;
    }catch(error){setSetupMessage(error.message,true);button.disabled=false}
  });
}

async function refresh(){
  const data=await request(`/thousand/games/${encodeURIComponent(gameId)}`);
  applyView(data);
}

function connectRealtime(){
  eventSource?.close();
  eventSource=new EventSource(`/thousand/games/${encodeURIComponent(gameId)}/events`);
  const receive=event=>{
    try{applyView(JSON.parse(event.data));$('#connection-state').textContent='online'}catch{}
  };
  eventSource.addEventListener('thousand.snapshot',receive);
  eventSource.addEventListener('thousand.updated',receive);
  eventSource.addEventListener('thousand.round-started',receive);
  eventSource.onopen=()=>{$('#connection-state').textContent='online'};
  eventSource.onerror=()=>{$('#connection-state').textContent='ponowne łączenie…'};
}

function applyView(data){
  view=data;
  selectedGiftCards=selectedGiftCards.filter(id=>myHand().some(card=>card.id===id));
  render();
}

function render(){
  if(!view)return;
  const state=view.state;
  $('#round-number').textContent=state.roundNumber;
  $('#contract-value').textContent=state.contract??'—';
  $('#trump-value').textContent=state.trumpSuit?suitName[state.trumpSuit]:'—';
  $('#bid-value').textContent=state.bid.highest??'—';
  $('#phase-label').textContent=phaseName[state.status]??state.status;
  renderScores();
  renderSeats();
  renderTrick();
  renderTalon();
  renderControls();
  renderHand();
}

function renderScores(){
  const state=view.state;
  $('#score-list').innerHTML=view.players.map((player,index)=>{
    const key=playerKey(index);
    const active=state.currentPlayerIndex===index?' active':'';
    return `<div class="score-row${active}"><div><strong>${escapeHtml(player.displayName)}</strong><small>${index===state.declarerIndex?'rozgrywający':index===state.dealerIndex?'rozdający':''}</small></div><b>${state.scores[key]}</b></div>`;
  }).join('');
}

function renderSeats(){
  const me=view.viewerIndex;
  const left=(me+1)%3;
  const right=(me+2)%3;
  renderSeat('#seat-left',left);
  renderSeat('#seat-right',right);
  renderSeat('#seat-self',me,true);
}

function renderSeat(selector,index,isSelf=false){
  const state=view.state;
  const player=view.players[index];
  const count=state.hands[playerKey(index)].length;
  const turn=state.currentPlayerIndex===index?' turn':'';
  const node=$(selector);
  node.className=`seat ${selector.slice(1)}${turn}`;
  node.innerHTML=`<strong>${escapeHtml(player.displayName)}${isSelf?' · TY':''}</strong><small>${count} kart · ${state.roundPoints[playerKey(index)]} pkt</small>`;
}

function renderTrick(){
  const trick=view.state.trick;
  $('#trick').innerHTML=trick.length?trick.map(play=>cardHtml(play.card,false,view.players[play.playerIndex].displayName)).join(''):'<span class="empty-center">Oczekiwanie na kartę</span>';
}

function renderTalon(){
  const talon=view.state.talon;
  if(!talon.length){$('#talon').innerHTML='';return}
  $('#talon').innerHTML=talon.map(card=>card.hidden?cardHtml(card,true):cardHtml(card,false)).join('');
}

function renderControls(){
  const state=view.state;
  const me=view.viewerIndex;
  const myTurn=state.currentPlayerIndex===me;
  const current=state.currentPlayerIndex===null?null:view.players[state.currentPlayerIndex];
  $('#turn-message').textContent=current?`${myTurn?'Twój ruch':'Ruch gracza'}${myTurn?'':`: ${current.displayName}`}`:phaseSummary(state);
  const controls=$('#controls');
  controls.innerHTML='';

  if(state.status==='bidding'&&myTurn){
    const min=(state.bid.highest??90)+10;
    controls.innerHTML=`<div class="field"><input id="bid-input" type="number" min="${min}" max="360" step="10" value="${min}"><button id="bid-button">LICYTUJ</button></div><button id="pass-button" class="secondary">PAS</button>`;
    $('#bid-button').onclick=()=>sendAction({type:'bid',amount:Number($('#bid-input').value)});
    $('#pass-button').onclick=()=>sendAction({type:'pass'});
  }else if(state.status==='talon'&&state.declarerIndex===me){
    controls.innerHTML='<button id="talon-button">WEŹ MUSIK</button>';
    $('#talon-button').onclick=()=>sendAction({type:'take-talon'});
  }else if(state.status==='discard'&&state.declarerIndex===me){
    const opponents=[0,1,2].filter(index=>index!==me);
    const mapping=selectedGiftCards.map((id,index)=>`${formatCardId(id)} → ${view.players[opponents[index]]?.displayName??'?'}`).join(' · ');
    controls.innerHTML=`<span>${mapping||'Wybierz z ręki dwie karty — po jednej dla każdego przeciwnika.'}</span><button id="give-button" ${selectedGiftCards.length===2?'':'disabled'}>PRZEKAŻ KARTY</button>`;
    $('#give-button').onclick=()=>{
      if(selectedGiftCards.length!==2)return;
      sendAction({type:'give-cards',gifts:opponents.map((toPlayerIndex,index)=>({toPlayerIndex,cardId:selectedGiftCards[index]}))});
    };
  }else if(state.status==='contract'&&state.declarerIndex===me){
    const min=state.bid.highest;
    controls.innerHTML=`<div class="field"><input id="contract-input" type="number" min="${min}" max="360" step="10" value="${min}"><button id="contract-button">USTAL KONTRAKT</button></div>`;
    $('#contract-button').onclick=()=>sendAction({type:'contract',amount:Number($('#contract-input').value)});
  }else if(state.status==='playing'&&myTurn&&state.trick.length===0){
    controls.innerHTML='<label class="marriage"><input id="marriage-check" type="checkbox"> Zgłoś meldunek przy tej karcie</label>';
  }else if(state.status==='round-ended'||state.status==='redeal'){
    controls.innerHTML='<button id="next-round">NASTĘPNE ROZDANIE</button>';
    $('#next-round').onclick=()=>nextRound();
  }else if(state.status==='game-ended'){
    const winner=view.players[state.winnerIndex];
    controls.innerHTML=`<strong>Partię wygrał ${escapeHtml(winner?.displayName??'gracz')}.</strong>`;
  }
}

function renderHand(){
  const state=view.state;
  const me=view.viewerIndex;
  const hand=myHand();
  const legal=new Set(view.legalCardIds??[]);
  const giftMode=state.status==='discard'&&state.declarerIndex===me;
  $('#hand-hint').textContent=giftMode?`Wybrano ${selectedGiftCards.length}/2`:state.status==='playing'&&state.currentPlayerIndex===me?'Podświetlone karty są legalne':'';
  const container=$('#hand');
  container.innerHTML=hand.map(card=>{
    const selected=selectedGiftCards.includes(card.id);
    const illegal=state.status==='playing'&&state.currentPlayerIndex===me&&!legal.has(card.id);
    return cardHtml(card,false,null,{selected,illegal});
  }).join('');
  [...container.querySelectorAll('.card[data-card-id]')].forEach(node=>{
    const cardId=node.dataset.cardId;
    if(giftMode){node.onclick=()=>toggleGift(cardId);return}
    if(state.status==='playing'&&state.currentPlayerIndex===me&&legal.has(cardId)){
      node.onclick=()=>sendAction({type:'play-card',cardId,declareMarriage:Boolean($('#marriage-check')?.checked)});
    }
  });
}

function toggleGift(cardId){
  const index=selectedGiftCards.indexOf(cardId);
  if(index>=0) selectedGiftCards.splice(index,1);
  else if(selectedGiftCards.length<2) selectedGiftCards.push(cardId);
  renderControls();renderHand();
}

async function sendAction(action){
  setActionMessage('Wysyłam ruch…');
  disableControls(true);
  try{
    const data=await request(`/thousand/games/${encodeURIComponent(gameId)}/actions`,{method:'POST',body:{action,expectedRevision:view.revision}});
    applyView(data);
    setActionMessage('');
  }catch(error){
    setActionMessage(error.message,true);
    if(error.status===409) await refresh().catch(()=>{});
  }finally{disableControls(false)}
}

async function nextRound(){
  setActionMessage('Rozdaję karty…');
  try{
    const data=await request(`/thousand/games/${encodeURIComponent(gameId)}/next-round`,{method:'POST',body:{expectedRevision:view.revision}});
    applyView(data);
    setActionMessage('');
  }catch(error){setActionMessage(error.message,true);if(error.status===409)await refresh().catch(()=>{})}
}

function myHand(){return view?.state?.hands?.[playerKey(view.viewerIndex)]??[]}
function playerKey(index){return `player-${index+1}`}
function phaseSummary(state){
  if(state.status==='game-ended')return 'Partia zakończona';
  if(state.status==='round-ended')return 'Rozdanie zakończone';
  return phaseName[state.status]??'';
}

function cardHtml(card,back=false,label=null,{selected=false,illegal=false}={}){
  if(back||card.hidden)return '<div class="card back" aria-label="zakryta karta"></div>';
  const red=card.suit==='hearts'||card.suit==='diamonds';
  const classes=['card',red?'red':'',selected?'selected':'',illegal?'illegal':''].filter(Boolean).join(' ');
  const title=label?` title="${escapeHtml(label)}"`:'';
  return `<div class="${classes}" data-card-id="${escapeHtml(card.id)}"${title}><span>${escapeHtml(card.rank)}</span><span class="suit">${suitSymbol[card.suit]}</span><span class="bottom">${escapeHtml(card.rank)}</span></div>`;
}

function formatCardId(id){
  const [suit,rank]=String(id).split('-');
  return `${rank??''}${suitSymbol[suit]??''}`;
}

async function request(url,{method='GET',body}={}){
  const response=await fetch(url,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});
  let data={};
  try{data=await response.json()}catch{}
  if(!response.ok){
    const error=new Error(data.error?.message||`Błąd HTTP ${response.status}`);
    error.code=data.error?.code;error.status=response.status;throw error;
  }
  return data;
}

function disableControls(disabled){for(const node of document.querySelectorAll('#controls button,#controls input'))node.disabled=disabled}
function setActionMessage(text,isError=false){const node=$('#action-message');node.textContent=text;node.className=`message${isError?' error':''}`}
function setSetupMessage(text,isError=false){const node=$('#setup-message');node.textContent=text;node.className=`message${isError?' error':''}`}
function showFatal(error){$('#connection-state').textContent='błąd';const target=$('#action-message')||$('#setup-message');if(target){target.textContent=error.message||'Nie udało się uruchomić gry.';target.className='message error'}}
function escapeHtml(value){return String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))}

addEventListener('beforeunload',()=>eventSource?.close());
