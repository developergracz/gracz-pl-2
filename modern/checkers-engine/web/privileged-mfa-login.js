(()=>{
  let busy=false;

  function elements(){
    return{
      form:document.querySelector('#auth-form'),
      loginTab:document.querySelector('[data-mode="login"]'),
      registerTab:document.querySelector('[data-mode="register"]'),
      errorBox:document.querySelector('#auth-error')
    };
  }

  function syncRegistrationMode(){
    const {form,loginTab,registerTab,errorBox}=elements();
    if(!form||!loginTab||!registerTab)return;
    const registering=registerTab.classList.contains('active');
    document.querySelectorAll('.register-only').forEach(node=>{node.hidden=!registering;});

    const name=form.elements.displayName;
    const email=form.elements.email;
    const confirm=form.elements.passwordConfirm;
    const terms=form.elements.terms;
    const password=form.elements.password;
    const submit=document.querySelector('#auth-submit');
    const subtitle=document.querySelector('#auth-subtitle');

    if(name)name.required=registering;
    if(email)email.required=registering;
    if(confirm)confirm.required=registering;
    if(terms)terms.required=registering;
    if(password){
      password.minLength=registering?15:1;
      password.autocomplete=registering?'new-password':'current-password';
    }
    if(submit)submit.textContent=registering?'Utwórz bezpieczne konto':'Zaloguj się';
    if(subtitle)subtitle.textContent=registering?'Utwórz bezpieczne konto gracza.':'Zaloguj się i wróć do gry.';
    if(errorBox)errorBox.textContent='';
  }

  function installRegistrationMode(){
    const {loginTab,registerTab}=elements();
    if(!loginTab||!registerTab)return;
    [loginTab,registerTab].forEach(tab=>tab.addEventListener('click',()=>queueMicrotask(syncRegistrationMode)));
    syncRegistrationMode();
  }

  function ensureMfaField(){
    let input=document.querySelector('#privileged-mfa-code');
    if(input)return input;
    const label=document.createElement('label');label.id='privileged-mfa-field';label.textContent='Kod MFA administratora / moderatora';
    input=document.createElement('input');input.id='privileged-mfa-code';input.name='mfaCode';input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.pattern='[0-9]{6}';input.placeholder='000000';input.required=true;
    const help=document.createElement('small');help.className='field-help';help.textContent='Konta moderatorów, administratorów i właściciela wymagają kodu TOTP.';
    label.append(input,help);document.querySelector('#auth-password')?.closest('label')?.after(label);return input;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installRegistrationMode,{once:true});
  else installRegistrationMode();

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
