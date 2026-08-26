(()=>{
  let busy=false;
  function elements(){return{form:document.querySelector('#auth-form'),loginTab:document.querySelector('[data-mode="login"]'),registerTab:document.querySelector('[data-mode="register"]'),errorBox:document.querySelector('#auth-error')};}

  function installRegistrationPolish(){
    if(document.querySelector('#registration-polish-style'))return;
    const style=document.createElement('style');
    style.id='registration-polish-style';
    style.textContent=`
      .auth-dialog.register-mode{width:min(760px,96vw);padding:30px 34px 26px}
      .auth-dialog.register-mode #auth-form{grid-template-columns:1fr 1fr;column-gap:16px;row-gap:12px}
      .auth-dialog.register-mode #auth-form>label:not(.check-row):not([style*="position:absolute"]){min-width:0}
      .auth-dialog.register-mode #auth-form>label:first-of-type,
      .auth-dialog.register-mode #confirm-field,
      .auth-dialog.register-mode #register-rules,
      .auth-dialog.register-mode .security-note,
      .auth-dialog.register-mode .check-row,
      .auth-dialog.register-mode #auth-submit,
      .auth-dialog.register-mode #forgot-password,
      .auth-dialog.register-mode #auth-error{grid-column:1/-1}
      .auth-dialog.register-mode #name-field,.auth-dialog.register-mode #email-field,.auth-dialog.register-mode #recovery-field{grid-column:auto}
      .auth-dialog.register-mode #auth-submit{min-height:48px;font-size:14px;letter-spacing:.02em;background:linear-gradient(180deg,#22e97b,#0eae53)}
      .auth-dialog.register-mode .register-rules{padding:13px 14px;background:#08131a;border-color:#29414e}
      .auth-dialog.register-mode .security-note{background:#0a1f18;border-color:#28533e}
      .auth-dialog.register-mode .check-row{padding:3px 2px}
      .auth-dialog.register-mode .auth-foot{margin-top:16px!important}
      .auth-dialog.register-mode #guest-thousand-demo,.auth-dialog.register-mode #guest-thousand-note{display:none!important}
      .auth-dialog.register-mode input{min-height:44px}
      .auth-dialog.register-mode #email-field input,.auth-dialog.register-mode #recovery-field input{padding-left:42px;position:relative}
      .auth-dialog.register-mode #email-field,.auth-dialog.register-mode #recovery-field{position:relative}
      .auth-dialog.register-mode #email-field:after,.auth-dialog.register-mode #recovery-field:after{content:'✉';position:absolute;left:14px;top:34px;color:#6f8592;font-size:14px;pointer-events:none}
      .auth-dialog.register-mode .tabs{margin-bottom:16px}
      .auth-dialog.register-mode #auth-subtitle{color:#a9bbc6}
      @media(max-width:720px){.auth-dialog.register-mode{width:min(520px,96vw);padding:24px 20px}.auth-dialog.register-mode #auth-form{grid-template-columns:1fr}.auth-dialog.register-mode #auth-form>*{grid-column:1!important}}
    `;
    document.head.append(style);

    const dialog=document.querySelector('.auth-dialog');
    const registerTab=document.querySelector('[data-mode="register"]');
    const loginTab=document.querySelector('[data-mode="login"]');
    const submit=document.querySelector('#auth-submit');
    const subtitle=document.querySelector('#auth-subtitle');
    const password=document.querySelector('#auth-password');
    const syncMode=()=>{
      const registering=registerTab?.classList.contains('active');
      dialog?.classList.toggle('register-mode',Boolean(registering));
      if(registering){
        if(submit)submit.textContent='UTWÓRZ KONTO';
        if(subtitle)subtitle.textContent='Utwórz bezpieczne konto gracza.';
        if(password)password.placeholder='Utwórz bezpieczne hasło';
      }else{
        if(submit)submit.textContent='Zaloguj się';
        if(subtitle)subtitle.textContent='Zaloguj się i wróć do gry.';
        if(password)password.placeholder='Twoje hasło';
      }
    };
    registerTab?.addEventListener('click',()=>requestAnimationFrame(syncMode));
    loginTab?.addEventListener('click',()=>requestAnimationFrame(syncMode));
    const observer=new MutationObserver(syncMode);
    if(registerTab)observer.observe(registerTab,{attributes:true,attributeFilter:['class']});
    if(loginTab)observer.observe(loginTab,{attributes:true,attributeFilter:['class']});
    syncMode();
  }

  function ensureMfaField(){
    let input=document.querySelector('#privileged-mfa-code');
    if(input)return input;
    const label=document.createElement('label');label.id='privileged-mfa-field';label.textContent='Kod MFA administratora / moderatora';
    input=document.createElement('input');input.id='privileged-mfa-code';input.name='mfaCode';input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.pattern='[0-9]{6}';input.placeholder='000000';input.required=true;
    const help=document.createElement('small');help.className='field-help';help.textContent='Konta moderatorów, administratorów i właściciela wymagają kodu TOTP.';
    label.append(input,help);document.querySelector('#auth-password')?.closest('label')?.after(label);return input;
  }

  document.addEventListener('DOMContentLoaded',installRegistrationPolish,{once:true});
  if(document.readyState!=='loading')installRegistrationPolish();

  document.addEventListener('submit',async event=>{
    const {form,loginTab,errorBox}=elements();
    if(!form||event.target!==form||!loginTab?.classList.contains('active')||busy)return;
    event.preventDefault();event.stopImmediatePropagation();
    const data=Object.fromEntries(new FormData(form));
    if(document.querySelector('#privileged-mfa-code'))data.mfaCode=String(data.mfaCode||'').trim();
    busy=true;const submit=document.querySelector('#auth-submit');if(submit)submit.disabled=true;
    try{
      const response=await fetch('/auth/login',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(data)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){
        if(result.error?.code==='MFA_REQUIRED'||result.error?.code==='MFA_INVALID'){const input=ensureMfaField();errorBox.textContent=result.error?.message||'Wpisz kod MFA.';input.focus();return;}
        errorBox.textContent=result.error?.message||'Nie udało się zalogować.';return;
      }
      sessionStorage.setItem('gracz-session',JSON.stringify(result));location.reload();
    }catch{errorBox.textContent='Nie udało się połączyć z serwerem. Spróbuj ponownie.';}
    finally{busy=false;if(submit)submit.disabled=false;}
  },true);
})();
