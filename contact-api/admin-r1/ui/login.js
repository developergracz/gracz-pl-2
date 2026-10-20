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
  sendForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=sendForm.querySelector('button[type="submit"]');
    if(button.disabled)return;
    button.disabled=true;
    requestStatus.textContent='Przetwarzanie prośby…';
    try{
      const response=await fetch('/owner/newsletter/recover/request',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:document.getElementById('forgot-email').value})
      });
      if(!response.ok)throw Error('unavailable');
      requestStatus.textContent='Jeśli to przypisany adres, wyślemy na niego jednorazowe hasło tymczasowe ważne 10 minut. Sprawdź skrzynkę.';
    }catch{
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
