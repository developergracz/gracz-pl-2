const view=new URL(import.meta.url).searchParams.get('view');
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);if(cls)x.className=cls;return x};
const wipe=x=>x?.replaceChildren();
const status=el('div');status.setAttribute('role','status');status.style.cssText='position:fixed;right:16px;bottom:16px;z-index:200;max-width:420px;padding:12px 16px;color:#f1fff6;background:#103328;border:1px solid #47856d;border-radius:9px;display:none';document.body.append(status);
const tell=s=>{status.textContent=s;status.style.display='block';clearTimeout(tell.t);tell.t=setTimeout(()=>status.style.display='none',4000)};
async function api(path,options={}){const r=await fetch(path,{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json',...(options.headers||{})},...options});let v={};try{v=await r.json()}catch{}if(!r.ok||v.ok===false)throw Error(typeof v.error==='string'?v.error:v.error?.message||'Błąd serwera');return v}
const save=(path,value,method='POST')=>api(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(value)});
const a=(label,href)=>{const x=el('a',label);x.href=href;return x};
const action=(label,cb)=>{const b=el('button',label);b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await cb()}catch(e){tell(e.message)}finally{b.disabled=false}});return b};
async function who(){const r=await api('/auth/session');if(!r.loggedIn){location.replace('/konto/?widok=login');throw Error('Brak zalogowania')}for(const id of ['#identity','#mail-user','#user-name','#me-name'])if($(id))$(id).textContent=r.nickname;if($('#me-id'))$('#me-id').textContent='@'+r.nickname;return r}
function navigation(){
 const header=document.querySelector('.topbar,header');
 if(!header)return;
 if(view==='players'){
  const search=a('Wyszukiwarka','/auth/search-entry');
  search.className='panel-link';
  search.setAttribute('aria-label','Otwórz wyszukiwarkę GRACZ.PL');
  const user=header.querySelector('.user');
  if(user)user.insertBefore(search,user.querySelector('#back')||null);
  return;
 }
 const lookup=document.querySelector('a[href="/auth/search-entry"]');
 if(lookup){lookup.style.cssText='position:static;color:#5deab1;background:transparent;padding:7px 10px;text-decoration:none;white-space:nowrap;font-weight:700';header.append(lookup)}
 const n=el('nav');n.style.cssText='display:flex;gap:12px;flex-wrap:wrap;font:12px Arial;padding:9px';
 for(const [title,id] of [['Panel','settings'],['Wiadomości','messages'],['Społeczność','community'],['Chat','global-chat'],['Turnieje','tournaments'],['Warcaby i gracze','players']])
  if(view!==id){const l=a(title,'/konto/sierpien/'+id+'.html');l.style.color='#b1efdc';n.append(l)}
 header.append(n);
}

