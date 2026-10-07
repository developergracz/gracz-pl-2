(function(){
  'use strict';

  var CONTACT_API='https://gracz-contact-api.onrender.com/contact';
  var CONTACT_EMAIL='czsocha@wp.pl';
  var PREVIEW_HOST='gracz-newsletter-full-max-preview-r1.onrender.com';
  var dialog=null;
  var lastTrigger=null;
  var lastContactData=null;
  var lastCaseId='';

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
      link.href='/assets/contact-modal.css?v=full-max-premium-r1';
      link.setAttribute('data-contact-modal-style','');
      link.addEventListener('load',resolve,{once:true});
      link.addEventListener('error',resolve,{once:true});
      document.head.appendChild(link);
    });
  }

  function modalMarkup(){
    return '<div class="contact-modal__panel contact-premium">'+
      '<button class="contact-modal__close" type="button" data-contact-close aria-label="Zamknij formularz kontaktowy">×</button>'+

      '<section class="contact-flow-view" data-contact-view="form">'+
        '<span class="contact-modal__brand" aria-hidden="true">gracz<span>.pl</span></span>'+
        '<p class="contact-modal__eyebrow">Kontakt z gracz.pl · FULL MAX PREMIUM</p>'+
        '<h2 id="contact-modal-title">Napisz do nas</h2>'+
        '<p class="contact-modal__intro">Masz pytanie, problem techniczny, pomysł na rozwój serwisu albo propozycję współpracy? Wypełnij formularz. Odpowiedź wyślemy na podany adres e-mail.</p>'+

        '<div class="contact-casebar" aria-label="Obsługa zgłoszenia">'+
          '<div><span>Numer sprawy</span><strong>nadamy po wysłaniu</strong></div>'+
          '<div><span>Status</span><strong class="contact-chip contact-chip--teal">NOWE</strong></div>'+
          '<div><span>Priorytet</span><strong class="contact-chip contact-chip--gold">STANDARD</strong></div>'+
          '<div><span>Data</span><strong data-contact-date>—</strong></div>'+
        '</div>'+

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
          '<div class="contact-form__honeypot" aria-hidden="true"><label>Strona WWW<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>'+

          '<section class="contact-newsletter-card" aria-labelledby="contact-newsletter-title">'+
            '<div class="contact-newsletter-card__icon" aria-hidden="true">✉</div>'+
            '<div class="contact-newsletter-card__body">'+
              '<p class="contact-newsletter-card__kicker">NEWSLETTER FULL MAX PREMIUM</p>'+
              '<h3 id="contact-newsletter-title">Chcesz być bliżej gracz.pl?</h3>'+
              '<p>Nowe gry, Academy, poradniki i najważniejsze informacje o rozwoju serwisu. Zapis jest dobrowolny i całkowicie niezależny od wysłania zapytania.</p>'+
              '<div class="contact-newsletter-card__benefits"><span>✓ Nowe gry</span><span>✓ Academy</span><span>✓ Aktualizacje</span></div>'+
              '<button class="contact-newsletter-card__button" type="button" data-contact-newsletter-open>Chcę zapisać się do newslettera</button>'+
            '</div>'+
          '</section>'+

          '<p class="contact-form__status" data-contact-status role="status" aria-live="polite"></p>'+
          '<div class="contact-form__actions"><button class="contact-form__submit" type="submit">Wyślij wiadomość</button><span class="contact-form__mail">lub napisz bezpośrednio: <a href="mailto:'+CONTACT_EMAIL+'">'+CONTACT_EMAIL+'</a></span></div>'+
          '<p class="contact-form__privacy"><strong>Dane osobowe:</strong> administratorem danych jest Czesław Socha. Dane z formularza służą do obsługi zgłoszenia i udzielenia odpowiedzi. <a href="/polityka-prywatnosci/#kontakt" target="_blank" rel="noopener">Szczegóły w Polityce prywatności</a>.</p>'+
          '<p class="contact-form__privacy"><strong>Bezpieczeństwo:</strong> nie podawaj w wiadomości haseł, numerów dokumentów, danych kart ani innych sekretów.</p>'+
          '<p class="contact-preview-note" data-contact-preview-note hidden><strong>TRYB TESTOWY:</strong> na tej bocznej wersji wysłanie formularza jest symulowane. Produkcyjny backend kontaktowy nie jest zmieniany podczas trwającego audytu PR #193.</p>'+
        '</form>'+
      '</section>'+

      '<section class="contact-flow-view contact-email-preview" data-contact-view="email" hidden>'+
        '<div class="email-preview__top">'+
          '<div><span class="email-preview__logo">gracz<span>.pl</span></span><p>Centrum Obsługi Użytkownika · Premium Service</p></div>'+
          '<span class="email-preview__badge" data-email-category>ZGŁOSZENIE</span>'+
        '</div>'+
        '<div class="email-preview__casebar">'+
          '<div><span>Numer sprawy</span><strong data-email-case>—</strong></div>'+
          '<div><span>Status</span><strong class="email-preview__status">PRZYJĘTE</strong></div>'+
          '<div><span>Priorytet</span><strong class="email-preview__priority">STANDARD</strong></div>'+
          '<div><span>Data</span><strong data-email-date>—</strong></div>'+
        '</div>'+
        '<div class="email-preview__content">'+
          '<p class="email-preview__hello">Dzień dobry <strong data-email-name>Graczu</strong>,</p>'+
          '<p>dziękujemy za kontakt z <strong>gracz.pl</strong>. Twoje zgłoszenie zostało przyjęte do obsługi.</p>'+
          '<div class="email-preview__answer"><span>Potwierdzenie gracz.pl</span><strong data-email-subject>Twoja sprawa</strong><p>Wiadomość została zarejestrowana. Odpowiedź otrzymasz na podany adres e-mail.</p></div>'+
          '<div class="email-preview__grid">'+
            '<div><span>Kategoria</span><strong data-email-category-detail>—</strong></div>'+
            '<div><span>Adres odpowiedzi</span><strong data-email-address>—</strong></div>'+
          '</div>'+
          '<div class="email-preview__newsletter">'+
            '<span class="email-preview__newsletter-kicker">NEWSLETTER FULL MAX PREMIUM</span>'+
            '<h3>Chcesz być bliżej gracz.pl?</h3>'+
            '<p>Otrzymuj informacje o nowych grach, ważnych funkcjach serwisu, poradnikach i rozwoju gracz.pl.</p>'+
            '<button type="button" data-contact-newsletter-open>Chcę zapisać się do newslettera</button>'+
            '<small>Po kliknięciu pokażemy osobny formularz zgody. Zapis do newslettera nie jest łączony ze zgodą kontaktową.</small>'+
          '</div>'+
          '<div class="email-preview__security"><strong>Bezpieczeństwo:</strong> gracz.pl nigdy nie prosi w wiadomości e-mail o hasło, kod jednorazowy, dane karty ani numer dokumentu.</div>'+
          '<div class="email-preview__actions"><button type="button" class="email-preview__back" data-contact-back-form>Wróć do formularza</button><button type="button" class="email-preview__close" data-contact-close>Zamknij</button></div>'+
          '<p class="email-preview__test">Podgląd wiadomości FULL MAX PREMIUM — wersja testowa na bocznej gałęzi.</p>'+
        '</div>'+
      '</section>'+

      '<section class="contact-flow-view contact-newsletter-consent" data-contact-view="newsletter-consent" hidden>'+
        '<span class="contact-modal__brand" aria-hidden="true">gracz<span>.pl</span></span>'+
        '<p class="contact-modal__eyebrow">Newsletter FULL MAX PREMIUM</p>'+
        '<h2>Potwierdź zgodę na newsletter</h2>'+
        '<p class="contact-modal__intro">Newsletter jest dobrowolny. Zgoda na newsletter jest oddzielna od zgody wymaganej do obsługi wiadomości kontaktowej.</p>'+
        '<form class="newsletter-consent-form" data-contact-newsletter-consent novalidate>'+
          '<div class="contact-field"><label for="contact-newsletter-email">Adres e-mail</label><input id="contact-newsletter-email" name="newsletterEmail" type="email" autocomplete="email" maxlength="254" placeholder="jan@example.pl" required></div>'+
          '<div class="contact-field"><label for="contact-newsletter-nick">Nick <span class="optional">opcjonalnie</span></label><input id="contact-newsletter-nick" name="newsletterNick" type="text" autocomplete="nickname" maxlength="24" placeholder="Twój nick w gracz.pl"></div>'+
          '<div class="newsletter-consent-benefits"><div><strong>Nowe gry</strong><span>Premiery i nowe moduły.</span></div><div><strong>Academy</strong><span>Poradniki i materiały.</span></div><div><strong>Rozwój serwisu</strong><span>Ważne aktualizacje.</span></div></div>'+
          '<label class="contact-form__check newsletter-consent-check"><input name="newsletterConsent" type="checkbox" required><span><strong>Tak, chcę otrzymywać newsletter gracz.pl.</strong><br>Wyrażam dobrowolną zgodę na informacje o nowych grach, Academy, poradnikach i rozwoju serwisu.</span></label>'+
          '<label class="contact-form__check newsletter-consent-check"><input name="newsletterLegal" type="checkbox" required><span>Zapoznałem(-am) się z <a href="/polityka-prywatnosci/" target="_blank" rel="noopener">Polityką prywatności</a> i <a href="/regulamin/" target="_blank" rel="noopener">Regulaminem</a>.</span></label>'+
          '<p class="newsletter-consent-status" data-newsletter-consent-status role="status" aria-live="polite"></p>'+
          '<div class="newsletter-consent-actions"><button type="button" class="newsletter-consent-back" data-newsletter-consent-back>Wróć</button><button type="submit" class="newsletter-consent-confirm">Akceptuję i chcę kontynuować</button></div>'+
          '<p class="newsletter-consent-note">W produkcji po tej zgodzie uruchomimy osobny proces <strong>double opt-in</strong>. Samo zaznaczenie zgody nie powinno aktywować subskrypcji bez potwierdzenia adresu.</p>'+
        '</form>'+
      '</section>'+

      '<section class="contact-flow-view contact-newsletter-thanks" data-contact-view="newsletter-thanks" hidden>'+
        '<div class="newsletter-thanks__icon" aria-hidden="true">✓</div>'+
        '<span class="contact-modal__eyebrow">Newsletter gracz.pl · dziękujemy</span>'+
        '<h2>Dziękujemy, <span data-newsletter-thanks-name>Graczu</span>!</h2>'+
        '<p class="contact-modal__intro">Twoja decyzja została poprawnie przyjęta w wersji testowej FULL MAX PREMIUM.</p>'+
        '<div class="newsletter-thanks__grid"><div><span>Status</span><strong>ZGODA PRZYJĘTA</strong></div><div><span>Adres e-mail</span><strong data-newsletter-thanks-email>—</strong></div><div><span>Model zapisu</span><strong>DOUBLE OPT-IN</strong></div><div><span>Źródło</span><strong>FORMULARZ KONTAKTOWY</strong></div></div>'+
        '<div class="newsletter-thanks__benefits"><h3>Co możesz otrzymywać?</h3><div><span><strong>Nowe gry</strong>Premiery i funkcje.</span><span><strong>Poradniki i Academy</strong>Wybrane materiały.</span><span><strong>Aktualizacje</strong>Najważniejsze zmiany gracz.pl.</span></div></div>'+
        '<div class="newsletter-thanks__next"><strong>Co dalej?</strong><br>W tej wersji testowej nic nie zostało zapisane ani wysłane. Po podłączeniu backendu otrzymasz wiadomość z bezpiecznym linkiem potwierdzającym zapis.</div>'+
        '<div class="newsletter-thanks__actions"><button type="button" data-newsletter-thanks-back>Wróć do formularza kontaktowego</button><button type="button" data-contact-close>Zamknij</button></div>'+
      '</section>'+
    '</div>';
  }

  function escapeHtml(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  function formatDate(){
    try{
      return new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
    }catch(_){
      return new Date().toISOString().slice(0,10);
    }
  }

  function makeCaseId(raw){
    var year=String(new Date().getFullYear());
    if(raw){
      var clean=String(raw).replace(/[^A-Za-z0-9]/g,'').slice(0,8).toUpperCase();
      if(clean)return 'GRACZ-'+year+'-'+clean;
    }
    return 'GRACZ-'+year+'-'+String(Math.floor(100000+Math.random()*900000));
  }

  function maskEmail(email){
    var value=String(email||'');
    var at=value.indexOf('@');
    if(at<1)return value||'—';
    var local=value.slice(0,at);
    var domain=value.slice(at+1);
    var shown=local.slice(0,Math.min(2,local.length));
    return shown+'***@'+domain;
  }

  function firstName(name){
    var value=String(name||'').trim();
    return value?value.split(/\s+/)[0]:'Graczu';
  }

  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='contact-modal contact-modal--full-max';
    dialog.id='contact-modal';
    dialog.setAttribute('aria-labelledby','contact-modal-title');
    dialog.innerHTML=modalMarkup();
    document.body.appendChild(dialog);

    var form=dialog.querySelector('[data-contact-form]');
    var message=form.elements.message;
    var count=dialog.querySelector('[data-contact-count]');
    var status=dialog.querySelector('[data-contact-status]');
    var consentForm=dialog.querySelector('[data-contact-newsletter-consent]');
    var previewNote=dialog.querySelector('[data-contact-preview-note]');
    if(location.hostname===PREVIEW_HOST&&previewNote)previewNote.hidden=false;

    var dateNode=dialog.querySelector('[data-contact-date]');
    if(dateNode)dateNode.textContent=formatDate();

    function setView(name){
      dialog.querySelectorAll('[data-contact-view]').forEach(function(view){
        view.hidden=view.getAttribute('data-contact-view')!==name;
      });
      var panel=dialog.querySelector('.contact-modal__panel');
      if(panel)panel.scrollTop=0;
      window.setTimeout(function(){
        var target=dialog.querySelector('[data-contact-view="'+name+'"]');
        var focusable=target&&target.querySelector('input:not([type="hidden"]),button,select,textarea,a[href]');
        if(focusable)try{focusable.focus({preventScroll:true});}catch(_){}
      },0);
    }

    function setStatus(text,type){
      status.textContent=text||'';
      status.classList.toggle('is-error',type==='error');
      status.classList.toggle('is-success',type==='success');
    }

    function validateContact(){
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
      }
      return valid;
    }

    function contactPayload(){
      return {
        name:String(form.elements.name.value||'').trim(),
        email:String(form.elements.email.value||'').trim(),
        category:String(form.elements.category.value||'').trim(),
        subject:String(form.elements.subject.value||'').trim(),
        message:String(form.elements.message.value||'').trim(),
        website:String(form.elements.website.value||'').trim(),
        acknowledgement:Boolean(form.elements.acknowledgement.checked),
        page:location.href
      };
    }

    function renderEmailPreview(data,id){
      lastContactData=data;
      lastCaseId=makeCaseId(id);
      var pairs=[
        ['[data-email-category]',data.category||'ZGŁOSZENIE'],
        ['[data-email-case]',lastCaseId],
        ['[data-email-date]',formatDate()],
        ['[data-email-name]',firstName(data.name)],
        ['[data-email-subject]',data.subject||'Twoja sprawa'],
        ['[data-email-category-detail]',data.category||'—'],
        ['[data-email-address]',data.email||'—']
      ];
      pairs.forEach(function(pair){
        var node=dialog.querySelector(pair[0]);
        if(node)node.textContent=pair[1];
      });
      setView('email');
    }

    function openNewsletterConsent(){
      var email=dialog.querySelector('#contact-newsletter-email');
      var nick=dialog.querySelector('#contact-newsletter-nick');
      var source=lastContactData||contactPayload();
      if(email&&!email.value)email.value=String(source.email||'').slice(0,254);
      if(nick&&!nick.value&&source.name)nick.value=firstName(source.name).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,24);
      var nstatus=dialog.querySelector('[data-newsletter-consent-status]');
      if(nstatus){nstatus.textContent='';nstatus.className='newsletter-consent-status';}
      setView('newsletter-consent');
    }

    function showNewsletterThanks(){
      var email=String(consentForm.elements.newsletterEmail.value||'').trim();
      var nick=String(consentForm.elements.newsletterNick.value||'').trim();
      var nameNode=dialog.querySelector('[data-newsletter-thanks-name]');
      var emailNode=dialog.querySelector('[data-newsletter-thanks-email]');
      if(nameNode)nameNode.textContent=nick||firstName(lastContactData&&lastContactData.name);
      if(emailNode)emailNode.textContent=maskEmail(email);
      setView('newsletter-thanks');
    }

    message.addEventListener('input',function(){
      count.textContent=String(message.value.length)+' / 4000';
    });

    dialog.addEventListener('click',function(event){
      if(event.target===dialog||event.target.closest('[data-contact-close]')){
        closeContact();
        return;
      }
      if(event.target.closest('[data-contact-newsletter-open]')){
        event.preventDefault();
        openNewsletterConsent();
        return;
      }
      if(event.target.closest('[data-contact-back-form]')||event.target.closest('[data-newsletter-consent-back]')||event.target.closest('[data-newsletter-thanks-back]')){
        event.preventDefault();
        setView('form');
      }
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
      setStatus('');
      if(!validateContact())return;

      var submit=form.querySelector('.contact-form__submit');
      var payload=contactPayload();
      submit.disabled=true;
      submit.textContent='Wysyłanie…';

      try{
        if(location.hostname===PREVIEW_HOST){
          await new Promise(function(resolve){window.setTimeout(resolve,650);});
          renderEmailPreview(payload,'PREVIEW'+Date.now().toString(36));
          form.reset();
          count.textContent='0 / 4000';
          return;
        }

        var response=await fetch(CONTACT_API,{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify(payload),
          mode:'cors',
          credentials:'omit'
        });
        var body={};
        try{body=await response.json();}catch(_){}
        if(!response.ok)throw new Error(body&&body.error&&body.error.message?body.error.message:'Nie udało się wysłać wiadomości.');
        renderEmailPreview(payload,body&&body.id);
        form.reset();
        count.textContent='0 / 4000';
      }catch(error){
        setStatus('Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę albo użyj linku e-mail obok przycisku.','error');
      }finally{
        submit.disabled=false;
        submit.textContent='Wyślij wiadomość';
      }
    });

    consentForm.addEventListener('submit',function(event){
      event.preventDefault();
      var email=consentForm.elements.newsletterEmail;
      var consent=consentForm.elements.newsletterConsent;
      var legal=consentForm.elements.newsletterLegal;
      var nstatus=dialog.querySelector('[data-newsletter-consent-status]');
      var validEmail=email&&email.checkValidity();
      var validConsent=consent&&consent.checked;
      var validLegal=legal&&legal.checked;

      if(email)email.setAttribute('aria-invalid',validEmail?'false':'true');
      if(!validEmail||!validConsent||!validLegal){
        if(nstatus){
          nstatus.textContent=!validEmail?'Podaj prawidłowy adres e-mail.':(!validConsent?'Zaznacz dobrowolną zgodę newsletterową.':'Potwierdź zapoznanie się z dokumentami.');
          nstatus.className='newsletter-consent-status is-error';
        }
        if(!validEmail&&email)email.focus();
        else if(!validConsent&&consent)consent.focus();
        else if(legal)legal.focus();
        return;
      }

      if(nstatus){
        nstatus.textContent='Zgoda zaakceptowana w trybie testowym.';
        nstatus.className='newsletter-consent-status is-success';
      }
      window.setTimeout(showNewsletterThanks,250);
    });

    return dialog;
  }

  async function openContact(trigger){
    lastTrigger=trigger||document.activeElement;
    await ensureStyles();
    var target=ensureDialog();
    target.querySelectorAll('[data-contact-view]').forEach(function(view){
      view.hidden=view.getAttribute('data-contact-view')!=='form';
    });
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

  loadPortalSearch();

  document.addEventListener('click',function(event){
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