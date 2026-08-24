const form=document.querySelector('#newsletter-form');
const message=document.querySelector('#newsletter-message');

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
    callback(token){
      currentChallengeToken=token;
      resolveTokenWaiters(token);
    },
    'error-callback'(){
      currentChallengeToken=null;
      rejectTokenWaiters(new Error('Weryfikacja bezpieczeństwa nie powiodła się. Spróbuj ponownie.'));
    },
    'expired-callback'(){
      currentChallengeToken=null;
      if(turnstileWidgetId!==null&&window.turnstile)window.turnstile.reset(turnstileWidgetId);
    }
  });
  return true;
}

async function getChallengeToken(){
  if(isRenderTestHost())return null;
  const enabled=await ensureTurnstile();
  if(!enabled)return null;
  if(currentChallengeToken)return currentChallengeToken;

  return await new Promise((resolve,reject)=>{
    const waiter={
      resolve,
      reject,
      timeout:setTimeout(()=>{
        tokenWaiters=tokenWaiters.filter(item=>item!==waiter);
        reject(new Error('Nie udało się zakończyć weryfikacji bezpieczeństwa. Odśwież stronę i spróbuj ponownie.'));
      },10000)
    };
    tokenWaiters.push(waiter);
    if(turnstileWidgetId!==null&&window.turnstile){
      try{window.turnstile.reset(turnstileWidgetId);}catch{}
    }
  });
}

form?.addEventListener('submit',async(event)=>{
  event.preventDefault();
  message.className='message';
  message.textContent='';
  const data=new FormData(form);
  if(data.get('consent')!=='on'){
    message.classList.add('error');
    message.textContent='Zaznacz zgodę, aby zapisać się na listę.';
    return;
  }

  const button=form.querySelector('button');
  button.disabled=true;
  button.textContent='ZAPISUJĘ…';
  try{
    const challengeToken=await getChallengeToken();
    const response=await fetch('/newsletter/subscribe',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        email:String(data.get('email')||'').trim(),
        consent:true,
        challengeToken
      })
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error?.message||'Nie udało się zapisać.');
    message.classList.add('ok');
    message.textContent=result.message||'Dziękujemy! Jesteś na liście startowej Gracz.pl.';
    form.reset();
    currentChallengeToken=null;
    if(turnstileWidgetId!==null&&window.turnstile)window.turnstile.reset(turnstileWidgetId);
  }catch(error){
    message.classList.add('error');
    message.textContent=error.message||'Spróbuj ponownie za chwilę.';
  }finally{
    button.disabled=false;
    button.textContent='ZAPISZ MNIE NA START →';
  }
});

void ensureTurnstile().catch(()=>{});
