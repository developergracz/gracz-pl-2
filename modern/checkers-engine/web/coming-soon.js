const form=document.querySelector('#newsletter-form');
const message=document.querySelector('#newsletter-message');

let turnstileConfig=null;
let turnstileWidgetId=null;
let turnstileReadyPromise=null;
let pendingChallenge=null;

async function loadTurnstileConfig(){
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

async function ensureTurnstile(){
  if(!turnstileConfig)turnstileConfig=await loadTurnstileConfig();
  if(!turnstileConfig?.enabled)return false;
  await loadTurnstileScript();
  if(turnstileWidgetId!==null)return true;
  const host=document.createElement('div');
  host.id='newsletter-turnstile';
  host.setAttribute('aria-hidden','true');
  form.appendChild(host);
  turnstileWidgetId=window.turnstile.render(host,{
    sitekey:turnstileConfig.siteKey,
    appearance:'interaction-only',
    execution:'execute',
    'response-field':false,
    callback(token){
      if(pendingChallenge){
        pendingChallenge.resolve(token);
        pendingChallenge=null;
      }
    },
    'error-callback'(){
      if(pendingChallenge){
        pendingChallenge.reject(new Error('Weryfikacja bezpieczeństwa nie powiodła się. Spróbuj ponownie.'));
        pendingChallenge=null;
      }
    },
    'expired-callback'(){
      if(turnstileWidgetId!==null)window.turnstile.reset(turnstileWidgetId);
    }
  });
  return true;
}

async function getChallengeToken(){
  const enabled=await ensureTurnstile();
  if(!enabled)return null;
  if(pendingChallenge)throw new Error('Weryfikacja bezpieczeństwa już trwa.');
  return await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{
      if(pendingChallenge){
        pendingChallenge=null;
        reject(new Error('Weryfikacja bezpieczeństwa trwała zbyt długo. Spróbuj ponownie.'));
      }
    },15000);
    pendingChallenge={
      resolve(token){clearTimeout(timeout);resolve(token);},
      reject(error){clearTimeout(timeout);reject(error);}
    };
    window.turnstile.execute(turnstileWidgetId);
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
  }catch(error){
    message.classList.add('error');
    message.textContent=error.message||'Spróbuj ponownie za chwilę.';
  }finally{
    if(turnstileWidgetId!==null&&window.turnstile)window.turnstile.reset(turnstileWidgetId);
    button.disabled=false;
  }
});

void ensureTurnstile().catch(()=>{});
