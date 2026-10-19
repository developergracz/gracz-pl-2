(function(){
  'use strict';
  var API='https://gracz-contact-api.onrender.com';
  var byId=function(id){return document.getElementById(id);};
  var form=byId('nl-withdrawal-form'),email=byId('nl-withdrawal-email');
  var submit=byId('nl-withdrawal-submit'),status=byId('nl-withdrawal-status');
  var panel=byId('nl-withdrawal-action'),confirmButton=byId('nl-withdrawal-confirm');
  var confirmation=byId('nl-withdrawal-action-status');
  if(!form||!email||!submit||!status||!panel||!confirmButton||!confirmation)return;
  var ready=false,busy=false,proof=null;
  function message(node,text,error){
    node.textContent=text;
    node.classList.toggle('is-error',Boolean(error));
  }
  function help(){
    return 'Bezpieczne wypisanie przez link jest chwilowo niedostępne. Możesz zgłosić wycofanie zgody przez adres kontaktowy powyżej; nie potwierdzono zmiany subskrypcji.';
  }
  async function fetchBounded(path,data,method){
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
    try {
      var response=await fetch(API+path,{
        method:method||'POST',mode:'cors',credentials:'omit',cache:'no-store',
        redirect:'error',
        ...(method==='GET'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),
        signal:controller.signal
      });
      var json={};try{json=await response.json();}catch(_){}
      if(!response.ok||(!method&&json.ok!==true))throw new Error('WITHDRAWAL_NOT_CONFIRMED');
      return json;
    }finally{clearTimeout(timer);}
  }
  // NEW single-use proof in a URL fragment, stripped from browser history
  // before any network request, navigation or visible action.
  function readProofFragment(){
    var hash=new URLSearchParams(window.location.hash.slice(1));
    var raw=hash.get('withdrawal');
    // Navigation to any other fragment also discards stale proof authority.
    proof=null;panel.hidden=true;
    if(raw===null)return;
    history.replaceState(null,'',location.pathname+location.search);
    var match=/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i.exec(raw);
    if(!match)return;
    proof={challengeId:match[1],token:match[2]};
    confirmButton.disabled=false;confirmButton.hidden=false;
    message(confirmation,'');
    if(ready){panel.hidden=false;panel.scrollIntoView({block:'nearest'});}
  }
  readProofFragment();
  window.addEventListener('hashchange',readProofFragment);
  window.addEventListener('pageshow',function(event){if(event.persisted)readProofFragment();});
  async function checkReady(){
    try{
      var answer=await fetchBounded('/newsletter/withdrawal-ready',null,'GET');
      if(answer.ready!==true||answer.withdrawalOnly!==true||
         answer.newsletterIntakeEnabled!==false)return;
      ready=true;email.disabled=false;form.elements.website.disabled=false;
      submit.disabled=false;submit.removeAttribute('aria-disabled');
      message(status,'Podaj adres i poproś o nowy link do wypisania.');
      if(proof){
        panel.hidden=false;
        panel.scrollIntoView({block:'nearest'});
      }
    }catch(_){message(status,help(),true);}
  }
  email.addEventListener('input',function(){
    email.removeAttribute('aria-invalid');
    message(byId('nl-withdrawal-email-error'),'');
  });
  form.addEventListener('submit',async function(event){
    event.preventDefault();
    if(!ready||busy)return;
    var value=email.value.trim();
    if(!email.validity.valid||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){
      email.setAttribute('aria-invalid','true');
      message(byId('nl-withdrawal-email-error'),'Podaj poprawny adres e-mail.',true);
      email.focus();return;
    }
    busy=true;submit.disabled=true;
    message(status,'Wysyłanie prośby…');
    try{
      var reply=await fetchBounded('/newsletter/withdrawal-request',{
        email:value,website:form.elements.website.value
      });
      if(reply.state!=='request_received')throw new Error('WITHDRAWAL_NOT_CONFIRMED');
      // Do not disclose whether an address already exists in the database.
      message(status,'Jeśli wiadomość została wysłana, sprawdź skrzynkę. Link ważny jest 15 minut. To nie potwierdza jeszcze wypisania.');
      form.reset();
    }catch(_){message(status,'Nie udało się potwierdzić przyjęcia prośby. '+help(),true);}
    finally{busy=false;submit.disabled=!ready;}
  });
  confirmButton.addEventListener('click',async function(){
    if(!ready||!proof||busy)return;
    busy=true;confirmButton.disabled=true;
    var ticket=proof;proof=null; // no automatic retry of an ambiguous effect
    message(confirmation,'Weryfikacja i blokowanie wysyłek…');
    try{
      var reply=await fetchBounded('/newsletter/withdrawal-confirm',ticket);
      if(reply.state==='provider_off_verified'&&reply.confirmed===false){
        message(confirmation,'Resend potwierdził blokadę wysyłek na ten adres. Historyczne zapisy pozostają oddzielnie zabezpieczone.');
      }else{
        message(confirmation,'Prośba została przyjęta do bezpiecznej obsługi. Nie potwierdzono jeszcze wyłączenia w Resend. Nie ponawiaj operacji.',true);
      }
    }catch(_){
      message(confirmation,'Nie potwierdzono wyniku. Zgłoszenie mogło zostać zapisane; nie ponawiaj linku. Skorzystaj z kontaktu, jeśli potrzebujesz pomocy.',true);
    }finally{busy=false;confirmButton.hidden=true;confirmButton.disabled=true;}
  });
  checkReady();
})();