async function settings(){
 const labels={account:'Konto i profil',security:'Bezpieczeństwo',privacy:'Prywatność',notifications:'Powiadomienia',messages:'Wiadomości i chat',games:'Gry i rozgrywka',appearance:'Wygląd i dostępność',sessions:'Sesje i urządzenia',data:'Dane i konto'};
 const open=id=>{$$('.settings-nav [data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===id));$$('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));if($('#page-title'))$('#page-title').textContent=labels[id];history.replaceState(null,'','#'+id)};
 $$('.settings-nav [data-section]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.section)));
 const [profile,security,privacy,notice]=await Promise.all([
  api('/auth/profile'),api('/auth/security-center'),api('/auth/privacy-center'),api('/auth/notification-center')
 ]);
 const p=profile.profile,sec=security.preferences,pr=privacy.preferences,nt=notice.preferences;
 for(const [id,v] of Object.entries({'#profile-name':p.displayName,'#profile-id':'@'+p.nickname,'#avatar':p.displayName.slice(0,1).toUpperCase()}))if($(id))$(id).textContent=v;
 for(const [id,v] of Object.entries({'#display-name':p.displayName,'#user-id':p.nickname,'#bio':p.bio||'','#country':p.country||'PL','#language':p.language||'pl','#email':p.email||''}))if($(id))$(id).value=v;
 if($('#bio-count'))$('#bio-count').textContent=String((p.bio||'').length);
 $('#bio')?.addEventListener('input',e=>{$('#bio-count').textContent=e.target.value.length});
 $('#save-profile')?.addEventListener('click',async()=>{const btn=$('#save-profile');btn.disabled=true;try{const payload={displayName:$('#display-name').value.trim(),bio:$('#bio').value.trim(),country:$('#country').value==='other'?'OTHER':$('#country').value,language:$('#language').value};const d=await save('/auth/profile',payload,'PUT');$('#profile-name').textContent=d.profile.displayName;tell('Zapisano profil na koncie GRACZ.PL')}catch(e){tell(e.message)}finally{btn.disabled=false}});
 const supported=new Map([
  ['security.newLogin',{root:sec,key:'newSessionAlert',endpoint:'/auth/security-center',transform:()=>({newSessionAlert:sec.newSessionAlert,passwordAlert:sec.passwordAlert})}],
  ['security.accountChanges',{root:sec,key:'passwordAlert',endpoint:'/auth/security-center',transform:()=>({newSessionAlert:sec.newSessionAlert,passwordAlert:sec.passwordAlert})}],
  ['privacy.profile',{root:pr,key:'publicProfile',endpoint:'/auth/privacy-center',select:true,read:v=>v?'all':'none',write:v=>v==='all',transform:()=>pr}],
  ['privacy.online',{root:pr,key:'showOnline',endpoint:'/auth/privacy-center',select:true,read:v=>v?'friends':'none',write:v=>v!=='none',transform:()=>pr}],
  ['privacy.messages',{root:pr,key:'friendMessages',endpoint:'/auth/privacy-center',select:true,read:v=>v?'friends':'none',write:v=>v!=='none',transform:()=>pr}],
  ['privacy.invites',{root:pr,key:'gameInvites',endpoint:'/auth/privacy-center',select:true,read:v=>v?'friends':'none',write:v=>v!=='none',transform:()=>pr}],
  ['notify.messages',{root:nt,key:'messages',endpoint:'/auth/notification-center',transform:()=>({messages:nt.messages,friends:nt.friends,games:nt.games,highlightUnread:nt.highlightUnread,showNicknames:nt.showNicknames,showDates:nt.showDates,autoReadOnOpen:nt.autoReadOnOpen,muteMinutes:0})}],
  ['notify.invites',{root:nt,key:'games',endpoint:'/auth/notification-center',transform:()=>({messages:nt.messages,friends:nt.friends,games:nt.games,highlightUnread:nt.highlightUnread,showNicknames:nt.showNicknames,showDates:nt.showDates,autoReadOnOpen:nt.autoReadOnOpen,muteMinutes:0})}]
 ]);
 for(const input of $$('[data-setting]')){
  const item=supported.get(input.dataset.setting);
  if(!item){input.disabled=true;input.title='Ta opcja wymaga dalszej integracji';continue}
  if(item.select){
   for(const option of input.options)if(!['all','friends','none'].includes(option.value)||(option.value==='all'&&input.dataset.setting!=='privacy.profile'))option.disabled=true;
   if(input.dataset.setting==='privacy.profile')for(const option of input.options)if(option.value==='friends')option.disabled=true;
  }
  input.disabled=false;input.value=item.select?item.read(item.root[item.key]):input.value;
  if(input.type==='checkbox')input.checked=Boolean(item.root[item.key]);
  input.addEventListener('change',async()=>{
   const prior=item.root[item.key];item.root[item.key]=item.select?item.write(input.value):input.checked;
   input.disabled=true;try{
    // Server requires the full preference set, not a partial patch.
    if(item.root===nt&&nt.mutedUntil&&Date.parse(nt.mutedUntil)>Date.now())throw Error('Najpierw wyłącz wyciszenie powiadomień w centrum konta.');
    const result=await save(item.endpoint,item.transform(),'PUT');
    Object.assign(item.root,result.preferences||{});
    tell('Ustawienie zapisane w GRACZ.PL');
   }catch(e){item.root[item.key]=prior;if(input.type==='checkbox')input.checked=prior;else input.value=item.read(prior);tell(e.message)}
   finally{input.disabled=false}
  });
 }
 for(const ctl of ['#twofa','#phone','#recovery-channel'])if($(ctl)){$(ctl).disabled=true;$(ctl).title='Ta funkcja nie jest aktywna po stronie serwera'}
 const note=el('div','Opcje nieobsługiwane przez obecne API są zablokowane, aby nie pozorować ich zapisu.');
 note.style.cssText='margin:10px 0;padding:10px;border:1px solid #42654b;color:#a7e5cd';note.append(' ',a('Pełne centrum konta','/konto/panel/'));$('.settings-main')?.prepend(note);
 if($('#security-score'))$('#security-score').textContent='Ustawienia ochrony';
 if($('#twofa-badge'))$('#twofa-badge').textContent='Niedostępne';
 if($('#device-info'))$('#device-info').textContent='Aktualna sesja jest weryfikowana przez GRACZ.PL';
 const list=$('[data-panel=sessions] .empty-state');
 if(list){list.replaceChildren();for(const x of security.sessions||[]){const item=el('p',(x.current?'● Bieżąca: ':'○ ')+(x.label||'Urządzenie'));list.append(item)}}
 for(const b of $$('[data-toast],[data-action]'))b.addEventListener('click',()=>location.assign('/konto/panel/'));
 open(labels[location.hash.slice(1)]?location.hash.slice(1):'account');
}
async function messages(){
 const list=$('#message-list'),body=$('#message-view'),overlay=$('#compose-overlay');
 let conversations=[],folder='inbox';
 const filter=()=>{wipe(list);const q=($('#message-search')?.value||'').trim().toLowerCase();const items=conversations.filter(c=>folder==='archive'?c.archived:!c.archived&&(folder!=='unread'||c.unread>0)&&(folder!=='sent'||c.lastOwn)).filter(c=>c.nickname.toLowerCase().includes(q)||c.lastMessage?.toLowerCase().includes(q));if(!items.length){list.append(el('p','Brak rozmów.'));return}for(const c of items){const b=el('button');b.type='button';b.style.cssText='display:grid;gap:5px;padding:14px;width:100%;text-align:left;background:#0c1d23;color:#dcf2ec;border:0;border-bottom:1px solid #25434d';b.append(el('b',c.nickname),el('span',c.lastMessage||'Rozpocznij rozmowę'),el('small',c.unread?c.unread+' nowych':''));b.onclick=()=>open(c.nickname);list.append(b)}};
 async function reload(){conversations=(await api('/auth/message-center')).conversations||[];filter()}
 async function open(nick){const r=await api('/auth/social/messages?nick='+encodeURIComponent(nick));wipe(body);body.append(el('h2','Rozmowa z '+nick));for(const m of r.messages){const p=el('p');p.style.cssText='white-space:pre-wrap;border-bottom:1px solid #25434d;padding:10px';p.append(el('b',(m.own?'Ty':'@'+nick)+': '),document.createTextNode(m.body));body.append(p)}const text=el('textarea');text.maxLength=1000;text.placeholder='Wiadomość…';text.style.cssText='width:100%;min-height:100px;padding:10px;color:white;background:#08181f';body.append(text,action('Wyślij',async()=>{await save('/auth/social/messages',{nickname:nick,message:text.value});await reload();await open(nick)}))}
 $$('[data-folder]').forEach(b=>b.onclick=()=>{folder=b.dataset.folder;$$('[data-folder]').forEach(x=>x.classList.toggle('active',x===b));if($('#folder-title'))$('#folder-title').textContent=b.textContent.trim();filter()});
 $('#message-search')?.addEventListener('input',filter);$('#refresh-btn')?.addEventListener('click',reload);
 $('#compose-btn')?.addEventListener('click',()=>{overlay.hidden=false});
 $('#compose-close')?.addEventListener('click',()=>{overlay.hidden=true});
 $('#compose-cancel')?.addEventListener('click',()=>{overlay.hidden=true});
 // The current server accepts plain-text friend messages, not legacy HTML/attachments.
 if($('#rich-toolbar'))$('#rich-toolbar').hidden=true;
 if($('#message-attachment'))$('#message-attachment').closest('label').hidden=true;
 $('#compose-form')?.addEventListener('submit',async e=>{e.preventDefault();const nick=$('#recipient-search').value.trim(),subject=($('#compose-form [name=subject]')?.value||'').trim(),message=(subject?'Temat: '+subject+'\n\n':'')+($('#message-editor')?.textContent||'').trim();try{await save('/auth/social/messages',{nickname:nick,message});overlay.hidden=true;await reload();await open(nick);tell('Wysłano')}catch(x){tell(x.message)}});
 await reload();
}
async function community(){
 let connections=[],presence=[];
 const reload=async()=>{const [f,p]=await Promise.all([api('/auth/friends'),api('/auth/friends/presence')]);connections=f.connections||[];presence=p.friends||[];
 const accepted=connections.filter(x=>x.status==='accepted'),incoming=connections.filter(x=>x.status==='pending'&&x.direction==='incoming');
 for(const [id,v] of Object.entries({'#stat-online':presence.filter(x=>x.online).length,'#stat-friends':accepted.length,'#stat-requests':incoming.length,'#stat-topics':'—','#friend-count':accepted.length,'#request-count':incoming.length}))if($(id))$(id).textContent=v;
 for(const id of ['#online-list','#friends-list','#requests-list'])wipe($(id));
 for(const x of presence.filter(x=>x.online))$('#online-list')?.append(el('p','● '+x.nickname));
 for(const x of accepted){const row=el('article',null,'feature-card');row.append(el('b',x.nickname),el('p',presence.find(f=>f.nickname===x.nickname)?.online?'Online':'Offline'),a('Napisz wiadomość','/konto/sierpien/messages.html'));$('#friends-list')?.append(row)}
 for(const x of incoming){const row=el('article',null,'feature-card');row.append(el('b',x.nickname),action('Przyjmij',async()=>{await save('/auth/friends/action',{nickname:x.nickname,action:'accept'});await reload()}),action('Odrzuć',async()=>{await save('/auth/friends/action',{nickname:x.nickname,action:'decline'});await reload()}));$('#requests-list')?.append(row)}
 };
 const titles={feed:'Społeczność',players:'Gracze',friends:'Moi znajomi',requests:'Zaproszenia',clubs:'Kluby i grupy',events:'Wydarzenia'};
 $$('[data-view]').forEach(b=>b.onclick=()=>{$$('[data-view]').forEach(x=>x.classList.toggle('active',x===b));$$('[id^=view-]').forEach(x=>x.classList.toggle('active',x.id==='view-'+b.dataset.view));if($('#view-title'))$('#view-title').textContent=titles[b.dataset.view]});
 async function search(){const q=($('#global-search')?.value||'').trim(),root=$('#player-results');wipe(root);if(q.length<3)return;const r=await api('/auth/friends/search?nick='+encodeURIComponent(q));for(const x of r.players||[]){const row=el('article',null,'feature-card');row.append(el('b',x.nickname),action('Zaproś',async()=>{await save('/auth/friends/action',{nickname:x.nickname,action:'send'});tell('Wysłano zaproszenie');await reload()}));root?.append(row)}}
 $('#global-search')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('[data-view=players]')?.click();void search().catch(x=>tell(x.message))}});
 $('#find-player')?.addEventListener('click',()=>{$('[data-view=players]')?.click();$('#global-search')?.focus()});
 $('#refresh-feed')?.addEventListener('click',reload);
 await reload();
}
async function players(){
 let friends=[],pending=[],selectedFilter='all',query='';
 const games=[
  {id:'warcaby',title:'Warcaby',info:'Plansza 8 × 8'},
  {id:'gomoku',title:'Gomoku',info:'Pięć w rzędzie'},
  {id:'szachy',title:'Szachy',info:'Gra strategiczna'}
 ];
 const rooms=$('#rooms');wipe(rooms);
 for(const game of games){
  const item=el('article',undefined,'game-row');
  const info=el('span');info.append(el('strong',game.title),el('small',game.info));
  item.append(info,a('Otwórz grę','/konto/'+game.id+'/'));
  rooms?.append(item);
 }
 function showFriends(){
  const target=$('#players');wipe(target);
  const visible=friends.filter(f=>{
   if(selectedFilter==='online'&&!f.online)return false;
   if(selectedFilter==='offline'&&f.online)return false;
   return f.nickname.toLowerCase().includes(query);
  });
  if(!visible.length){
   target?.append(el('p',query?'Nie znaleziono znajomych o tym nicku.':friends.length?'Brak znajomych dla wybranego filtra.':'Nie masz jeszcze dodanych znajomych. Dodaj ich w sekcji „Moi znajomi” swojego panelu.','empty'));
   if(!friends.length)target?.append(a('Przejdź do znajomych','/konto/panel/'));
   return;
  }
  for(const friend of visible){
   const row=el('article',undefined,'friend-row');
   const avatar=el('span',friend.nickname.slice(0,1).toUpperCase(),'friend-avatar');avatar.setAttribute('aria-hidden','true');
   const info=el('span',undefined,'friend-info');
   info.append(el('strong',friend.nickname),el('small',friend.online?'● Online':'○ Offline',friend.online?'online':'offline'));
   const controls=el('span',undefined,'friend-controls');
   const select=el('select');select.setAttribute('aria-label','Wybierz grę dla '+friend.nickname);
   for(const game of games){const option=el('option',game.title);option.value=game.id;select.append(option)}
   const invite=action('Zaproś do gry',async()=>{
    await save('/auth/social/challenges',{action:'send',nickname:friend.nickname,game:select.value,timeLimitMinutes:0,incrementSeconds:0});
    tell('Zaproszenie wysłane do '+friend.nickname);
    await refreshInvites();
   });
   controls.append(select,invite);row.append(avatar,info,controls);target?.append(row);
  }
 }
 async function refreshInvites(){
  const data=await api('/auth/social/challenges');
  pending=(data.challenges||[]).filter(c=>c.status==='pending'&&!c.outgoing);
  if($('#waiting-count'))$('#waiting-count').textContent=pending.length;
  const area=$('#incoming');if(!area)return;
  wipe(area);area.hidden=pending.length===0;
  for(const invitation of pending){
   const row=el('div',undefined,'incoming-card');
   const title=el('strong',invitation.opponent+' zaprasza do gry w '+(games.find(g=>g.id===invitation.game)?.title||'grę'));
   const actions=el('span',undefined,'incoming-actions');
   for(const [label,mode] of [['Akceptuj','accept'],['Odrzuć','decline']]){
    actions.append(action(label,async()=>{
     await save('/auth/social/challenges',{action:mode,id:invitation.id});
     if(mode==='accept')location.assign('/konto/'+invitation.game+'/?match='+encodeURIComponent(invitation.id));
     else await refreshInvites();
    }));
   }
   row.append(title,actions);area.append(row);
  }
 }
 async function refreshFriends(){
  const p=await api('/auth/friends/presence');
  friends=Array.isArray(p.friends)?p.friends:[];
  if($('#players-count'))$('#players-count').textContent=friends.filter(f=>f.online).length;
  if($('#rooms-count'))$('#rooms-count').textContent=friends.length;
  if($('#player-badge'))$('#player-badge').textContent=friends.length;
  showFriends();
 }
 $('#search')?.addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();showFriends()});
 for(const button of $$('[data-filter]')){
  button.addEventListener('click',()=>{
   selectedFilter=button.dataset.filter;
   for(const b of $$('[data-filter]')){const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}
   showFriends();
  });
 }
 $('#create-room')?.addEventListener('click',()=>location.assign('/konto/warcaby/'));
 $('#back')?.addEventListener('click',()=>location.assign('https://gracz.pl/'));
 await Promise.all([refreshFriends(),refreshInvites()]);
}

