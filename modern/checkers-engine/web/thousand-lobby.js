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

  function installGuestButton(){
    const form=document.querySelector('#auth-form');
    if(!form||document.querySelector('#guest-thousand-demo'))return;
    const button=document.createElement('button');
    button.id='guest-thousand-demo';
    button.type='button';
    button.textContent='WEJDŹ JAKO GOŚĆ — ZOBACZ TYSIĄCA';
    button.style.cssText='width:100%;margin-top:2px;padding:12px;border:1px solid #b89b43;border-radius:7px;background:linear-gradient(180deg,#fff0a9,#d8aa3c);color:#182018;font-weight:900;cursor:pointer';
    const note=document.createElement('small');
    note.id='guest-thousand-note';
    note.textContent='Tryb demonstracyjny · bez zakładania konta · bez wpływu na ranking';
    note.style.cssText='display:block;text-align:center;color:#8fa0ac;font-size:10px;margin-top:-5px';
    const submit=form.querySelector('#auth-submit');
    submit?.insertAdjacentElement('afterend',button);
    button.insertAdjacentElement('afterend',note);
    button.addEventListener('click',enterGuestDemo);
  }

  async function enterGuestDemo(){
    const button=document.querySelector('#guest-thousand-demo');
    const note=document.querySelector('#guest-thousand-note');
    if(!button)return;
    button.disabled=true;
    button.textContent='URUCHAMIAM TRYB GOŚCIA…';
    if(note)note.textContent='Tworzę bezpieczną sesję i stół demonstracyjny.';
    try{
      const guest=await api('/auth/guest',{method:'POST'});
      sessionStorage.setItem('gracz-session',JSON.stringify({token:'cookie',user:guest.user}));
      const suffix=guest.user.userId.replace(/^guest-/,'').slice(0,8);
      const result=await api('/thousand/games',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          dealerIndex:2,
          players:[
            {userId:guest.user.userId,displayName:guest.user.displayName},
            {userId:`demo-a-${suffix}`,displayName:'Anna · demo'},
            {userId:`demo-b-${suffix}`,displayName:'Marek · demo'}
          ]
        })
      });
      location.href=`/thousand.html?game=${encodeURIComponent(result.gameId)}`;
    }catch(error){
      button.disabled=false;
      button.textContent='WEJDŹ JAKO GOŚĆ — ZOBACZ TYSIĄCA';
      if(note){note.textContent=error.message;note.style.color='#ff8585'}
    }
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
    card.innerHTML=`<div class="card-top"><div><h2>TYSIĄC <span>ONLINE</span></h2><p>Klasyczna polska gra karciana dla 3 graczy.</p></div><span class="thousand-badge">3 GRACZY</span></div>
      <div class="game-preview thousand-preview" aria-label="Stół do Tysiąca">
        <div class="thousand-table-mini">
          <div class="thousand-seat-mini seat-a"><span></span><b>GRACZ</b></div>
          <div class="thousand-seat-mini seat-b"><span></span><b>GRACZ</b></div>
          <div class="thousand-seat-mini seat-c"><span></span><b>TY</b></div>
          <div class="thousand-logo-mini">TYSIĄC<small>gra do 1000 pkt</small></div>
          <div class="thousand-hand-mini hand-top"><i>♠</i><i>♥</i><i>♦</i><i>♣</i></div>
          <div class="thousand-hand-mini hand-bottom"><i>A♠</i><i>10♥</i><i>K♦</i><i>Q♣</i><i>J♥</i></div>
        </div>
      </div>
      <div class="game-card-foot"><div><strong id="thousand-room-count">0</strong><span>aktywnych stołów</span></div><button id="open-thousand-lobby" class="play-btn" type="button">GRAJ W TYSIĄCA →</button></div>`;
    games.append(card);
    const style=document.createElement('style');
    style.textContent=`
      .thousand-card{grid-column:1/-1;width:calc(50% - 9px);justify-self:center;background:linear-gradient(180deg,#0d1716,#08110f);color:#fff;border-color:#28423a}
      .thousand-card h2 span{color:#e9c65e}.thousand-badge{padding:5px 9px;border-radius:999px;border:1px solid #8c7435;background:#332b16;color:#f1d878;font-size:9px;font-weight:900;letter-spacing:.08em}
      .thousand-preview{height:240px;position:relative;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 35%,#12372a 0,#091812 70%);border-radius:0}
      .thousand-table-mini{position:relative;width:min(430px,84%);height:190px;border:8px solid #6b4024;border-radius:48%/42%;background:radial-gradient(circle at 50% 44%,#23784e 0,#15563a 48%,#0c3827 100%);box-shadow:inset 0 0 0 2px #9b6a3a,inset 0 0 35px #02130caa,0 18px 30px #0008}
      .thousand-table-mini:after{content:'';position:absolute;inset:15px;border:1px solid #dfc46c44;border-radius:48%/42%;pointer-events:none}
      .thousand-logo-mini{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#f4d77855;font-weight:900;font-size:28px;letter-spacing:.08em;text-align:center;text-shadow:0 2px 10px #000}.thousand-logo-mini small{display:block;margin-top:4px;font-size:9px;letter-spacing:.04em;color:#d9e9df77}
      .thousand-seat-mini{position:absolute;z-index:2;display:grid;justify-items:center;gap:2px;color:#d9e7df;font-size:7px}.thousand-seat-mini span{width:25px;height:25px;border-radius:50%;border:2px solid #e4c55b;background:radial-gradient(circle at 38% 32%,#60736b,#17221e 65%);box-shadow:0 3px 8px #0008}.seat-a{left:12px;top:72px}.seat-b{right:12px;top:72px}.seat-c{left:50%;bottom:5px;transform:translateX(-50%)}
      .thousand-hand-mini{position:absolute;display:flex;align-items:end}.thousand-hand-mini i{display:grid;place-items:center;width:34px;height:48px;margin-left:-12px;border:1px solid #d8d8d8;border-radius:5px;background:linear-gradient(#fff,#e9e6de);color:#151515;font-style:normal;font-size:13px;font-weight:900;box-shadow:0 4px 9px #0008}.thousand-hand-mini i:first-child{margin-left:0}.thousand-hand-mini i:nth-child(2),.thousand-hand-mini i:nth-child(3),.thousand-hand-mini i:nth-child(5){color:#b2232b}.hand-top{left:50%;top:12px;transform:translateX(-50%) scale(.72);transform-origin:top}.hand-bottom{left:50%;bottom:13px;transform:translateX(-50%) scale(.82);transform-origin:bottom}.hand-top i{background:linear-gradient(135deg,#1b4d89,#0d2d5d);color:#e8f1ff!important;border-color:#8eb5e8}
      .thousand-card .play-btn{background:linear-gradient(180deg,#d9b94e,#a87d18);color:#15130d}
      @media(max-width:1100px){.thousand-card{width:100%;grid-column:1/-1}}
      @media(max-width:720px){.thousand-card{width:100%}.thousand-table-mini{width:90%;height:170px}.thousand-preview{height:215px}.thousand-hand-mini i{width:30px;height:43px}}
      .thousand-modal{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:20px;background:#0009}.thousand-modal[hidden]{display:none}.thousand-panel{width:min(760px,96vw);max-height:84vh;overflow:auto;background:#f8f6ef;color:#314248;border:1px solid #b9aa78;border-radius:12px;box-shadow:0 20px 60px #0008}.thousand-panel header{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;background:#183c2d;color:white}.thousand-panel header button{border:0;background:transparent;color:white;font-size:28px;cursor:pointer}.thousand-body{padding:16px}.thousand-status{padding:10px 12px;margin-bottom:12px;border:1px solid #c9c0a6;background:#fff9e7}.thousand-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.thousand-actions button,.thousand-row button{padding:8px 12px;border:1px solid #81691f;border-radius:5px;background:linear-gradient(#ffe39b,#e9b849);font-weight:700;cursor:pointer}.thousand-list{display:grid;gap:8px}.thousand-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:10px;border:1px solid #d7d0be;background:white;border-radius:7px}.thousand-row small{display:block;color:#718087;margin-top:3px}.thousand-invite{position:fixed;right:22px;bottom:22px;z-index:5200;width:min(390px,calc(100vw - 44px));padding:15px;background:#fff6d5;border:1px solid #b89b43;border-radius:9px;box-shadow:0 12px 35px #0006}.thousand-invite-actions{display:flex;gap:8px;margin-top:10px}.thousand-invite-actions button{flex:1;padding:8px;cursor:pointer}`;
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
    installGuestButton(); installCard(); ensureModal(); refresh();
    if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(refresh,POLL_MS);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
