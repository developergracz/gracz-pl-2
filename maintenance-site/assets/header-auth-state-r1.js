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

 var uiStateStorageName='gracz.header.ui.v1';
 var maxAge=120000;
 var sessionOrigin='https://gracz-contact-api.onrender.com';
 var stateLink=new URL(location.href);
 var observed=stateLink.searchParams.get('gracz_header_state');
 var logout=document.createElement('button');
 logout.type='button';
 logout.className=login.className;
 logout.textContent='Wyloguj się';
 logout.setAttribute('aria-label','Wyloguj się z gracz.pl');
 logout.hidden=true;
 logout.style.setProperty('display','none','important');
 actions.appendChild(logout);
 var neutral=document.createElement('a');
 neutral.href=sessionOrigin+'/konto/panel/';
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
 function render(state){
  visible(login,state==='out');
  visible(register,state==='out');
  visible(logout,state==='in');
  visible(neutral,state==='unknown');
  header.setAttribute('data-session-header',state);
 }
 function remember(state){
  var data={state:state,at:Date.now()};
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
 if(['in','out','unknown'].includes(observed)){
  stateLink.searchParams.delete('gracz_header_state');
  history.replaceState(history.state,'',stateLink.pathname+stateLink.search+stateLink.hash);
  render(remember(observed).state);
 }else{
  var stored=cached();
  if(stored)render(stored.state);
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
   if(latest)render(latest.state);
  }
 });
 window.addEventListener('pageshow',function(event){
  if(event.persisted){
   var latest=cached();
   if(latest)render(latest.state);
  }
 });
})();
