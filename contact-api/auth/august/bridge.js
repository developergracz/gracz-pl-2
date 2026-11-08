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
function navigation(){const header=document.querySelector('header');if(!header)return;const n=el('nav');n.style.cssText='display:flex;gap:12px;flex-wrap:wrap;font:12px Arial;padding:9px';for(const [title,id] of [['Panel','settings'],['Wiadomości','messages'],['Społeczność','community'],['Chat','global-chat'],['Turnieje','tournaments'],['Warcaby i gracze','players']])if(view!==id){const l=a(title,'/konto/sierpien/'+id+'.html');l.style.color='#b1efdc';n.append(l)}header.append(n)}
async function settings(){
 const labels={account:'Konto i profil',security:'Bezpieczeństwo',privacy:'Prywatność',notifications:'Powiadomienia',messages:'Wiadomości i chat',games:'Gry i rozgrywka',appearance:'Wygląd i dostępność',sessions:'Sesje i urządzenia',data:'Dane i konto'};
 const open=id=>{$$('.settings-nav [data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===id));$$('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));if($('#page-title'))$('#page-title').textContent=labels[id];history.replaceState(null,'','#'+id)};
 $$('.settings-nav [data-section]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.section)));
 const p=(await api('/auth/profile')).profile;
 for(const [id,v] of Object.entries({'#profile-name':p.displayName,'#profile-id':'@'+p.nickname,'#avatar':p.displayName.slice(0,1).toUpperCase()}))if($(id))$(id).textContent=v;
 for(const [id,v] of Object.entries({'#display-name':p.displayName,'#user-id':p.nickname,'#bio':p.bio||'','#country':p.country||'PL','#language':p.language||'pl','#email':p.email||''}))if($(id))$(id).value=v;
 if($('#bio-count'))$('#bio-count').textContent=String((p.bio||'').length);
 $('#bio')?.addEventListener('input',e=>{$('#bio-count').textContent=e.target.value.length});
 $('#save-profile')?.addEventListener('click',async()=>{const b=$('#save-profile');b.disabled=true;try{const payload={displayName:$('#display-name').value.trim(),bio:$('#bio').value.trim(),country:$('#country').value==='other'?'OTHER':$('#country').value,language:$('#language').value};const s=await save('/auth/profile',payload,'PUT');$('#profile-name').textContent=s.profile.displayName;tell('Zapisano profil w aktualnym systemie kont')}catch(e){tell(e.message)}finally{b.disabled=false}});
 // Security, 2FA and recovery MUST NOT be fake toggles.
 for(const ctl of $$('[data-setting],#twofa,#phone,#recovery-channel')){ctl.disabled=true;ctl.title='Ta opcja jest zarządzana w obecnym panelu konta'}
 const note=el('div','Dodatkowe ustawienia bezpieczeństwa i prywatności są dostępne w obecnym centrum konta.');note.style.cssText='margin:10px 0;padding:10px;border:1px solid #42654b;color:#a7e5cd';note.append(' ',a('Otwórz','/konto/panel/'));$('.settings-main')?.prepend(note);
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
 const f=(await api('/auth/friends/presence')).friends||[];
 for(const [id,n] of Object.entries({'#players-count':f.filter(x=>x.online).length,'#rooms-count':'—','#waiting-count':'—','#player-badge':f.length,'#room-badge':'—'}))if($(id))$(id).textContent=n;
 wipe($('#players'));
 for(const p of f){
  const box=el('div');box.style.cssText='padding:10px;border-bottom:1px solid #22454c;display:flex;flex-wrap:wrap;align-items:center;gap:9px';
  box.append(el('strong',p.nickname+(p.online?' • online':'')));
  const select=el('select');for(const [id,name] of [['warcaby','Warcaby'],['gomoku','Gomoku'],['szachy','Szachy']]){const option=el('option',name);option.value=id;select.append(option)}
  box.append(select,action('Zaproś do gry',async()=>{
   await save('/auth/social/challenges',{action:'send',nickname:p.nickname,game:select.value,timeLimitMinutes:0,incrementSeconds:0});
   tell('Wysłano zaproszenie do '+p.nickname+'.');
  }));$('#players')?.append(box)
 }
 wipe($('#rooms'));
 $('#rooms')?.append(el('p','Bieżące pokoje i konsola gry:'),a('Warcaby','/konto/warcaby/'),el('p',' '),a('Gomoku','/konto/gomoku/'),el('p',' '),a('Szachy','/konto/szachy/'));
 const area=$('#incoming');
 const inv=await api('/auth/social/challenges');const pending=(inv.challenges||[]).filter(c=>!c.outgoing&&c.status==='pending');
 if(area){area.hidden=pending.length===0;wipe(area);
  for(const c of pending){
   const box=el('div');box.style.cssText='padding:8px;border-bottom:1px solid #31515b';
   box.append(el('strong',c.opponent+' zaprasza do gry: '+c.game+' '));
   for(const [label,actionName] of [['Akceptuj','accept'],['Odrzuć','decline']])
    box.append(action(label,async()=>{await save('/auth/social/challenges',{action:actionName,id:c.id});tell('Zapisano odpowiedź');if(actionName==='accept')location.assign('/konto/'+c.game+'/?match='+encodeURIComponent(c.id));else box.remove()}));
   area.append(box);
  }
 }
 $('#create-room')?.addEventListener('click',()=>location.assign('/konto/warcaby/'));
 $('#back')?.addEventListener('click',()=>location.assign('https://gracz.pl/'));
}
async function chat(){
 const container=$('.chat-main')||$('.chat-shell')||document.body,wrap=el('section');wrap.style.cssText='padding:22px;max-width:940px;margin:auto';
 const list=el('div');list.style.cssText='min-height:300px;max-height:500px;overflow:auto;background:#081b24;border:1px solid #35636b;border-radius:10px;padding:12px';
 const form=el('form');form.style.cssText='display:flex;gap:10px;margin-top:12px';const input=el('input');input.required=true;input.maxLength=1000;input.placeholder='Napisz na chacie…';input.style.cssText='flex:1;min-width:100px;padding:10px';const sendButton=el('button','Wyślij');form.append(input,sendButton);wrap.append(el('h2','Chat ogólny'),list,form);container.replaceChildren(wrap);
 let busy=false;const load=async()=>{if(busy)return;busy=true;try{const data=await api('/auth/august/chat');wipe(list);for(const m of data.messages||[]){const p=el('p');p.style.cssText='white-space:pre-wrap;border-bottom:1px solid #24464c;padding:8px';p.append(el('strong',m.nickname+': '),document.createTextNode(m.body));list.append(p)}}catch(e){tell(e.message)}finally{busy=false}};
 form.addEventListener('submit',async e=>{e.preventDefault();sendButton.disabled=true;try{await save('/auth/august/chat',{body:input.value});input.value='';await load()}catch(x){tell(x.message)}finally{sendButton.disabled=false}});
 await load();const tick=setInterval(()=>{if(document.hidden)return;void load()},15000);window.addEventListener('pagehide',()=>clearInterval(tick),{once:true});
}
(async()=>{try{await who();navigation();if(view==='settings')await settings();if(view==='messages')await messages();if(view==='community')await community();if(view==='global-chat')await chat();if(view==='players')await players()}catch(x){tell(x.message)}})();
