const form = document.querySelector('#newsletter-form');
const message = document.querySelector('#newsletter-message');
const nickInput = document.querySelector('#preferred-nick');
const nickButton = document.querySelector('#check-nick');
const nickMessage = document.querySelector('#nick-availability');
const welcomeModal = document.querySelector('#welcome-modal');
const welcomeNick = document.querySelector('#welcome-nick');
const welcomeMailTitle = document.querySelector('#welcome-mail-title');
const welcomeMailText = document.querySelector('#welcome-mail-text');
const turnstileWrap = document.querySelector('#turnstile-wrap');
const turnstileSiteKey = String(document.querySelector('meta[name="turnstile-site-key"]')?.content || '').trim();
const NICK_MIN = 3;
const NICK_MAX = 16;
let nickCheckTimer = null;
let nickCheckSequence = 0;
let lastNickAvailable = null;
let turnstileToken = '';
let turnstileWidgetId = null;

function initTurnstile() {
  if (!turnstileSiteKey || turnstileSiteKey === '__TURNSTILE_SITE_KEY__') return;
  turnstileWrap.hidden = false;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    if (!window.turnstile) return;
    turnstileWidgetId = window.turnstile.render('#turnstile-widget', {
      sitekey: turnstileSiteKey,
      theme: 'dark',
      callback: (token) => { turnstileToken = String(token || ''); },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => { turnstileToken = ''; },
    });
  };
  document.head.appendChild(script);
}
initTurnstile();

function resetTurnstile() {
  turnstileToken = '';
  if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
}

function showWelcomeModal({ nick, email, mailSent }) {
  const displayNick = nick || 'Graczu';
  welcomeNick.textContent = displayNick;
  if (mailSent) {
    welcomeMailTitle.textContent = `Wysłaliśmy do Ciebie, ${displayNick}, wiadomość.`;
    welcomeMailText.textContent = `Wiadomość została wysłana na adres ${email}. Sprawdź swoją skrzynkę pocztową, a także folder Spam lub Oferty, jeśli nie zobaczysz jej od razu.`;
  } else {
    welcomeMailTitle.textContent = `Twój zapis został przyjęty, ${displayNick}.`;
    welcomeMailText.textContent = `Adres ${email} został zapisany poprawnie. Wiadomość powitalna nie została jeszcze wysłana — wyślemy ją, gdy tylko usługa pocztowa będzie gotowa.`;
  }
  welcomeModal.hidden = false;
  document.body.classList.add('modal-open');
  welcomeModal.querySelector('.welcome-ok')?.focus();
}
function closeWelcomeModal(){welcomeModal.hidden=true;document.body.classList.remove('modal-open');}
document.querySelectorAll('[data-close-welcome]').forEach((element)=>element.addEventListener('click',closeWelcomeModal));
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!welcomeModal?.hidden)closeWelcomeModal();});

function validNickFormat(nick){return new RegExp(`^[\\p{L}\\p{N}_.-]{${NICK_MIN},${NICK_MAX}}$`,'u').test(nick);}

async function checkNick({ automatic = false } = {}) {
  const nick=String(nickInput?.value||'').trim();
  const sequence=++nickCheckSequence;
  lastNickAvailable=null;
  nickMessage.className='message'; nickMessage.textContent='';
  if(!nick){if(!automatic){nickMessage.classList.add('error');nickMessage.textContent='Najpierw wpisz nick, który chcesz sprawdzić.';}return false;}
  if(!validNickFormat(nick)){
    nickMessage.classList.add('error');
    nickMessage.textContent=nick.length>NICK_MAX?`Nick jest za długi. Maksymalna długość to ${NICK_MAX} znaków.`:`Nick musi mieć ${NICK_MIN}–${NICK_MAX} znaków: litery, cyfry, kropkę, _ lub -.`;
    return false;
  }
  if(!automatic){nickButton.disabled=true;nickButton.textContent='SPRAWDZAM…';}
  else {nickMessage.textContent='Sprawdzam dostępność nicku…';}
  try{
    const response=await fetch(`/newsletter/nick-availability?nick=${encodeURIComponent(nick)}`,{cache:'no-store',headers:{accept:'application/json'}});
    const result=await response.json();
    if(sequence!==nickCheckSequence)return false;
    if(!response.ok)throw new Error(result.error?.message||'Nie udało się sprawdzić nicku.');
    lastNickAvailable=Boolean(result.available);
    nickMessage.className='message'; nickMessage.classList.add(result.available?'ok':'error');
    nickMessage.textContent=result.available?`Nick „${result.nick}” jest wolny. Możesz go zarezerwować.`:`Nick „${result.nick}” jest już zajęty. Wybierz inny.`;
    return result.available;
  }catch(error){if(sequence===nickCheckSequence){nickMessage.className='message error';nickMessage.textContent=error.message||'Spróbuj ponownie za chwilę.';}return false;}
  finally{if(!automatic){nickButton.disabled=false;nickButton.textContent='SPRAWDŹ, CZY TWÓJ ULUBIONY NICK JEST WOLNY';}}
}

