"use strict";

// Podgląd hasła jest wyłącznie lokalną funkcją interfejsu; nie zapisuje ani nie przesyła danych.
document.querySelectorAll('input[type="password"]').forEach(input=>{
  const wrapper=document.createElement('span');
  wrapper.className='password-visibility';
  input.parentNode.insertBefore(wrapper,input);
  wrapper.append(input);
  const button=document.createElement('button');
  button.type='button';
  button.className='password-visibility__toggle';
  button.setAttribute('aria-label','Pokaż hasło');
  button.setAttribute('aria-pressed','false');
  button.textContent='Pokaż';
  wrapper.append(button);
  button.addEventListener('click',()=>{
    const reveal=input.type==='password';
    input.type=reveal?'text':'password';
    button.textContent=reveal?'Ukryj':'Pokaż';
    button.setAttribute('aria-label',reveal?'Ukryj hasło':'Pokaż hasło');
    button.setAttribute('aria-pressed',String(reveal));
  });
});

const form=document.getElementById('login-form');
const status=document.getElementById('login-status');
// Replace the browser's unstyleable nickname tooltip with a readable Premium notice.
const nickname=document.getElementById('username');
const nickNotice=document.getElementById('login-nick-validation');
if(nickname&&nickNotice){
  const message=document.getElementById('login-nick-validation-message');
  const hideNotice=()=>{
    nickNotice.hidden=true;
    nickname.removeAttribute('aria-invalid');
    nickname.removeAttribute('aria-describedby');
  };
  const showNotice=()=>{
    const count=nickname.value.length;
    message.textContent=nickname.validity.valueMissing
      ?'Wpisz nick administratora.'
      :count<3
        ?'Wydłuż ten tekst do co najmniej 3 znaków (teraz używasz '+count+' znaków).'
        :'Nick musi zaczynać się literą i zawierać tylko litery, cyfry, kropki, myślniki lub podkreślenia.';
    nickNotice.hidden=false;
    nickname.setAttribute('aria-invalid','true');
    nickname.setAttribute('aria-describedby','login-nick-validation-message');
  };
  nickname.addEventListener('invalid',event=>{
    event.preventDefault(); // Prevent the native tooltip; retain HTML constraint checks.
    showNotice();
  });
  nickname.addEventListener('input',()=>{
    if(nickname.validity.valid)hideNotice();
    else if(!nickNotice.hidden)showNotice();
  });
}


const passwordInput=document.getElementById('password');
const passwordNotice=document.getElementById('login-password-validation');
if(passwordInput&&passwordNotice){
  const message=document.getElementById('login-password-validation-message');
  const hidePasswordNotice=()=>{
    passwordNotice.hidden=true;
    passwordInput.removeAttribute('aria-invalid');
    passwordInput.removeAttribute('aria-describedby');
  };
  const showPasswordNotice=()=>{
    message.textContent=passwordInput.validity.valueMissing
      ?'Wpisz hasło.'
      :'Hasło jest za krótkie.';
    passwordNotice.hidden=false;
    passwordInput.setAttribute('aria-invalid','true');
    passwordInput.setAttribute('aria-describedby','login-password-validation-message');
  };
  passwordInput.addEventListener('invalid',event=>{
    event.preventDefault(); // Keep native constraints without the unstyled browser popup.
    showPasswordNotice();
  });
  passwordInput.addEventListener('input',()=>{
    if(passwordInput.validity.valid)hidePasswordNotice();
    else if(!passwordNotice.hidden)showPasswordNotice();
  });
}

form.addEventListener('submit',async event=>{
  event.preventDefault();
  const password=document.getElementById('password');
  const code=document.getElementById('code');
  const username=document.getElementById('username');
  const button=document.getElementById('login-button');
  if(button.disabled)return;
  button.disabled=true;
  status.textContent='Sprawdzanie…';
  try{
    const result=await fetch('/owner/newsletter/login',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        password:password.value,
        ...(username?{username:username.value}:{code:code.value})
      })
    });
    password.value='';
    if(code)code.value='';
    if(username)username.value='';
    if(!result.ok)throw Error('login_failed');
    location.replace('/owner/newsletter/');
  }catch{
    status.textContent='Logowanie nie powiodło się. Sprawdź dane lub spróbuj później.';
  }finally{button.disabled=false;}
});


