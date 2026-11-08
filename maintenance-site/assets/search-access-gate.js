/* Search access UI: top-level auth-origin session check, one-time pass, no cookie sharing. */
(function(){
 'use strict';
 var layer=document.getElementById('search-access-layer');
 var page=document.getElementById('search-page-app');
 if(!layer||!page)return;
 var service='https://gracz-contact-api.onrender.com';
 var note=layer.querySelector('.search-access-note');
 var first=layer.querySelector('.search-access-primary');
 var gate=new URLSearchParams(location.hash.slice(1)).get('gate')||'';
 var onCanonical=location.hostname==='gracz.pl'||location.hostname==='www.gracz.pl';
 var active=true;
 // The search gate owns session verification on /szukaj/. Let the global header
 // display its decision instead of starting a competing top-level auth redirect.
 function publishAccess(state){
  document.body.dataset.searchAccessState=state;
  window.dispatchEvent(new CustomEvent('gracz:search-access-state',{detail:{state:state}}));
 }
 function focusFirst(){
  if(!active)return;
  window.requestAnimationFrame(function(){try{first.focus({preventScroll:true});}catch(_){}});
 }
 function showGate(message){
  if(!active)return;
  if(note&&message){note.textContent=message;note.hidden=false;}
  focusFirst();
 }
 function reveal(){
  active=false;
  publishAccess('in');
  layer.remove();
  page.removeAttribute('inert');
  document.body.classList.remove('search-access-pending');
  history.replaceState(null,'',location.pathname+location.search);
  window.requestAnimationFrame(function(){
   var input=page.querySelector('input[data-search-input]');
   if(input)input.focus({preventScroll:true});
  });
 }
 // The production login cookie is host-only and SameSite=Lax, so a cross-site
 // fetch cannot prove login. Navigate top-level to the auth service instead.
 if(gate==='guest'){
  publishAccess('out');
  showGate();
 }else if(gate==='unavailable'){
  publishAccess('out');
  showGate('Nie udało się sprawdzić sesji. Wróć do serwisu i spróbuj ponownie.');
 }else if(/^[a-f0-9]{48}$/.test(gate)){
  fetch(service+'/auth/search-ticket',{
   method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({ticket:gate})
  }).then(function(res){if(!res.ok)throw Error('UNAVAILABLE');return res.json();})
    .then(function(json){
     if(json&&json.allowed===true){reveal();return;}
     history.replaceState(null,'',location.pathname+location.search+'#gate=guest');
     publishAccess('out');
     showGate('Potwierdzenie logowania wygasło. Otwórz wyszukiwarkę ponownie.');
    }).catch(function(){
     history.replaceState(null,'',location.pathname+location.search+'#gate=unavailable');
     publishAccess('out');
     showGate('Nie udało się sprawdzić sesji. Spróbuj ponownie.');
    });
 }else if(onCanonical){
  // The auth service redirects with #gate=guest or a single-use 90s ticket.
  window.location.replace(service+'/auth/search-entry'+location.search);
 }else{
  // Local/static previews display the guest view without navigating to LIVE.
  publishAccess('out');
  showGate();
 }
 document.addEventListener('keydown',function(event){
  if(!active)return;
  if(event.key==='Escape'){
   event.preventDefault();event.stopImmediatePropagation();
   window.location.assign('/');
   return;
  }
  if(event.key!=='Tab')return;
  var links=Array.prototype.slice.call(layer.querySelectorAll('a[href]')).filter(function(el){return el.offsetParent!==null;});
  if(!links.length)return;
  var firstEl=links[0],lastEl=links[links.length-1];
  if(event.shiftKey&&document.activeElement===firstEl){
   event.preventDefault();lastEl.focus();
  }else if(!event.shiftKey&&document.activeElement===lastEl){
   event.preventDefault();firstEl.focus();
  }
 },true);
 document.addEventListener('focusin',function(event){
  if(active&&!layer.contains(event.target))focusFirst();
 });
 window.addEventListener('pageshow',function(event){
  if(event.persisted)window.location.reload();
 });
})();
