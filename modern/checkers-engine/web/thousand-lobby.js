(() => {
  const GAME_TYPE='thousand';
  const POLL_MS=2200;
  let state={rooms:[],players:[],invitations:[]};
  let pollTimer=null;
  let modal=null;
  let creating=false;

  function currentUser(){
    try{return JSON.parse(sessionStorage.getItem('gracz-session')||'null')?.user||null}catch{return null}
  }
  async function api(path,options={}){
    const response=await fetch(path,{credentials:'same-origin',...options,headers:{accept:'application/json',...(options.headers||{})}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.error?.message||'Nie udało się wykonać operacji.');
    return body;
  }
  function ownRoom(){
    const user=currentUser(); if(!user)return null;
    return state.rooms.find(room=>room.gameType===GAME_TYPE&&room.seats?.some(seat=>seat?.id===user.userId)&&room.status==='waiting')||null;
  }
  function gameRoom(){
    const user=currentUser(); if(!user)return null;
    return state.rooms.find(room=>room.gameType===GAME_TYPE&&room.seats?.some(seat=>seat?.id===user.userId)&&room.status==='playing')||null;
  }
  async function refresh(){
    if(!currentUser()||document.querySelector('#lobby')?.hidden)return;
    try{
      state=await api('/lobby/state');
      renderCardState();
      renderModal();
      renderIncoming();
      const playing=gameRoom();
      if(playing?.gameId&&sessionStorage.getItem('thousand-entered-game')!==playing.gameId){
        sessionStorage.setItem('thousand-entered-game',playing.gameId);
        location.href=`/thousand.html?game=${encodeURIComponent(playing.gameId)}`;
      }
    }catch{}
  }

  function installCard(){
    const games=document.querySelector('#games');
    if(!games||document.querySelector('#thousand-module'))return;
    const card=document.createElement('article');
    card.id='thousand-module'; card.className='game-card thousand-card';
    card.innerHTML=`<div class="card-top"><div><h2>TYSIĄC <span>ONLINE</span></h2><p>Klasyczna polska gra karciana dla 3 graczy.</p></div></div>
      <div class="game-preview thousand-preview" aria-label="Stół do Tysiąca"><div class="thousand-deck"><span>♠</span><span>♥</span><span>♦</span><span>♣</span></div><div class="thousand-seats"><i></i><i></i><i></i></div></div>
      <div class="game-card-foot"><div><strong id="thousand-room-count">0</strong><span>aktywnych stołów</span></div><button id="open-thousand-lobby" class="play-btn" type="button">GRAJ W TYSIĄCA →</button></div>`;
    games.append(card);
    const style=document.createElement('style');
    style.textContent=`.thousand-card{background:linear-gradient(145deg,#11291f,#0b1c16);color:#fff}.thousand-card h2 span{color:#e7bd55}.thousand-preview{min-height:210px;position:relative;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at center,#226746,#123b2d 55%,#0b241b);border-radius:8px}.thousand-deck{display:flex;gap:8px;padding:18px 22px;border:2px solid #d8b85c;border-radius:14px;background:#f7f2df;color:#151515;font-size:34px;box-shadow:0 12px 25px #0007}.thousand-deck span:nth-child(2),.thousand-deck span:nth-child(3){color:#b5212a}.thousand-seats i{position:absolute;width:28px;height:28px;border:3px solid #e7bd55;border-radius:50%;background:#17212a}.thousand-seats i:nth-child(1){left:15%;top:45%}.thousand-seats i:nth-child(2){right:15%;top:45%}.thousand-seats i:nth-child(3){left:calc(50% - 14px);bottom:8%}.thousand-modal{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:20px;background:#0009}.thousand-modal[hidden]{display:none}.thousand-panel{width:min(760px,96vw);max-height:84vh;overflow:auto;background:#f8f6ef;color:#314248;border:1px solid #b9aa78;border-radius:12px;box-shadow:0 20px 60px #0008}.thousand-panel header{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;background:#183c2d;color:white}.thousand-panel header button{border:0;background:transparent;color:white;font-size:28px;cursor:pointer}.thousand-body{padding:16px}.thousand-status{padding:10px 12px;margin-bottom:12px;border:1px solid #c9c0a6;background:#fff9e7}.thousand-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.thousand-actions button,.thousand-row button{padding:8px 12px;border:1px solid #81691f;border-radius:5px;background:linear-gradient(#ffe39b,#e9b849);font-weight:700;cursor:pointer}.thousand-list{display:grid;gap:8px}.thousand-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:10px;border:1px solid #d7d0be;background:white;border-radius:7px}.thousand-row small{display:block;color:#718087;margin-top:3px}.thousand-invite{position:fixed;right:22px;bottom:22px;z-index:5200;width:min(390px,calc(100vw - 44px));padding:15px;background:#fff6d5;border:1px solid #b89b43;border-radius:9px;box-shadow:0 12px 35px #0006}.thousand-invite-actions{display:flex;gap:8px;margin-top:10px}.thousand-invite-actions button{flex:1;padding:8px;cursor:pointer}`;
    document.head.append(style);
    document.querySelector('#open-thousand-lobby')?.addEventListener('click',openModal);
  }

  function ensureModal(){
    if(modal)return modal;
    modal=document.createElement('div'); modal.className='thousand-modal'; modal.hidden=true;
    modal.innerHTML=`<section class="thousand-panel"><header><strong>Tysiąc — lobby 3-osobowe</strong><button type="button" aria-label="Zamknij">×</button></header><div class="thousand-body"><div id="thousand-status" class="thousand-status"></div><div class="thousand-actions"><button id="thousand-create" type="button">UTWÓRZ STÓŁ</button></div><h3>Gracze online</h3><div id="thousand-players" class="thousand-list"></div><h3>Stoły Tysiąca</h3><div id="thousand-rooms" class="thousand-list"></div></div></section>`;
    document.body.append(modal);
    modal.querySelector('header button').addEventListener('click',()=>modal.hidden=true);
    modal.addEventListener('click',event=>{if(event.target===modal)modal.hidden=true});
    modal.querySelector('#thousand-create').addEventListener('click',createRoom);
    return modal;
  }
  async function openModal(){ensureModal().hidden=false;await refresh()}

  async function createRoom(){
    if(creating)return; creating=true;
    try{
      await api('/lobby/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomName:'Tysiąc — szybka gra',gameType:GAME_TYPE})});
      await refresh();
    }catch(error){showStatus(error.message,true)}finally{creating=false}
  }
  async function joinRoom(room){
    try{await api(`/lobby/rooms/${encodeURIComponent(room.roomId)}/join`,{method:'POST'});await refresh()}catch(error){showStatus(error.message,true)}
  }
  async function invite(player){
    let room=ownRoom();
    if(!room){await createRoom();room=ownRoom()}
    if(!room)return;
    try{await api('/lobby/invitations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({toId:player.userId,roomId:room.roomId})});showStatus(`Zaproszenie wysłane do: ${player.displayName}`)}catch(error){showStatus(error.message,true)}
  }
  function showStatus(text,error=false){const node=document.querySelector('#thousand-status');if(node){node.textContent=text;node.style.borderColor=error?'#b94b4b':'#c9c0a6'}}

  function renderCardState(){
    const counter=document.querySelector('#thousand-room-count'); if(counter)counter.textContent=String(state.rooms.filter(room=>room.gameType===GAME_TYPE).length);
    const button=document.querySelector('#open-thousand-lobby');
    if(button){const room=ownRoom();button.textContent=room?`STÓŁ ${room.filledSeats}/${room.maxPlayers} — ZAPROŚ →`:'GRAJ W TYSIĄCA →'}
  }
  function renderModal(){
    if(!modal||modal.hidden)return;
    const user=currentUser(); if(!user)return;
    const room=ownRoom();
    showStatus(room?`Twój stół: ${room.filledSeats}/${room.maxPlayers} graczy. Gra ruszy automatycznie po zajęciu 3 miejsc.`:'Nie masz jeszcze stołu Tysiąca. Utwórz stół albo dołącz do istniejącego.');
    const players=modal.querySelector('#thousand-players'); players.replaceChildren();
    for(const player of state.players.filter(p=>p.userId!==user.userId)){
      const row=document.createElement('div');row.className='thousand-row';
      const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=player.displayName;const small=document.createElement('small');small.textContent=player.gameType?`${player.status} · ${player.gameType==='thousand'?'Tysiąc':'inna gra'}`:player.status;info.append(strong,small);
      const btn=document.createElement('button');btn.type='button';btn.textContent='Zaproś';btn.disabled=player.status==='w grze';btn.addEventListener('click',()=>invite(player));row.append(info,btn);players.append(row);
    }
    if(!players.children.length)players.textContent='Brak innych dostępnych graczy.';
    const rooms=modal.querySelector('#thousand-rooms');rooms.replaceChildren();
    for(const item of state.rooms.filter(r=>r.gameType===GAME_TYPE)){
      const row=document.createElement('div');row.className='thousand-row';
      const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=item.roomName;const small=document.createElement('small');small.textContent=`${item.filledSeats}/${item.maxPlayers} graczy · ${item.status==='waiting'?'oczekuje':'gra trwa'}`;info.append(strong,small);
      const mine=item.seats?.some(seat=>seat?.id===user.userId);const btn=document.createElement('button');btn.type='button';btn.textContent=mine?'Twój stół':item.status==='waiting'?'Dołącz':'W grze';btn.disabled=mine||item.status!=='waiting';btn.addEventListener('click',()=>joinRoom(item));row.append(info,btn);rooms.append(row);
    }
    if(!rooms.children.length)rooms.textContent='Brak aktywnych stołów Tysiąca.';
  }

  function renderIncoming(){
    const invitations=state.invitations.filter(inv=>inv.gameType===GAME_TYPE);
    for(const invitation of invitations){
      let box=document.querySelector(`[data-incoming-id="${CSS.escape(invitation.invitationId)}"]`);
      if(box)box.remove();
      box=document.createElement('aside');box.className='thousand-invite';box.dataset.incomingId=invitation.invitationId;box.dataset.thousandInvite='1';
      const title=document.createElement('strong');title.textContent=`${invitation.fromName} zaprasza Cię do Tysiąca`;
      const text=document.createElement('div');text.textContent=`Stół: ${invitation.roomName}`;
      const actions=document.createElement('div');actions.className='thousand-invite-actions';
      const no=document.createElement('button'),yes=document.createElement('button');no.type=yes.type='button';no.textContent='Odrzuć';yes.textContent='Akceptuj';
      no.addEventListener('click',()=>answer(invitation,false,box));yes.addEventListener('click',()=>answer(invitation,true,box));actions.append(no,yes);box.append(title,text,actions);document.body.append(box);
    }
  }
  async function answer(invitation,accept,box){
    try{
      const result=await api(`/lobby/invitations/${encodeURIComponent(invitation.invitationId)}/respond`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accept})});box.remove();
      if(result.accepted&&result.room?.status==='playing'&&result.room.gameId){sessionStorage.setItem('thousand-entered-game',result.room.gameId);location.href=`/thousand.html?game=${encodeURIComponent(result.room.gameId)}`;return}
      await refresh();
    }catch(error){box.querySelector('div').textContent=error.message}
  }

  function start(){
    installCard(); ensureModal(); refresh();
    if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(refresh,POLL_MS);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