async function chat(){
 const container=$('.chat-main')||$('.chat-shell')||document.body,wrap=el('section');wrap.className='august-live-chat';wrap.style.cssText='padding:22px;max-width:940px;margin:auto';
 const list=el('div');list.style.cssText='min-height:300px;max-height:500px;overflow:auto;background:#081b24;border:1px solid #35636b;border-radius:10px;padding:12px';
 const form=el('form');form.style.cssText='display:flex;gap:10px;margin-top:12px';const input=el('input');input.required=true;input.maxLength=1000;input.placeholder='Napisz na chacie…';input.style.cssText='flex:1;min-width:100px;padding:10px';const sendButton=el('button','Wyślij');form.append(input,sendButton);wrap.append(el('h2','Chat ogólny'),list,form);container.replaceChildren(wrap);
 let busy=false;const load=async()=>{if(busy)return;busy=true;try{const data=await api('/auth/august/chat');wipe(list);for(const m of data.messages||[]){const p=el('p');p.style.cssText='white-space:pre-wrap;border-bottom:1px solid #24464c;padding:8px';p.append(el('strong',m.nickname+': '),document.createTextNode(m.body));list.append(p)}}catch(e){tell(e.message)}finally{busy=false}};
 form.addEventListener('submit',async e=>{e.preventDefault();sendButton.disabled=true;try{await save('/auth/august/chat',{body:input.value});input.value='';await load()}catch(x){tell(x.message)}finally{sendButton.disabled=false}});
 await load();const tick=setInterval(()=>{if(document.hidden)return;void load()},15000);window.addEventListener('pagehide',()=>clearInterval(tick),{once:true});
}
(async()=>{try{await who();navigation();if(view==='settings')await settings();if(view==='messages')await messages();if(view==='community')await community();if(view==='global-chat')await chat();if(view==='players')await players()}catch(x){tell(x.message)}})();
