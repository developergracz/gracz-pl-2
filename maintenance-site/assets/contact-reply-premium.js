(function(){
  'use strict';

  var API='https://gracz-contact-api.onrender.com';
  var hash=window.location.hash.slice(1);
  var params=new URLSearchParams(hash);
  var token=params.get('token')||'';
  if(window.history&&window.history.replaceState){
    window.history.replaceState(null,'',window.location.pathname+window.location.search);
  }

  var loading=document.getElementById('reply-loading');
  var errorBox=document.getElementById('reply-error');
  var panel=document.getElementById('reply-panel');
  var success=document.getElementById('reply-success');
  var form=document.getElementById('reply-form');
  var message=document.getElementById('reply-message');
  var count=document.getElementById('reply-count');
  var status=document.getElementById('reply-status');
  var submit=document.getElementById('reply-submit');

  function setError(text){
    loading.hidden=true;
    panel.hidden=true;
    errorBox.hidden=false;
    errorBox.textContent=text;
  }

  function setStatus(text,isError){
    status.textContent=text||'';
    status.classList.toggle('is-error',Boolean(isError));
  }

  async function post(path,payload,timeoutMs){
    var controller=new AbortController();
    var timeout=Number(timeoutMs)||20000;
    var timer=window.setTimeout(function(){controller.abort();},timeout);
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
        var text=body&&body.error&&body.error.message?String(body.error.message):'Operacja nie powiodła się.';
        var err=new Error(text);
        err.status=response.status;
        throw err;
      }
      return body;
    }finally{
      window.clearTimeout(timer);
    }
  }

  function fillContext(ctx){
    document.getElementById('reply-recipient').textContent=ctx.recipient||'—';
    document.getElementById('reply-category').textContent=ctx.category||'—';
    document.getElementById('reply-subject').textContent=ctx.subject||'—';
    document.getElementById('reply-id').textContent=ctx.requestId||'—';
    document.getElementById('reply-excerpt').textContent=ctx.excerpt||'Brak podglądu.';
  }

  message.addEventListener('input',function(){
    count.textContent=String(message.value.length)+' / 5000';
  });

  form.addEventListener('submit',async function(event){
    event.preventDefault();
    if(submit.disabled)return;
    var body=message.value.trim();
    if(body.length<2){
      setStatus('Wpisz treść odpowiedzi.',true);
      message.focus();
      return;
    }
    submit.disabled=true;
    submit.textContent='Wysyłanie…';
    setStatus('Wysyłam markową wiadomość przez gracz.pl…',false);
    try{
      await post('/reply',{token:token,message:body});
      panel.hidden=true;
      success.hidden=false;
      token='';
    }catch(err){
      setStatus(err&&err.name==='AbortError'?'Przekroczono czas wysyłki. Spróbuj ponownie.':err.message,true);
      submit.disabled=false;
      submit.textContent='Wyślij odpowiedź premium';
    }
  });

  if(!token){
    setError('Brakuje bezpiecznego tokenu odpowiedzi. Otwórz link bezpośrednio z wiadomości otrzymanej z formularza.');
    return;
  }

  async function loadReplyContext(){
    loading.textContent='Łączę z bezpiecznym kanałem gracz.pl…';
    try{
      return await post('/reply-context',{token:token},20000);
    }catch(err){
      var retryable=err&&(
        err.name==='AbortError' ||
        typeof err.status==='undefined'
      );
      if(!retryable)throw err;
      loading.textContent='Serwer uruchamia bezpieczne połączenie. To może potrwać kilka sekund…';
      return post('/reply-context',{token:token},30000);
    }
  }

  loadReplyContext()
    .then(function(body){
      fillContext(body.context||{});
      loading.hidden=true;
      panel.hidden=false;
      window.setTimeout(function(){message.focus();},0);
    })
    .catch(function(err){
      setError(
        err&&err.name==='AbortError'
          ? 'Połączenie z bezpiecznym kanałem trwało zbyt długo. Odśwież stronę i spróbuj ponownie.'
          : err.message
      );
    });
})();