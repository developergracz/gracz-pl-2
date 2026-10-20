(function(){
  'use strict';
  var API='https://gracz-contact-api.onrender.com';
  // F-02: gated by an explicit future Owner-approved release, never by stale /health.
  var NEWSLETTER_PUBLIC_INTAKE_ENABLED=false;
  var NEWSLETTER_MAINTENANCE_NOTICE='Newsletter jest chwilowo niedostępny. Nie wysłano nowego żądania. W celu wycofania zgody skorzystaj z kontaktu na tej stronie.';
  function byId(id){return document.getElementById(id);}
  var subscribePanel=byId('nl-subscribe-panel'), requestPanel=byId('nl-status-panel');
  var actionPanel=byId('nl-action-panel'), actionStatus=byId('nl-action-status');
  var actionButton=byId('nl-action-button'), actionTitle=byId('nl-action-title');
  var actionCopy=byId('nl-action-copy'), actionKicker=byId('nl-action-kicker');
  var actionMode='', actionToken='', generation=0, controllers=new Set();
  var ambiguous='Nie możemy potwierdzić wyniku operacji. Zgłoszenie mogło zostać przyjęte. Sprawdź skrzynkę i nie ponawiaj od razu.';
  function setStatus(node,text,error){node.textContent=text||'';node.classList.toggle('is-error',Boolean(error));}
  async function post(path,payload){
    var controller=new AbortController(); controllers.add(controller);
    var timer=window.setTimeout(function(){controller.abort();},30000);
    try{
      var response=await fetch(API+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),mode:'cors',credentials:'omit',signal:controller.signal});
      var body={};try{body=await response.json();}catch(_){}
      if(!response.ok||body.ok!==true){
        var unavailable=response.status===503;
        var error=new Error(unavailable?'Usługa jest chwilowo niedostępna. Nie potwierdzono zmiany subskrypcji. Nie ponawiaj teraz operacji. W celu wycofania zgody skorzystaj z kontaktu na tej stronie; zgłoszenie wymaga weryfikacji i obsługi.':path==='/newsletter/status-check'?'Nie można sprawdzić statusu za pomocą tego linku. Nie ponawiaj teraz operacji.':'Nie udało się potwierdzić operacji.');
        throw error;
      }
      return body;
    }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw new Error(ambiguous);throw error;}
    finally{window.clearTimeout(timer);controllers.delete(controller);}
  }
  function fieldError(control,message){
    var node=byId(control.getAttribute('aria-describedby'));
    if(node)node.textContent=message||'';
    if(message)control.setAttribute('aria-invalid','true');else control.removeAttribute('aria-invalid');
  }
  function setupForm(formId,buttonId,statusId,path,consent){
    var form=byId(formId),button=byId(buttonId),status=byId(statusId),openedAt=Date.now(),busy=false;
    var original=button.textContent;
    var controls=[form.elements.email];if(consent)controls.push(form.elements.consent);
    if(!NEWSLETTER_PUBLIC_INTAKE_ENABLED)form.querySelectorAll('input').forEach(function(control){control.disabled=true;});
    controls.forEach(function(control){control.addEventListener('input',function(){fieldError(control,'');setStatus(status,'');});control.addEventListener('change',function(){fieldError(control,'');});});
    form.addEventListener('submit',async function(event){
      event.preventDefault();if(!NEWSLETTER_PUBLIC_INTAKE_ENABLED){setStatus(status,NEWSLETTER_MAINTENANCE_NOTICE,true);return;}if(busy)return;
      setStatus(status,'');var first=null;
      controls.forEach(function(control){
        var message=control.type==='checkbox'?(!control.checked?'Zaznacz zgodę, aby zapisać się do newslettera.':''):(!control.value.trim()?'Podaj adres e-mail.':(!control.validity.valid||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(control.value.trim())?'Wpisz poprawny adres e-mail, np. jan@example.pl.':''));
        fieldError(control,message);if(message&&!first)first=control;
      });
      if(first){first.focus();return;}
      busy=true;button.disabled=true;button.textContent='Przetwarzanie…';var current=generation;
      var payload={email:form.elements.email.value.trim(),website:form.elements.website.value.trim(),startedAt:openedAt,source:'newsletter_page'};
      if(consent){payload.name=form.elements.name.value.trim();payload.consent=true;}
      try{
        await post(path,payload);if(current!==generation)return;
        setStatus(status,'Zgłoszenie przyjęte do obsługi. Sprawdź skrzynkę e-mail. Ta odpowiedź nie potwierdza statusu subskrypcji ani dostarczenia wiadomości.');
        form.reset();openedAt=Date.now();
      }catch(error){if(current===generation)setStatus(status,error.message,true);}
      finally{busy=false;button.disabled=false;button.textContent=original;}
    });
  }
  function clearNavigation(){
    generation++;actionMode='';actionToken='';controllers.forEach(function(controller){controller.abort();});
    document.querySelectorAll('.nl-status').forEach(function(node){setStatus(node,'');});
    // Intake pause does not disable actions on already issued consent links.
    actionButton.disabled=false;actionButton.hidden=false;
    if(!NEWSLETTER_PUBLIC_INTAKE_ENABLED){
      setStatus(byId('nl-status'),NEWSLETTER_MAINTENANCE_NOTICE,true);
      setStatus(byId('nl-request-status'),NEWSLETTER_MAINTENANCE_NOTICE,true);
    }
    actionPanel.hidden=true;subscribePanel.hidden=false;requestPanel.hidden=false;
  }
  function readAction(){
    var params=new URLSearchParams(window.location.hash.slice(1));
    var mode=['fresh-confirm','confirm','unsubscribe','status'].find(function(key){return params.has(key);});
    var token=mode?String(params.get(mode)||'').trim():'';
    // Strip bearer fragments before rendering or starting any request; never persist tokens.
    if(mode)window.history.replaceState(null,'',window.location.pathname+window.location.search);
    clearNavigation();
    if(!mode||!token)return;
    // Compromised formats are permanently revoked, independent of intake/readiness.
    if(/^(n1|ns1)(\.|$)/.test(token)){
      subscribePanel.hidden=true;requestPanel.hidden=true;actionPanel.hidden=false;
      actionButton.disabled=true;actionButton.hidden=true;
      actionKicker.textContent='NIEAKTUALNY LINK';actionTitle.textContent='Link został unieważniony';
      actionCopy.textContent='W celu wycofania zgody skorzystaj z kontaktu na tej stronie. Zgłoszenie wymaga weryfikacji i obsługi.';
      setStatus(actionStatus,'Ten link został unieważniony. Nie potwierdzono zmiany subskrypcji.',true);
      actionStatus.setAttribute('tabindex','-1');actionStatus.focus();
      token='';return;
    }
    actionMode=mode;actionToken=token;
    subscribePanel.hidden=true;requestPanel.hidden=true;actionPanel.hidden=false;
    var copy={
      'fresh-confirm':['NOWA ZGODA','Potwierdź nowy zapis do newslettera','Potwierdzenie dotyczy tylko nowej zgody. Historyczne subskrypcje pozostają oddzielnie zabezpieczone.','Potwierdź zapis'],
      confirm:['POTWIERDZENIE ZAPISU','Potwierdź zapis do newslettera','Kliknij przycisk poniżej, aby aktywować newsletter gracz.pl. Samo otwarcie linku nie zapisuje adresu.','Potwierdź zapis'],
      unsubscribe:['ZARZĄDZANIE SUBSKRYPCJĄ','Wypisz się z newslettera','Kliknij przycisk poniżej, aby wycofać zgodę na newsletter. Pozostałe funkcje gracz.pl nie zostaną zmienione.','Wypisz mnie'],
      status:['BEZPIECZNE SPRAWDZENIE','Sprawdź swoją subskrypcję','Kliknij przycisk, aby jednorazowo sprawdzić status. Ta operacja nie zapisuje do newslettera ani nie zmienia zgody.','Sprawdź status']
    }[mode];
    actionKicker.textContent=copy[0];actionTitle.textContent=copy[1];actionCopy.textContent=copy[2];actionButton.textContent=copy[3];
    if(!NEWSLETTER_PUBLIC_INTAKE_ENABLED){setStatus(actionStatus,'Operacje newslettera są chwilowo niedostępne. Historyczne linki zostały unieważnione. Nie potwierdzono zmiany subskrypcji.',false);}
  }
  // popstate may precede hashchange for the same traversal; coalesce that duplicate.
  var lastNavigationURL='';
  function navigation(event){
    if(event.type==='hashchange'&&lastNavigationURL===event.newURL){lastNavigationURL='';return;}
    if(event.type==='popstate')lastNavigationURL=window.location.href;else lastNavigationURL='';
    readAction();
  }
  readAction();
  window.addEventListener('hashchange',navigation);
  window.addEventListener('popstate',navigation);
  window.addEventListener('pagehide',clearNavigation);
  window.addEventListener('pageshow',function(event){if(event.persisted)readAction();});
  setupForm('nl-form','nl-submit','nl-status','/newsletter/fresh-request',true);
  setupForm('nl-status-form','nl-request-button','nl-request-status','/newsletter/status-request',false);
  if(!NEWSLETTER_PUBLIC_INTAKE_ENABLED){
    ['nl-submit','nl-request-button'].forEach(function(id){var button=byId(id);if(button){button.disabled=true;button.setAttribute('aria-disabled','true');}});
    setStatus(byId('nl-status'),NEWSLETTER_MAINTENANCE_NOTICE,true);
    setStatus(byId('nl-request-status'),NEWSLETTER_MAINTENANCE_NOTICE,true);
  }
  // F-03 release rule: never enable public intake from /health, cache or a browser-only flag.
  // An explicit backend opt-in + valid durable schema are required on EACH load.
  async function enableIntakeOnlyWhenReady(){
    if(NEWSLETTER_PUBLIC_INTAKE_ENABLED)return; // Existing synthetic E2E fixture.
    try{
      var controller=new AbortController();
      var timer=window.setTimeout(function(){controller.abort();},5000);
      var response;
      try{response=await fetch(API+'/newsletter/fresh-ready',{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});}
      finally{window.clearTimeout(timer);}
      if(response.status!==200)return;
      var state=await response.json();
      if(!state||state.ready!==true||state.intakePaused!==false||state.schemaReady!==true||state.configured!==true)return;
      NEWSLETTER_PUBLIC_INTAKE_ENABLED=true;
      ['nl-form'].forEach(function(id){
        var form=byId(id);
        if(form)form.querySelectorAll('input').forEach(function(input){input.disabled=false;});
      });
      ['nl-submit'].forEach(function(id){var button=byId(id);if(button){button.disabled=false;button.removeAttribute('aria-disabled');}});
      setStatus(byId('nl-status'),'');
      setStatus(byId('nl-request-status'),'Historyczne sprawdzanie statusu pozostaje wyłączone. Wypisanie działa w sekcji powyżej.',false);
      var notice=byId('nl-maintenance-notice');
      if(notice){notice.hidden=true;notice.style.display='none';}
    }catch(_){/* Fail closed. A failed probe never sends a subscription. */}
  }
  enableIntakeOnlyWhenReady();
  actionButton.addEventListener('click',async function(){
    if(!actionMode||!actionToken||actionButton.disabled)return;
    var mode=actionMode,token=actionToken,current=generation;
    actionToken='';actionButton.disabled=true;
    setStatus(actionStatus,'Przetwarzanie…');
    try{
      var freshParts=mode==='fresh-confirm' ? /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(token) : null;
      if(mode==='fresh-confirm'&&!freshParts)throw new Error('Link jest nieprawidłowy.');
      var result=mode==='fresh-confirm'
        ? await post('/newsletter/fresh-confirm',{id:freshParts[1],token:freshParts[2]})
        : await post('/newsletter/'+(mode==='status'?'status-check':mode),{token:token});
      if(current!==generation)return;
      // Never present success until the server confirms an exact, final state.
      // HTTP 200 and ok:true alone are not evidence of a completed operation.
      if(mode==='fresh-confirm'){
        if(result.state!=='subscribed'||result.confirmed!==true)throw new Error('Zgoda została zapisana, ale aktywacja w Resend wymaga obsługi. Nie ponawiaj linku.');
        actionTitle.textContent='Nowy zapis potwierdzony';actionCopy.textContent='Newsletter gracz.pl jest aktywny dla tej nowej zgody.';
      }else if(mode==='status'){
        var states={active:['Newsletter aktywny','Ten adres ma aktywną subskrypcję newslettera gracz.pl.'],pending:['Oczekuje na potwierdzenie','Zapis wymaga jeszcze potwierdzenia zgody przez e-mail.'],inactive:['Newsletter nieaktywny','Ten adres nie ma aktywnej subskrypcji newslettera gracz.pl.']};
        if(!states[result.state])throw new Error('Nie można teraz potwierdzić statusu.');
        actionTitle.textContent=states[result.state][0];actionCopy.textContent=states[result.state][1];
      }else if(mode==='confirm'){
        if(!['subscribed','resubscribed','already_subscribed'].includes(result.state))throw new Error('Nie można potwierdzić aktywacji newslettera.');
        actionTitle.textContent='Newsletter aktywny';actionCopy.textContent='Subskrypcja newslettera gracz.pl jest aktywna.';
      }else{
        if(result.state!=='unsubscribed')throw new Error('Nie można potwierdzić wycofania zgody.');
        actionTitle.textContent='Subskrypcja wyłączona';actionCopy.textContent='Zgoda na newsletter gracz.pl została wycofana.';
      }
      actionButton.hidden=true;
      setStatus(actionStatus,actionTitle.textContent+'. '+actionCopy.textContent);
      actionStatus.setAttribute('tabindex','-1');actionStatus.focus();
    }catch(error){if(current===generation){
      actionToken='';actionMode='';actionButton.disabled=true;actionButton.hidden=true;
      actionTitle.textContent='Nie potwierdzono operacji';
      actionCopy.textContent='Nie potwierdzono zmiany subskrypcji ani jej statusu. Nie ponawiaj teraz operacji. Zgłoszenie wycofania zgody wymaga weryfikacji i obsługi przez kontakt na tej stronie.';
      setStatus(actionStatus,error.message,true);
      actionStatus.setAttribute('tabindex','-1');actionStatus.focus();
    }}
  });
})();