const recoveryDialog=document.getElementById('forgot-dialog');
if(recoveryDialog){
  document.getElementById('forgot-open').addEventListener('click',()=>recoveryDialog.showModal());
  document.getElementById('forgot-close').addEventListener('click',()=>recoveryDialog.close());
  const sendForm=document.getElementById('forgot-request-form');
  const finishForm=document.getElementById('forgot-complete-form');
  const requestStatus=document.getElementById('forgot-request-status');
  const completeStatus=document.getElementById('forgot-complete-status');
  const recoveryEmail=document.getElementById('forgot-email');
  const recoveryHint=document.getElementById('forgot-email-hint');
  const emailNotice=document.getElementById('forgot-email-validation');
  const emailNoticeMessage=document.getElementById('forgot-email-validation-message');
  const hideEmailNotice=()=>{
    emailNotice.hidden=true;
    recoveryEmail.removeAttribute('aria-invalid');
    recoveryEmail.setAttribute('aria-describedby','forgot-email-hint');
  };
  const showEmailNotice=()=>{
    emailNoticeMessage.textContent=recoveryEmail.validity.valueMissing
      ?'Wpisz adres e-mail odzyskiwania hasła.'
      :'Wpisz poprawny adres e-mail.';
    emailNotice.hidden=false;
    recoveryEmail.setAttribute('aria-invalid','true');
    recoveryEmail.setAttribute('aria-describedby',
      'forgot-email-hint forgot-email-validation-message');
  };
  recoveryEmail.addEventListener('invalid',event=>{
    event.preventDefault(); // Keep required/type=email validation, suppress native popup.
    showEmailNotice();
  });
  recoveryEmail.addEventListener('input',()=>{
    if(recoveryEmail.validity.valid)hideEmailNotice();
    else if(!emailNotice.hidden)showEmailNotice();
  });
  recoveryEmail.addEventListener('input',()=>{
    // A public recovery page can check only syntax. The server privately
    // compares the saved recovery address and sends only on a match.
    const value=recoveryEmail.value.trim();
    const invalid=value.length>0&&!recoveryEmail.validity.valid;
    recoveryHint.classList.toggle('is-invalid',invalid);
    recoveryHint.textContent=value.length===0
      ?'Wpisz wcześniej potwierdzony adres e-mail odzyskiwania hasła.'
      :invalid
        ?'Niepoprawny format adresu e-mail. Sprawdź wpisany tekst.'
        :'Format adresu jest poprawny. Kliknij „Wyślij hasło tymczasowe”, aby przekazać prośbę do bezpiecznej weryfikacji.';
    requestStatus.textContent='';
    requestStatus.removeAttribute('data-state');
  });
  sendForm.addEventListener('submit',async event=>{
    event.preventDefault();
    hideEmailNotice();
    const button=sendForm.querySelector('button[type="submit"]');
    if(button.disabled)return;
    button.disabled=true;
    requestStatus.removeAttribute('data-state');
    requestStatus.textContent='Przetwarzanie prośby…';
    try{
      const response=await fetch('/owner/newsletter/recover/request',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:document.getElementById('forgot-email').value})
      });
      if(!response.ok)throw Error('unavailable');
      requestStatus.setAttribute('data-state','accepted');
      requestStatus.textContent='Prośba została przyjęta. Jeśli wpisany adres jest przypisany do administratora, otrzymasz na niego 10-literowy kod odzyskiwania ważny 10 minut. Sprawdź skrzynkę i folder Spam.';
    }catch{
      requestStatus.setAttribute('data-state','error');
      requestStatus.textContent='Odzyskiwanie jest chwilowo niedostępne. Spróbuj później.';
    }finally{button.disabled=false;}
  });
  finishForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const newPassword=document.getElementById('forgot-new-password');
    const repeated=document.getElementById('forgot-repeat');
    if(newPassword.value!==repeated.value){
      completeStatus.textContent='Nowe hasła muszą być identyczne.';
      return;
    }
    const button=finishForm.querySelector('button[type="submit"]');
    if(button.disabled)return;
    button.disabled=true;
    completeStatus.textContent='Sprawdzanie hasła tymczasowego…';
    try{
      const response=await fetch('/owner/newsletter/recover/complete',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          email:document.getElementById('forgot-email').value,
          code:document.getElementById('forgot-code').value.trim(),
          newPassword:newPassword.value
        })
      });
      if(!response.ok)throw Error('invalid');
      completeStatus.textContent='Hasło zmienione. Zamknij okno i zaloguj się nowym hasłem.';
      finishForm.reset();
      document.getElementById('password').value='';
    }catch{
      completeStatus.textContent='Nieprawidłowe lub wygasłe hasło tymczasowe albo przerwa techniczna. Sprawdź dane.';
    }finally{button.disabled=false;}
  });
}
