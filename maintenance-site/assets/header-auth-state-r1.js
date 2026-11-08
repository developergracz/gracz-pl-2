/* Shared public header state: display-only; NEVER used for authentication. */
(function(){
 'use strict';
 var header=document.querySelector('header.site-header');
 if(!header)return;
 var actions=header.querySelector('.header-actions');
 if(!actions)return;
 var buttons=Array.prototype.slice.call(actions.querySelectorAll('a,button'));
 var login=buttons.find(function(n){return n.textContent.trim()==='Zaloguj się';});
 var register=buttons.find(function(n){return n.textContent.trim()==='Załóż konto';});
 if(!login||!register)return;

 var uiStateStorageName='gracz.header.ui.v2';
 var maxAge=120000;
 var sessionOrigin='https://gracz-contact-api.onrender.com';
 var stateLink=new URL(location.href);
 var observed=stateLink.searchParams.get('gracz_header_state');
 var nicknameFragment=stateLink.hash.indexOf('#gracz_header_nick=')===0
  ?new URLSearchParams(stateLink.hash.slice(1)):null;
 var observedNickname=nicknameFragment?String(nicknameFragment.get('gracz_header_nick')||'').slice(0,32):'';
 var logout=document.createElement('button');
 logout.type='button';
 logout.className=login.className;
 logout.textContent='Wyloguj się';
 logout.setAttribute('aria-label','Wyloguj się z gracz.pl');
 logout.hidden=true;
 logout.style.setProperty('display','none','important');
 actions.appendChild(logout);

 // Display-only verified nickname from the account-origin top-level bridge.
 // textContent prevents markup injection; no cookie or login secret is read here.
 var userName=document.createElement('span');
 userName.className='gracz-header-user';
 userName.setAttribute('aria-label','Zalogowany gracz');
 userName.hidden=true;
 actions.insertBefore(userName,logout);

 var panelLink=document.createElement('a');
 panelLink.className='gracz-my-panel';
 panelLink.href=sessionOrigin+'/konto/panel/';
 panelLink.setAttribute('aria-label','Mój panel gracza');
 var icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
 icon.setAttribute('viewBox','0 0 24 24');
 icon.setAttribute('width','18');
 icon.setAttribute('height','18');
 icon.setAttribute('aria-hidden','true');
 var iconPath=document.createElementNS('http://www.w3.org/2000/svg','path');
 iconPath.setAttribute('d','M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z');
 iconPath.setAttribute('fill','none');
 iconPath.setAttribute('stroke','currentColor');
 iconPath.setAttribute('stroke-width','1.8');
 iconPath.setAttribute('stroke-linecap','round');
 icon.appendChild(iconPath);
 panelLink.appendChild(icon);
 panelLink.appendChild(document.createTextNode('Mój panel'));
 panelLink.hidden=true;
 actions.insertBefore(panelLink,logout);
 var uiStyles=document.createElement('link');
 uiStyles.rel='stylesheet';
 uiStyles.href='/assets/header-auth-display-r1.css?v=player-name-panel-r1';
 var stylesAttached=false;
 function loadUiStyles(){
  if(stylesAttached)return;
  stylesAttached=true;
  document.head.appendChild(uiStyles);
 }
 var neutral=document.createElement('button');
 neutral.type='button';
 neutral.addEventListener('click',function(){
  location.assign(sessionOrigin+'/konto/panel/');
 });
 neutral.textContent='Konto gracza';
 neutral.className=login.className;
 neutral.hidden=true;
 neutral.style.setProperty('display','none','important');
 actions.appendChild(neutral);

 function visible(node,show){
  node.hidden=!show;
  if(show)node.style.removeProperty('display');
  else node.style.setProperty('display','none','important');
 }
 function render(state,nickname){
  visible(login,state==='out');
  visible(register,state==='out');
  if(state==='in')loadUiStyles();
  userName.textContent=state==='in'?String(nickname||'').slice(0,32):'';
  visible(userName,state==='in'&&Boolean(userName.textContent));
  visible(panelLink,state==='in');
  visible(logout,state==='in');
  visible(neutral,state==='unknown');
  header.setAttribute('data-session-header',state);
 }
 function remember(state,nickname){
  var data={state:state,nickname:state==='in'?String(nickname||'').slice(0,32):'',at:Date.now()};
  try{localStorage.setItem(uiStateStorageName,JSON.stringify(data));}catch(_){}
  return data;
 }
 function cached(){
  try{
   var data=JSON.parse(localStorage.getItem(uiStateStorageName)||'null');
   if(data&&['in','out','unknown'].includes(data.state)
       &&typeof data.at==='number'&&Date.now()-data.at>=0
       &&Date.now()-data.at<maxAge)return data;
  }catch(_){}
  return null;
 }
 // Account origin can validate SameSite=Lax HttpOnly cookies only during a
 // top-level navigation. Redirect back with a non-privileged UI display hint.
 // Search already performs the authoritative top-level authentication bridge.
 // Avoid a second /auth/header-sync redirect here; two redirects visibly flash
 // the page and may race to replace the single-use search ticket in the URL.
 if(document.getElementById('search-access-layer')){
  var gateState=document.body.dataset.searchAccessState==='in'?'in':'out';
  var gateCached=cached();
  render(gateState,gateState==='in'&&gateCached?.state==='in'?gateCached.nickname:'');
  window.addEventListener('gracz:search-access-state',function(event){
   var state=event.detail?.state==='in'?'in':'out';
   var previous=cached();
   var nickname=state==='in'&&previous?.state==='in'?previous.nickname:'';
   render(state,nickname);
   remember(state,nickname);
  });
 }else if(['in','out','unknown'].includes(observed)){
  stateLink.searchParams.delete('gracz_header_state');
  // Restore any original anchor and immediately remove the temporary nickname
  // fragment from browser history before displaying the account name.
  if(nicknameFragment)stateLink.hash=nicknameFragment.get('gracz_header_anchor')||'';
  history.replaceState(history.state,'',stateLink.pathname+stateLink.search+stateLink.hash);
  var verified=remember(observed,observedNickname);
  render(verified.state,verified.nickname);
 }else{
  var stored=cached();
  if(stored)render(stored.state,stored.nickname);
  else{
   // Do not bounce preview environments or Lighthouse localhost to production.
   if(location.hostname!=='gracz.pl'&&location.hostname!=='www.gracz.pl'){
    render('out');
    return;
   }
   render('unknown');
   var sync=sessionOrigin+'/auth/header-sync?to='+encodeURIComponent(location.href);
   location.replace(sync);
   return;
  }
 }
 logout.addEventListener('click',function(){
  // No cookie or auth token is copied to this origin. Server-side logout
  // still runs on the real account origin with existing session validation.
  location.assign(sessionOrigin+'/konto/panel/?header_logout=1');
 });
 window.addEventListener('storage',function(event){
  if(event.key===uiStateStorageName){
   var latest=cached();
   if(latest)render(latest.state,latest.nickname);
  }
 });
 window.addEventListener('pageshow',function(event){
  if(event.persisted){
   var latest=cached();
   if(latest)render(latest.state,latest.nickname);
  }
 });
})();
