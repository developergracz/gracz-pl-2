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
    updateNavigationIdentity(me.displayName);
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
  const me=view.players[view.viewerIndex];
  updateNavigationIdentity(me?.displayName||'Gracz');
  $('#round-number').textContent=state.roundNumber;
  $('#contract-value').textContent=state.contract??'—';
  $('#trump-value').textContent=state.trumpSuit?suitSymbol[state.trumpSuit]:'—';
  $('#bid-value').textContent=state.bid.highest??'—';
  $('#phase-label').textContent=phaseName[state.status]??state.status;
  renderScores();
  renderSeats();
  renderOpponentCards();
  renderBidLog();
  renderStatusPanel();
  renderTrick();
  renderTalon();
  renderControls();
  renderHand();
}

function updateNavigationIdentity(displayName){
  const safe=String(displayName||'Gracz').trim()||'Gracz';
  const name=$('#nav-name');
  const avatar=$('#nav-avatar');
  if(name)name.textContent=safe;
  if(avatar)avatar.textContent=initials(safe);
}

function renderScores(){
  const state=view.state;
  $('#score-list').innerHTML=view.players.map((player,index)=>{
    const key=playerKey(index);
    const active=state.currentPlayerIndex===index?' active':'';
    const role=index===state.declarerIndex?'rozgrywający':index===state.dealerIndex?'rozdający':'';
    return `<div class="score-row${active}"><div><strong>${escapeHtml(player.displayName)}</strong><small>${escapeHtml(role)}</small></div><b>${state.scores[key]}</b></div>`;
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
  node.innerHTML=`<span class="seat-avatar" aria-hidden="true">${escapeHtml(initials(player.displayName))}</span><strong>${escapeHtml(player.displayName)}${isSelf?' · TY':''}</strong><small>${count} kart · ${state.roundPoints[playerKey(index)]} pkt</small><span class="seat-score">${state.scores[playerKey(index)]}</span>`;
}

function renderOpponentCards(){
  const me=view.viewerIndex;
  const left=(me+1)%3;
  const right=(me+2)%3;
  fillOpponentCards('#cards-left',view.state.hands[playerKey(left)].length);
  fillOpponentCards('#cards-right',view.state.hands[playerKey(right)].length);
}

function fillOpponentCards(selector,count){
  const root=$(selector);
  if(!root)return;
  const safeCount=Math.max(0,Math.min(12,Number(count)||0));
  root.innerHTML=Array.from({length:safeCount},()=>'<span class="mini-back"></span>').join('');
}

function renderBidLog(){
  const state=view.state;
  const passed=new Set(state.bid.passed||[]);
  const root=$('#bid-log');
  if(!root)return;
  root.innerHTML=view.players.map((player,index)=>{
    const isHighest=state.bid.highestBidderIndex===index;
    const isPassed=passed.has(index);
    const klass=[isPassed?'passed':'',isHighest?'current':''].filter(Boolean).join(' ');
    let value='—';
    if(isPassed)value='PAS';
    else if(isHighest&&state.bid.highest!==null)value=String(state.bid.highest);
    else if(state.status!=='bidding'&&index===state.declarerIndex)value=String(state.contract??state.bid.highest??'—');
    return `<div class="bid-row ${klass}"><span>${escapeHtml(player.displayName)}</span><b>${escapeHtml(value)}</b></div>`;
  }).join('');
}

function renderStatusPanel(){
  const state=view.state;
  const declarer=state.declarerIndex===null?null:view.players[state.declarerIndex];
  const phase=$('#status-phase');
  const bid=$('#status-bid');
  const declarerNode=$('#status-declarer');
  const trick=$('#status-trick');
  if(phase)phase.textContent=phaseName[state.status]??state.status;
  if(bid)bid.textContent=state.bid.highest??'—';
  if(declarerNode)declarerNode.textContent=declarer?.displayName??'—';
  if(trick)trick.textContent=String(state.trickNumber??0);
}

function renderTrick(){
  const trick=view.state.trick;
  $('#trick').innerHTML=trick.length?trick.map(play=>cardHtml(play.card,false,view.players[play.playerIndex].displayName)).join(''):'<span class="empty-center">Oczekiwanie na kartę</span>';
}

function renderTalon(){
  const talon=view.state.talon;
  const label=$('#talon-label');
  if(label)label.hidden=!talon.length;
  if(!talon.length){$('#talon').innerHTML='';return}
  $('#talon').innerHTML=talon.map(card=>card.hidden?cardHtml(card,true):cardHtml(card,false)).join('');
}

function renderControls(){
  const state=view.state;
  const me=view.viewerIndex;
  const myTurn=state.currentPlayerIndex===me;
  const current=state.currentPlayerIndex===null?null:view.players[state.currentPlayerIndex];
  $('#turn-message').textContent=current?`${myTurn?'Twoja kolej':'Ruch gracza'}${myTurn?'':`: ${current.displayName}`}`:phaseSummary(state);
  const controls=$('#controls');
  controls.innerHTML='';

  if(state.status==='bidding'&&myTurn){
    const min=(state.bid.highest??90)+10;
    controls.innerHTML=`<div class="field"><input id="bid-input" aria-label="Wartość licytacji" type="number" min="${min}" max="360" step="10" value="${min}"><button id="bid-button">LICYTUJ</button></div><button id="pass-button" class="secondary">PAS</button>`;
    $('#bid-button').onclick=()=>sendAction({type:'bid',amount:Number($('#bid-input').value)});
    $('#pass-button').onclick=()=>sendAction({type:'pass'});
  }else if(state.status==='talon'&&state.declarerIndex===me){
    controls.innerHTML='<button id="talon-button">WEŹ MUSIK</button>';
    $('#talon-button').onclick=()=>sendAction({type:'take-talon'});
  }else if(state.status==='discard'&&state.declarerIndex===me){
    const opponents=[0,1,2].filter(index=>index!==me);
    const mapping=selectedGiftCards.map((id,index)=>`${formatCardId(id)} → ${view.players[opponents[index]]?.displayName??'?'}`).join(' · ');
    controls.innerHTML=`<span>${mapping||'Wybierz dwie karty — po jednej dla każdego przeciwnika.'}</span><button id="give-button" ${selectedGiftCards.length===2?'':'disabled'}>PRZEKAŻ KARTY</button>`;
    $('#give-button').onclick=()=>{
      if(selectedGiftCards.length!==2)return;
      sendAction({type:'give-cards',gifts:opponents.map((toPlayerIndex,index)=>({toPlayerIndex,cardId:selectedGiftCards[index]}))});
    };
  }else if(state.status==='contract'&&state.declarerIndex===me){
    const min=state.bid.highest;
    controls.innerHTML=`<div class="field"><input id="contract-input" aria-label="Wartość kontraktu" type="number" min="${min}" max="360" step="10" value="${min}"><button id="contract-button">USTAL KONTRAKT</button></div>`;
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
    if(error.status===409)await refresh().catch(()=>{});
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

function initials(value){
  return String(value??'?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase().slice(0,2)||'?';
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
function escapeHtml(value){return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]))}

addEventListener('beforeunload',()=>eventSource?.close());