nickButton?.addEventListener('click',()=>checkNick());
nickInput?.addEventListener('input',()=>{
  clearTimeout(nickCheckTimer); ++nickCheckSequence; lastNickAvailable=null;
  const nick=String(nickInput.value||'').trim(); nickMessage.className='message'; nickMessage.textContent='';
  if(!nick)return;
  if(nick.length>NICK_MAX){nickMessage.classList.add('error');nickMessage.textContent=`Nick jest za długi. Maksymalna długość to ${NICK_MAX} znaków.`;return;}
  if(nick.length<NICK_MIN)return;
  if(!validNickFormat(nick)){nickMessage.classList.add('error');nickMessage.textContent=`Nick może zawierać tylko litery, cyfry, kropkę, _ lub -.`;return;}
  nickCheckTimer=setTimeout(()=>checkNick({automatic:true}),500);
});
nickInput?.addEventListener('blur',()=>{const nick=String(nickInput.value||'').trim();if(validNickFormat(nick)&&lastNickAvailable===null)checkNick({automatic:true});});

form?.addEventListener('submit',async(event)=>{
  event.preventDefault(); message.className='message'; message.textContent='';
  const data=new FormData(form);
  if(data.get('terms')!=='on'){message.classList.add('error');message.textContent='Zaakceptuj regulamin i zapoznaj się z polityką prywatności.';return;}
  if(data.get('consent')!=='on'){message.classList.add('error');message.textContent='Zaznacz zgodę, aby zapisać się na listę.';return;}
  const email=String(data.get('email')||'').trim(); const preferredNick=String(data.get('preferredNick')||'').trim();
  if(!email){message.classList.add('error');message.textContent='Podaj adres e-mail.';return;}
  if(turnstileSiteKey && turnstileSiteKey !== '__TURNSTILE_SITE_KEY__' && !turnstileToken){message.classList.add('error');message.textContent='Potwierdź weryfikację antybotową przed zapisem.';return;}
  if(preferredNick&&!validNickFormat(preferredNick)){message.classList.add('error');message.textContent=`Nick musi mieć ${NICK_MIN}–${NICK_MAX} znaków i może zawierać litery, cyfry, kropkę, _ lub -.`;return;}
  if(preferredNick){const available=await checkNick({automatic:true});if(!available){message.classList.add('error');message.textContent=`Nie można zapisać nicku „${preferredNick}”. Jest zajęty albo niedozwolony. Wybierz inny.`;return;}}
  const button=form.querySelector('button[type="submit"]'); button.disabled=true; button.textContent='ZAPISUJĘ…';
  try{
    const response=await fetch('/newsletter/subscribe',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({email,preferredNick,consent:true,acceptedTerms:true,termsVersion:'newsletter-v1',privacyVersion:'privacy-v1',turnstileToken})});
    const result=await response.json(); if(!response.ok)throw new Error(result.error?.message||'Nie udało się zapisać.');
    message.classList.add('ok'); const place=result.position&&result.total?` Jesteś nr ${result.position} z ${result.total} aktywnie zapisanych osób.`:'';
    message.textContent=(result.message||'Dziękujemy! Jesteś na liście startowej Gracz.pl.')+place;
    showWelcomeModal({nick:preferredNick,email,mailSent:Boolean(result.welcomeEmailSent)}); form.reset(); lastNickAvailable=null; nickMessage.className='message'; nickMessage.textContent=''; resetTurnstile();
  }catch(error){message.classList.add('error');message.textContent=error.message||'Spróbuj ponownie za chwilę.'; resetTurnstile();}
  finally{button.disabled=false;button.textContent='ZAPISZ MNIE NA START →';}
});
