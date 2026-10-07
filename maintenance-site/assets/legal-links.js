(function(){
  'use strict';

  var CONTACT_API='https://gracz-contact-api.onrender.com/contact';
  var NEWSLETTER_API='https://gracz-contact-api.onrender.com/newsletter/subscribe';
  var CONTACT_EMAIL='czsocha@wp.pl';
  var dialog=null;
  var lastTrigger=null;
  var contactOpenedAt=0;
  var contactRequestKey='';
  var contactSending=false;
  var accountDialog=null;
  var accountLastTrigger=null;

  function newRequestKey(){
    try{
      if(window.crypto&&typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID();
      if(window.crypto&&typeof window.crypto.getRandomValues==='function'){
        var bytes=new Uint8Array(24);
        window.crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes,function(value){return value.toString(16).padStart(2,'0');}).join('');
      }
    }catch(_){}
    return 'contact-'+Date.now()+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
  }

  function loadPortalSearch(){
    if(!document.querySelector('[data-modal="search"],[data-gracz-search]'))return;

    if(!document.querySelector('link[data-gracz-search-style]')){
      var link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/assets/search.css?v=nav-scale-r5';
      link.setAttribute('data-gracz-search-style','');
      document.head.appendChild(link);
    }

    function loadEngine(){
      if(window.GraczSearch||document.querySelector('script[data-gracz-search-script]'))return;
      var engine=document.createElement('script');
      engine.src='/assets/search.js?v=results-resizer-r3';
      engine.async=false;
      engine.setAttribute('data-gracz-search-script','');
      document.head.appendChild(engine);
    }

    if(window.GRACZ_SEARCH_INDEX){
      loadEngine();
      return;
    }

    if(!document.querySelector('script[data-gracz-search-index]')){
      var index=document.createElement('script');
      index.src='/assets/search-index.js?v=r5';
      index.async=false;
      index.setAttribute('data-gracz-search-index','');
      index.addEventListener('load',loadEngine,{once:true});
      document.head.appendChild(index);
    }
  }

  function ensureStyles(){
    var existing=document.querySelector('link[data-contact-modal-style]');
    if(existing){
      if(existing.sheet)return Promise.resolve();
      return new Promise(function(resolve){
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',resolve,{once:true});
      });
    }
    return new Promise(function(resolve){
      var link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/assets/contact-modal.css?v=r8';
      link.setAttribute('data-contact-modal-style','');
      link.addEventListener('load',resolve,{once:true});
      link.addEventListener('error',resolve,{once:true});
      document.head.appendChild(link);
    });
  }

  function modalMarkup(){
    return '<div class="contact-modal__panel">'+
      '<button class="contact-modal__close" type="button" data-contact-close aria-label="Zamknij formularz kontaktowy">×</button>'+
      '<span class="contact-modal__brand" aria-hidden="true">gracz<span>.pl</span></span>'+
      '<p class="contact-modal__eyebrow">Kontakt z gracz.pl</p>'+
      '<h2 id="contact-modal-title">Napisz do nas</h2>'+
      '<p class="contact-modal__intro">Masz pytanie, problem techniczny, pomysł na rozwój serwisu albo propozycję współpracy? Wypełnij formularz. Odpowiedź wyślemy na podany adres e-mail.</p>'+
      '<form class="contact-form" data-contact-form novalidate>'+
        '<div class="contact-form__row">'+
          '<div class="contact-field"><label for="contact-name">Imię i nazwisko</label><input id="contact-name" name="name" type="text" autocomplete="name" maxlength="80" placeholder="Jan Kowalski" required></div>'+
          '<div class="contact-field"><label for="contact-email">Adres e-mail</label><input id="contact-email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="jan@example.pl" required></div>'+
        '</div>'+
        '<div class="contact-form__row">'+
          '<div class="contact-field"><label for="contact-category">Kategoria sprawy</label><select id="contact-category" name="category" required><option value="">Wybierz kategorię</option><option>Pytanie ogólne</option><option>Problem techniczny</option><option>Sugestia / pomysł</option><option>Współpraca / reklama</option><option>Prywatność / RODO</option><option>Inna sprawa</option></select></div>'+
          '<div class="contact-field"><label for="contact-subject">Temat</label><input id="contact-subject" name="subject" type="text" maxlength="120" placeholder="Krótko opisz sprawę" required></div>'+
        '</div>'+
        '<div class="contact-field"><label for="contact-message">Wiadomość</label><textarea id="contact-message" name="message" minlength="10" maxlength="4000" placeholder="Napisz, w czym możemy pomóc…" required></textarea><div class="contact-field__meta"><span>Minimum 10 znaków</span><span data-contact-count>0 / 4000</span></div></div>'+
        '<label class="contact-form__check"><input name="acknowledgement" type="checkbox" required><span>Potwierdzam zapoznanie się z <a href="/polityka-prywatnosci/#kontakt" target="_blank" rel="noopener">Polityką prywatności</a> i przyjmuję do wiadomości zasady przetwarzania danych w celu obsługi zgłoszenia.</span></label>'+
        '<label class="contact-form__check contact-form__newsletter"><input name="newsletter" type="checkbox"><span><strong>Newsletter gracz.pl — opcjonalnie.</strong> Chcę otrzymywać informacje o nowych grach, poradnikach i rozwoju serwisu. Zapis wymaga osobnego potwierdzenia e-mail (double opt-in) i można go wycofać w każdej chwili. <a href="/polityka-prywatnosci/#newsletter" target="_blank" rel="noopener">Szczegóły</a>.</span></label>'+
        '<div class="contact-form__honeypot" aria-hidden="true"><label>Strona WWW<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>'+
        '<p class="contact-form__status" data-contact-status role="status" aria-live="polite"></p>'+
        '<div class="contact-form__actions"><button class="contact-form__submit" type="submit">Wyślij wiadomość</button><span class="contact-form__mail">lub napisz bezpośrednio: <a href="mailto:'+CONTACT_EMAIL+'">'+CONTACT_EMAIL+'</a></span></div>'+
        '<p class="contact-form__privacy"><strong>Dane osobowe:</strong> administratorem danych jest Czesław Socha. Dane z formularza służą do obsługi zgłoszenia i udzielenia odpowiedzi. <a href="/polityka-prywatnosci/#kontakt" target="_blank" rel="noopener">Szczegóły w Polityce prywatności</a>.</p>'+
        '<p class="contact-form__privacy"><strong>Bezpieczeństwo:</strong> nie podawaj w wiadomości haseł, numerów dokumentów, danych kart ani innych sekretów.</p>'+
      '</form>'+
    '</div>';
  }

  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='contact-modal';
    dialog.id='contact-modal';
    dialog.setAttribute('aria-labelledby','contact-modal-title');
    dialog.innerHTML=modalMarkup();
    document.body.appendChild(dialog);

    var form=dialog.querySelector('[data-contact-form]');
    var message=form.elements.message;
    var count=dialog.querySelector('[data-contact-count]');
    var status=dialog.querySelector('[data-contact-status]');

    function setStatus(text,type){
      status.textContent=text||'';
      status.classList.toggle('is-error',type==='error');
      status.classList.toggle('is-success',type==='success');
    }

    message.addEventListener('input',function(){
      count.textContent=String(message.value.length)+' / 4000';
    });

    form.addEventListener('input',function(event){
      var field=event.target;
      if(field&&field.matches&&field.matches('input,select,textarea')){
        field.setAttribute('aria-invalid','false');
      }
    });

    dialog.addEventListener('click',function(event){
      if(event.target===dialog||event.target.closest('[data-contact-close]'))closeContact();
    });

    dialog.addEventListener('cancel',function(event){
      event.preventDefault();
      closeContact();
    });

    dialog.addEventListener('close',function(){
      document.body.classList.remove('contact-modal-open');
      if(lastTrigger&&document.contains(lastTrigger)){
        try{lastTrigger.focus();}catch(_){}
      }
      lastTrigger=null;
    });

    dialog.addEventListener('keydown',function(event){
      if(event.key!=='Tab')return;
      var focusables=Array.prototype.slice.call(dialog.querySelectorAll('button,input,select,textarea,a[href]')).filter(function(node){
        return !node.disabled&&node.tabIndex!==-1&&node.offsetParent!==null;
      });
      if(!focusables.length)return;
      var first=focusables[0],last=focusables[focusables.length-1];
      if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}
      else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}
    });

    form.addEventListener('submit',async function(event){
      event.preventDefault();
      if(contactSending)return;
      setStatus('');
      var fields=['name','email','category','subject','message','acknowledgement'];
      var valid=true;
      fields.forEach(function(name){
        var input=form.elements[name];
        if(!input)return;
        var ok=input.checkValidity();
        input.setAttribute('aria-invalid',ok?'false':'true');
        if(!ok)valid=false;
      });
      if(!valid){
        setStatus('Uzupełnij poprawnie wszystkie wymagane pola.','error');
        var firstInvalid=form.querySelector('[aria-invalid="true"]');
        if(firstInvalid)firstInvalid.focus();
        return;
      }

      var submit=form.querySelector('.contact-form__submit');
      contactSending=true;
      submit.disabled=true;
      submit.textContent='Wysyłanie…';

      var payload={
        name:String(form.elements.name.value||'').trim(),
        email:String(form.elements.email.value||'').trim(),
        category:String(form.elements.category.value||'').trim(),
        subject:String(form.elements.subject.value||'').trim(),
        message:String(form.elements.message.value||'').trim(),
        website:String(form.elements.website.value||'').trim(),
        acknowledgement:Boolean(form.elements.acknowledgement.checked),
        newsletter:Boolean(form.elements.newsletter&&form.elements.newsletter.checked),
        page:location.href,
        startedAt:contactOpenedAt
      };

      try{
        if(!contactRequestKey)contactRequestKey=newRequestKey();
        setStatus('Łączę z bezpiecznym kanałem gracz.pl. Przy pierwszym uruchomieniu może to potrwać kilkanaście sekund.');
        var response=await fetch(CONTACT_API,{
          method:'POST',
          headers:{
            'content-type':'application/json',
            'x-idempotency-key':contactRequestKey
          },
          body:JSON.stringify(payload),
          mode:'cors',
          credentials:'omit'
        });
        var body={};
        try{body=await response.json();}catch(_){}
        if(!response.ok||body.ok!==true){
          var safeMessage=body&&body.error&&typeof body.error.message==='string'?body.error.message:'Nie udało się wysłać wiadomości.';
          var requestError=new Error(safeMessage);
          requestError.isContactApiError=true;
          requestError.code=body&&body.error&&body.error.code?String(body.error.code):'';
          throw requestError;
        }
        var successMessage='Wiadomość została wysłana. Dziękujemy — odpowiemy na podany adres e-mail.';
        if(body.newsletter==='confirmation_sent'){
          successMessage+=' Newsletter: wysłaliśmy osobny e-mail z linkiem potwierdzającym zapis.';
        }else if(payload.newsletter&&body.newsletter==='temporarily_unavailable'){
          successMessage+=' Wiadomość kontaktowa dotarła poprawnie, ale potwierdzenie newslettera nie mogło zostać teraz wysłane.';
        }
        setStatus(successMessage,'success');
        form.reset();
        count.textContent='0 / 4000';
        contactOpenedAt=Date.now();
        contactRequestKey=newRequestKey();
      }catch(error){
        var message=error&&error.isContactApiError&&error.message
          ? error.message
          : 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę albo użyj linku e-mail obok przycisku.';
        setStatus(message,'error');
        var emailCodes=['INVALID_EMAIL','EMAIL_DOMAIN_NO_MX','EMAIL_DOMAIN_TYPO','DISPOSABLE_EMAIL','ADMIN_EMAIL_NOT_ALLOWED'];
        if(error&&emailCodes.indexOf(error.code)!==-1){
          form.elements.email.setAttribute('aria-invalid','true');
          form.elements.email.focus();
        }else{
          submit.focus();
        }
      }finally{
        contactSending=false;
        submit.disabled=false;
        submit.textContent='Wyślij wiadomość';
      }
    });

    return dialog;
  }

  async function openContact(trigger){
    lastTrigger=trigger||document.activeElement;
    if(!contactSending){
      contactOpenedAt=Date.now();
      contactRequestKey=newRequestKey();
    }
    await ensureStyles();
    var target=ensureDialog();
    if(typeof target.showModal==='function')target.showModal();
    else target.setAttribute('open','');
    document.body.classList.add('contact-modal-open');
    window.setTimeout(function(){
      var first=target.querySelector('#contact-name');
      if(first)first.focus();
    },0);
  }

  function closeContact(){
    if(!dialog)return;
    if(typeof dialog.close==='function'&&dialog.open)dialog.close();
    else{
      dialog.removeAttribute('open');
      document.body.classList.remove('contact-modal-open');
      if(lastTrigger&&document.contains(lastTrigger))lastTrigger.focus();
      lastTrigger=null;
    }
  }


  function ensureAccountAccessStyles(){
    var existing=document.querySelector('link[data-account-access-style]');
    if(existing){
      if(existing.sheet)return Promise.resolve();
      return new Promise(function(resolve){
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',resolve,{once:true});
      });
    }
    return new Promise(function(resolve){
      var link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/assets/account-access-premium.css?v=r2';
      link.setAttribute('data-account-access-style','');
      link.addEventListener('load',resolve,{once:true});
      link.addEventListener('error',resolve,{once:true});
      document.head.appendChild(link);
    });
  }

  function accountAccessMarkup(){
    return '<div class="account-access__panel">'+
      '<button class="account-access__close" type="button" data-account-close aria-label="Zamknij okno">×</button>'+
      '<div class="account-access__topline">'+
        '<span class="account-access__brand" aria-hidden="true">gracz<span>.pl</span></span>'+
        '<span class="account-access__status"><i aria-hidden="true"></i>System kont w przygotowaniu</span>'+
      '</div>'+
      '<div class="account-access__hero">'+
        '<p class="account-access__eyebrow">Konto gracza · FULL MAX PREMIUM</p>'+
        '<h2 id="account-access-title">Konto gracza jest w przygotowaniu</h2>'+
        '<p id="account-access-intro" class="account-access__intro"></p>'+
      '</div>'+
      '<section class="account-access__newsletter" aria-labelledby="account-access-newsletter-title">'+
        '<div class="account-access__newsletter-icon" aria-hidden="true"><span>✦</span></div>'+
        '<div class="account-access__newsletter-copy">'+
          '<p class="account-access__newsletter-kicker">Bądź na bieżąco</p>'+
          '<h3 id="account-access-newsletter-title">Nie czekaj na start kont graczy</h3>'+
          '<p>Możesz już teraz zapisać się do naszego newslettera, aby otrzymywać najważniejsze informacje o uruchomieniu kont, nowych grach, funkcjach społecznościowych i rozwoju gracz.pl.</p>'+
          '<ul class="account-access__benefits">'+
            '<li><span aria-hidden="true">✓</span>informacja o starcie logowania i rejestracji</li>'+
            '<li><span aria-hidden="true">✓</span>zapowiedzi nowych gier, Academy i funkcji</li>'+
            '<li><span aria-hidden="true">✓</span>najważniejsze aktualizacje gracz.pl w jednym miejscu</li>'+
          '</ul>'+
          '<a class="account-access__newsletter-cta" href="/newsletter/"><span>Zapisz się do naszego newslettera</span><b aria-hidden="true">→</b></a>'+
          '<p class="account-access__consent">Zapis jest dobrowolny, wymaga potwierdzenia e-mail (double opt-in) i można go wycofać w każdej chwili.</p>'+
        '</div>'+
      '</section>'+
      '<div class="account-access__footer">'+
        '<span>gracz.pl · gry · Academy · społeczność</span>'+
        '<button type="button" class="account-access__back" data-account-close>Wróć do serwisu</button>'+
      '</div>'+
    '</div>';
  }

  function ensureAccountDialog(){
    if(accountDialog)return accountDialog;
    accountDialog=document.createElement('dialog');
    accountDialog.className='account-access';
    accountDialog.id='account-access-modal';
    accountDialog.setAttribute('aria-labelledby','account-access-title');
    accountDialog.setAttribute('aria-describedby','account-access-intro');
    accountDialog.innerHTML=accountAccessMarkup();
    document.body.appendChild(accountDialog);

    accountDialog.addEventListener('click',function(event){
      if(event.target===accountDialog||event.target.closest('[data-account-close]'))closeAccountAccess();
    });

    accountDialog.addEventListener('cancel',function(event){
      event.preventDefault();
      closeAccountAccess();
    });

    accountDialog.addEventListener('close',function(){
      document.body.classList.remove('account-access-open');
      if(accountLastTrigger&&document.contains(accountLastTrigger)){
        try{accountLastTrigger.focus();}catch(_){}
      }
      accountLastTrigger=null;
    });

    accountDialog.addEventListener('keydown',function(event){
      if(event.key!=='Tab')return;
      var focusables=Array.prototype.slice.call(accountDialog.querySelectorAll('button,a[href]')).filter(function(node){
        return !node.disabled&&node.tabIndex!==-1&&node.offsetParent!==null;
      });
      if(!focusables.length)return;
      var first=focusables[0],last=focusables[focusables.length-1];
      if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}
      else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}
    });

    return accountDialog;
  }

  async function openAccountAccess(mode,trigger){
    accountLastTrigger=trigger||document.activeElement;
    await ensureAccountAccessStyles();
    var target=ensureAccountDialog();
    var title=target.querySelector('#account-access-title');
    var intro=target.querySelector('#account-access-intro');

    if(mode==='register'){
      title.textContent='Załóż konto — funkcja już powstaje';
      intro.textContent='Przygotowujemy bezpieczną rejestrację i profil gracza połączony z grami, Academy, rankingami i społecznością gracz.pl.';
    }else{
      title.textContent='Logowanie — funkcja już powstaje';
      intro.textContent='System logowania i kont graczy jest w trakcie przygotowania. Po uruchomieniu jedno konto połączy Twoje gry, Academy, postępy i funkcje społecznościowe.';
    }

    if(typeof target.showModal==='function')target.showModal();
    else target.setAttribute('open','');
    document.body.classList.add('account-access-open');
    window.setTimeout(function(){
      var cta=target.querySelector('.account-access__newsletter-cta');
      if(cta)cta.focus();
    },0);
  }

  function closeAccountAccess(){
    if(!accountDialog)return;
    if(typeof accountDialog.close==='function'&&accountDialog.open)accountDialog.close();
    else{
      accountDialog.removeAttribute('open');
      document.body.classList.remove('account-access-open');
      if(accountLastTrigger&&document.contains(accountLastTrigger)){
        try{accountLastTrigger.focus();}catch(_){}
      }
      accountLastTrigger=null;
    }
  }

  function ensureFooterNewsletterStyles(){
    if(document.querySelector('link[data-footer-newsletter-style]'))return;
    var link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/footer-newsletter.css?v=r1';
    link.setAttribute('data-footer-newsletter-style','');
    document.head.appendChild(link);
  }

  function setFooterNewsletterStatus(form,text,type){
    var status=form.querySelector('[data-footer-newsletter-status]');
    if(!status)return;
    status.textContent=text||'';
    status.classList.toggle('is-error',type==='error');
  }

  function enhanceFooterNewsletter(form){
    if(form.classList.contains('footer-newsletter-live'))return;
    var email=form.querySelector('input[type="email"]');
    var submit=form.querySelector('button[type="submit"]');
    if(!email||!submit)return;

    ensureFooterNewsletterStyles();
    form.classList.add('footer-newsletter-live');
    form.setAttribute('aria-label','Zapis do newslettera gracz.pl');
    form.dataset.newsletterOpenedAt=String(Date.now());

    email.name='email';
    email.required=true;
    email.maxLength=254;
    email.autocomplete='email';
    email.setAttribute('inputmode','email');

    var consent=document.createElement('label');
    consent.className='footer-newsletter-consent';
    consent.setAttribute('data-footer-newsletter-consent','');
    consent.innerHTML='<input name="consent" type="checkbox" required><span>Chcę otrzymywać newsletter gracz.pl. Zapis jest dobrowolny, wymaga potwierdzenia e-mail i można go wycofać w każdej chwili. <a href="/polityka-prywatnosci/#newsletter">Polityka prywatności</a>.</span>';
    form.appendChild(consent);

    var honeypot=document.createElement('div');
    honeypot.className='footer-newsletter-honeypot';
    honeypot.setAttribute('aria-hidden','true');
    honeypot.innerHTML='<label>Strona WWW<input name="website" type="text" tabindex="-1" autocomplete="off"></label>';
    form.appendChild(honeypot);

    var status=document.createElement('p');
    status.className='footer-newsletter-status';
    status.setAttribute('data-footer-newsletter-status','');
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    form.appendChild(status);
  }

  function initFooterNewsletters(){
    var forms=document.querySelectorAll('form[data-newsletter]');
    if(!forms.length)return;
    Array.prototype.forEach.call(forms,enhanceFooterNewsletter);
  }

  async function submitFooterNewsletter(form){
    if(form.dataset.newsletterSending==='1')return;
    var email=form.elements.email;
    var consent=form.elements.consent;
    var submit=form.querySelector('button[type="submit"]');
    if(!email||!consent||!submit)return;

    setFooterNewsletterStatus(form,'');
    if(!form.reportValidity())return;

    form.dataset.newsletterSending='1';
    submit.disabled=true;
    var originalText=submit.textContent;
    submit.textContent='Wysyłanie…';
    setFooterNewsletterStatus(form,'Łączę z bezpiecznym kanałem gracz.pl. Przy pierwszym uruchomieniu może to potrwać kilkanaście sekund.');

    try{
      var response=await fetch(NEWSLETTER_API,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          name:'',
          email:String(email.value||'').trim(),
          consent:Boolean(consent.checked),
          website:String(form.elements.website&&form.elements.website.value||'').trim(),
          startedAt:Number(form.dataset.newsletterOpenedAt||Date.now())
        }),
        mode:'cors',
        credentials:'omit'
      });
      var body={};
      try{body=await response.json();}catch(_){}
      if(!response.ok||body.ok!==true){
        var safeMessage=body&&body.error&&typeof body.error.message==='string'
          ?body.error.message
          :'Nie udało się rozpocząć zapisu. Spróbuj ponownie za chwilę.';
        var error=new Error(safeMessage);
        error.code=body&&body.error&&body.error.code?String(body.error.code):'';
        throw error;
      }

      setFooterNewsletterStatus(form,'Sprawdź skrzynkę e-mail. Wysłaliśmy bezpieczny link potwierdzający zapis.');
      form.reset();
      form.dataset.newsletterOpenedAt=String(Date.now());
    }catch(error){
      setFooterNewsletterStatus(form,error&&error.message?error.message:'Nie udało się rozpocząć zapisu. Spróbuj ponownie za chwilę.','error');
      var emailCodes=['INVALID_EMAIL','EMAIL_DOMAIN_NO_MX','EMAIL_DOMAIN_TYPO','DISPOSABLE_EMAIL','ADMIN_EMAIL_NOT_ALLOWED'];
      if(error&&emailCodes.indexOf(error.code)!==-1)email.focus();
      else submit.focus();
    }finally{
      form.dataset.newsletterSending='0';
      submit.disabled=false;
      submit.textContent=originalText;
    }
  }

  loadPortalSearch();
  initFooterNewsletters();

  document.addEventListener('submit',function(event){
    var form=event.target&&event.target.matches&&event.target.matches('form[data-newsletter]')?event.target:null;
    if(!form||!form.classList.contains('footer-newsletter-live'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submitFooterNewsletter(form);
  },true);

  document.addEventListener('click',function(event){
    var accountTrigger=event.target.closest('[data-modal="login"],[data-modal="register"]');
    if(accountTrigger){
      event.preventDefault();
      event.stopImmediatePropagation();
      openAccountAccess(accountTrigger.getAttribute('data-modal'),accountTrigger);
      return;
    }

    var search=event.target.closest('[data-modal="search"],[data-gracz-search]');
    if(search&&!window.GraczSearch){
      event.preventDefault();
      event.stopImmediatePropagation();
      loadPortalSearch();
      var attempts=0;
      var timer=window.setInterval(function(){
        attempts++;
        if(window.GraczSearch){
          window.clearInterval(timer);
          window.GraczSearch.open(search,search.getAttribute('data-search-preset')||'');
        }else if(attempts>=40){
          window.clearInterval(timer);
          window.location.assign('/szukaj/');
        }
      },50);
      return;
    }

    var privacy=event.target.closest('[data-modal="privacy"]');
    if(privacy){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('/polityka-prywatnosci/');
      return;
    }
    var terms=event.target.closest('[data-modal="terms"]');
    if(terms){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('/regulamin/');
      return;
    }
    var contact=event.target.closest('[data-modal="contact"]');
    if(contact){
      event.preventDefault();
      event.stopImmediatePropagation();
      openContact(contact);
    }
  },true);
})();