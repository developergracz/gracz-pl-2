const form=document.querySelector('#newsletter-form');
const message=document.querySelector('#newsletter-message');
const nickInput=document.querySelector('#preferred-nick');
const nickCheckButton=document.querySelector('#check-nick');
const nickMessage=document.querySelector('#nick-message');
const successModal=document.querySelector('#signup-success-modal');
const successModalText=document.querySelector('#success-modal-text');

let turnstileConfig=null;
let turnstileWidgetId=null;
let turnstileReadyPromise=null;
let currentChallengeToken=null;
let tokenWaiters=[];

function isRenderTestHost(){
  return location.hostname==='onrender.com'||location.hostname.endsWith('.onrender.com');
}

async function loadTurnstileConfig(){
  if(isRenderTestHost())return {enabled:false,provider:null,siteKey:null};
  try{
    const response=await fetch('/newsletter/challenge-config',{headers:{accept:'application/json'},cache:'no-store'});
    if(!response.ok)return {enabled:false};
    return await response.json();
  }catch{
    return {enabled:false};
  }
}

function loadTurnstileScript(){
  if(window.turnstile)return Promise.resolve();
  if(turnstileReadyPromise)return turnstileReadyPromise;
  turnstileReadyPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-gracz-turnstile]');
    if(existing){
      if(window.turnstile){resolve();return;}
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.defer=true;
    script.dataset.graczTurnstile='1';
    script.addEventListener('load',resolve,{once:true});
    script.addEventListener('error',()=>reject(new Error('Nie udało się uruchomić zabezpieczenia formularza.')),{once:true});
    document.head.appendChild(script);
  });
  return turnstileReadyPromise;
}

function resolveTokenWaiters(token){
  const waiters=tokenWaiters.splice(0);
  for(const waiter of waiters){clearTimeout(waiter.timeout);waiter.resolve(token);}
}

function rejectTokenWaiters(error){
  const waiters=tokenWaiters.splice(0);
  for(const waiter of waiters){clearTimeout(waiter.timeout);waiter.reject(error);}
}

async function ensureTurnstile(){
  if(isRenderTestHost())return false;
  if(!turnstileConfig)turnstileConfig=await loadTurnstileConfig();
  if(!turnstileConfig?.enabled)return false;
  await loadTurnstileScript();
  if(turnstileWidgetId!==null)return true;

  const host=document.createElement('div');
  host.id='newsletter-turnstile';
  host.setAttribute('aria-hidden','true');
  host.style.position='absolute';
  host.style.width='1px';
  host.style.height='1px';
  host.style.overflow='hidden';
  host.style.opacity='0';
  host.style.pointerEvents='none';
  form.appendChild(host);

  turnstileWidgetId=window.turnstile.render(host,{
    sitekey:turnstileConfig.siteKey,
    appearance:'interaction-only',
    execution:'render',
    'response-field':false,
    callback(token){currentChallengeToken=token;resolveTokenWaiters(token);},
    'error-callback'(){currentChallengeToken=null;rejectTokenWaiters(new Error('Weryfikacja bezpieczeństwa nie powiodła się. Spróbuj ponownie.'));},
    'expired-callback'(){currentChallengeToken=null;if(turnstileWidgetId!==null&&window.turnstile)window.turnstile.reset(turnstileWidgetId);}
  });
  return true;
}

async function getChallengeToken(){
  if(isRenderTestHost())return null;
  const enabled=await ensureTurnstile();
  if(!enabled)return null;
  if(currentChallengeToken)return currentChallengeToken;
  return await new Promise((resolve,reject)=>{
    const waiter={resolve,reject,timeout:setTimeout(()=>{tokenWaiters=tokenWaiters.filter(item=>item!==waiter);reject(new Error('Nie udało się zakończyć weryfikacji bezpieczeństwa. Odśwież stronę i spróbuj ponownie.'));},10000)};
    tokenWaiters.push(waiter);
    if(turnstileWidgetId!==null&&window.turnstile){try{window.turnstile.reset(turnstileWidgetId);}catch{}}
  });
}

function openSuccessModal(text){
  if(!successModal)return;
  if(successModalText)successModalText.textContent=text||'Twój adres został zapisany na liście startowej Gracz.pl.';
  successModal.hidden=false;
  document.body.classList.add('success-modal-open');
  requestAnimationFrame(()=>document.querySelector('#success-modal-ok')?.focus());
}
function closeSuccessModal(){
  if(!successModal)return;
  successModal.hidden=true;
  document.body.classList.remove('success-modal-open');
}
document.querySelectorAll('[data-close-success]').forEach(el=>el.addEventListener('click',closeSuccessModal));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&successModal&&!successModal.hidden)closeSuccessModal();});

nickCheckButton?.addEventListener('click',async()=>{
  const nick=String(nickInput?.value||'').trim();
  nickMessage.className='nick-message';
  if(!nick){nickMessage.classList.add('error');nickMessage.textContent='Najpierw wpisz nick, który chcesz sprawdzić.';nickInput?.focus();return;}
  nickCheckButton.disabled=true;
  const originalText=nickCheckButton.textContent;
  nickCheckButton.textContent='SPRAWDZAM…';
  try{
    const response=await fetch(`/newsletter/nick-availability?nick=${encodeURIComponent(nick)}`,{headers:{accept:'application/json'},cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error?.message||'Nie udało się sprawdzić nicku.');
    if(result.available){nickMessage.classList.add('ok');nickMessage.textContent=`✓ Nick „${result.nick}” jest wolny.`;}
    else{nickMessage.classList.add('error');nickMessage.textContent=`✕ Nick „${result.nick}” jest już zajęty.`;}
  }catch(error){nickMessage.classList.add('error');nickMessage.textContent=error.message||'Nie udało się sprawdzić nicku.';}
  finally{nickCheckButton.disabled=false;nickCheckButton.textContent=originalText;}
});

nickInput?.addEventListener('input',()=>{nickMessage.className='nick-message';nickMessage.textContent='';});

form?.addEventListener('submit',async(event)=>{
  event.preventDefault();
  message.className='message';message.textContent='';
  const data=new FormData(form);
  if(data.get('legal')!=='on'){message.classList.add('error');message.textContent='Zaakceptuj Regulamin i Politykę prywatności.';return;}
  if(data.get('consent')!=='on'){message.classList.add('error');message.textContent='Zaznacz zgodę, aby zapisać się na listę.';return;}
  const button=form.querySelector('.submit-action');
  button.disabled=true;button.textContent='ZAPISUJĘ…';
  try{
    const challengeToken=await getChallengeToken();
    const response=await fetch('/newsletter/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:String(data.get('email')||'').trim(),preferredNick:String(data.get('preferredNick')||'').trim(),legal:true,consent:true,challengeToken})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error?.message||'Nie udało się zapisać.');
    const successText=result.message||'Dziękujemy! Jesteś na liście startowej Gracz.pl.';
    message.classList.add('ok');message.textContent=successText;
    openSuccessModal(successText);
    form.reset();nickMessage.textContent='';currentChallengeToken=null;
    if(turnstileWidgetId!==null&&window.turnstile)window.turnstile.reset(turnstileWidgetId);
  }catch(error){message.classList.add('error');message.textContent=error.message||'Spróbuj ponownie za chwilę.';}
  finally{button.disabled=false;button.textContent='ZAPISZ MNIE NA START →';}
});

void ensureTurnstile().catch(()=>{});
