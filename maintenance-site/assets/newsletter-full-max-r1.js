(function(){
  'use strict';
  var API='https://gracz-contact-api.onrender.com';
  var form=document.getElementById('nl-form');
  var subscribePanel=document.getElementById('nl-subscribe-panel');
  var actionPanel=document.getElementById('nl-action-panel');
  var status=document.getElementById('nl-status');
  var submit=document.getElementById('nl-submit');
  var actionStatus=document.getElementById('nl-action-status');
  var actionButton=document.getElementById('nl-action-button');
  var actionTitle=document.getElementById('nl-action-title');
  var actionCopy=document.getElementById('nl-action-copy');
  var actionKicker=document.getElementById('nl-action-kicker');
  var openedAt=Date.now();
  var actionMode='';
  var actionToken='';

  function setStatus(node,text,error){
    node.textContent=text||'';
    node.classList.toggle('is-error',Boolean(error));
  }

  async function post(path,payload){
    var controller=new AbortController();
    var timer=window.setTimeout(function(){controller.abort();},12000);
    try{
      var response=await fetch(API+path,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(payload),
        mode:'cors',
        credentials:'omit',
        signal:controller.signal
      });
      var body={};
      try{body=await response.json();}catch(_){}
      if(!response.ok||body.ok!==true){
        var message=body&&body.error&&body.error.message?String(body.error.message):'Operacja nie powiodła się.';
        var error=new Error(message);
        error.status=response.status;
        throw error;
      }
      return body;
    }finally{
      window.clearTimeout(timer);
    }
  }

  function configureAction(mode,token){
    actionMode=mode;
    actionToken=token;
    subscribePanel.hidden=true;
    actionPanel.hidden=false;
    if(mode==='confirm'){
      actionKicker.textContent='POTWIERDZENIE ZAPISU';
      actionTitle.textContent='Potwierdź zapis do newslettera';
      actionCopy.textContent='Kliknij przycisk poniżej, aby aktywować newsletter gracz.pl. Samo otwarcie linku nie zapisuje adresu.';
      actionButton.textContent='Potwierdź zapis';
    }else{
      actionKicker.textContent='ZARZĄDZANIE SUBSKRYPCJĄ';
      actionTitle.textContent='Wypisz się z newslettera';
      actionCopy.textContent='Kliknij przycisk poniżej, aby wycofać zgodę na newsletter. Pozostałe funkcje gracz.pl nie zostaną zmienione.';
      actionButton.textContent='Wypisz mnie';
    }
  }

  var hash=window.location.hash.slice(1);
  var params=new URLSearchParams(hash);
  var confirmToken=params.get('confirm')||'';
  var unsubscribeToken=params.get('unsubscribe')||'';
  if(confirmToken||unsubscribeToken){
    if(window.history&&window.history.replaceState){
      window.history.replaceState(null,'',window.location.pathname+window.location.search);
    }
    configureAction(confirmToken?'confirm':'unsubscribe',confirmToken||unsubscribeToken);
  }

  form.addEventListener('submit',async function(event){
    event.preventDefault();
    setStatus(status,'',false);
    if(!form.reportValidity())return;
    submit.disabled=true;
    submit.textContent='Wysyłanie…';
    try{
      await post('/newsletter/subscribe',{
        name:String(form.elements.name.value||'').trim(),
        email:String(form.elements.email.value||'').trim(),
        consent:Boolean(form.elements.consent.checked),
        website:String(form.elements.website.value||'').trim(),
        startedAt:openedAt
      });
      setStatus(status,'Sprawdź skrzynkę e-mail. Wysłaliśmy bezpieczny link potwierdzający zapis.',false);
      form.reset();
      openedAt=Date.now();
    }catch(error){
      setStatus(status,error&&error.name==='AbortError'?'Przekroczono czas odpowiedzi. Spróbuj ponownie.':error.message,true);
    }finally{
      submit.disabled=false;
      submit.textContent='Wyślij link potwierdzający';
    }
  });

  actionButton.addEventListener('click',async function(){
    if(!actionMode||!actionToken)return;
    actionButton.disabled=true;
    setStatus(actionStatus,actionMode==='confirm'?'Aktywuję newsletter…':'Wycofuję zgodę…',false);
    try{
      var result=await post(actionMode==='confirm'?'/newsletter/confirm':'/newsletter/unsubscribe',{token:actionToken});
      actionToken='';
      actionButton.hidden=true;
      if(actionMode==='confirm'){
        actionTitle.textContent='Newsletter aktywny';
        if(result.state==='already_subscribed'){
          actionCopy.textContent='Ten adres ma już aktywną subskrypcję Newslettera gracz.pl.';
          setStatus(actionStatus,'Gotowe — subskrypcja była już aktywna.',false);
        }else if(result.state==='resubscribed'){
          actionCopy.textContent='Subskrypcja została ponownie aktywowana. Na Twój adres wysłaliśmy wiadomość powitalną FULL MAX PREMIUM.';
          setStatus(actionStatus,'Gotowe — subskrypcja została ponownie aktywowana.',false);
        }else{
          actionCopy.textContent='Zapis został potwierdzony. Na Twój adres wysłaliśmy wiadomość powitalną FULL MAX PREMIUM.';
          setStatus(actionStatus,'Gotowe — subskrypcja jest aktywna.',false);
        }
      }else{
        actionTitle.textContent='Subskrypcja wyłączona';
        actionCopy.textContent='Adres został wypisany z newslettera gracz.pl.';
        setStatus(actionStatus,'Gotowe — zgoda została wycofana.',false);
      }
    }catch(error){
      setStatus(actionStatus,error&&error.name==='AbortError'?'Przekroczono czas odpowiedzi. Spróbuj ponownie.':error.message,true);
      actionButton.disabled=false;
    }
  });
})();