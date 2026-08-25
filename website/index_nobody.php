<?php

echo('
  <div class="tlo_glowna">
');

?>

  <?php

    GryWyswietlNajpopularniejsze(4);

  ?>

  <div class="newsletter-success" id="newsletter-success" role="dialog" aria-modal="true" aria-labelledby="newsletter-success-title" aria-describedby="newsletter-success-description" hidden>
    <div class="newsletter-success__backdrop" data-newsletter-close></div>
    <div class="newsletter-success__dialog" role="document">
      <button class="newsletter-success__close" type="button" aria-label="Zamknij okno" data-newsletter-close>&times;</button>

      <div class="newsletter-success__logo" aria-label="gracz.pl">
        <span class="newsletter-success__logo-name">gracz</span><span class="newsletter-success__logo-domain">.pl</span>
      </div>

      <h2 id="newsletter-success-title">Dziękujemy Ci <strong class="newsletter-success__nick">gracz</strong> za zapisanie się do naszego newslettera!</h2>
      <p id="newsletter-success-description" class="newsletter-success__confirmation">
        Na wskazany adres e-mail zostanie wysłana wiadomość potwierdzająca zapisanie się do naszego newslettera wraz z Twoim wybranym nickiem <strong class="newsletter-success__nick">gracz</strong>.
      </p>
      <p class="newsletter-success__release">Będziemy informować Cię o testach, premierze i uruchomieniu platformy.</p>

      <button class="newsletter-success__button" type="button" data-newsletter-close>ZAMKNIJ</button>
    </div>
  </div>

  <style>
    .newsletter-success[hidden] { display: none; }
    .newsletter-success {
      position: fixed;
      z-index: 10000;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: Arial, sans-serif;
    }
    .newsletter-success__backdrop {
      position: absolute;
      inset: 0;
      background: rgba(1, 8, 12, .82);
    }
    .newsletter-success__dialog {
      position: relative;
      width: min(100%, 610px);
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      padding: 46px 48px 42px;
      border: 1px solid rgba(67, 119, 141, .38);
      border-radius: 18px;
      background: linear-gradient(145deg, #102a34, #091b24);
      box-shadow: 0 28px 80px rgba(0, 0, 0, .52);
      color: #fff;
      text-align: center;
    }
    .newsletter-success__close {
      position: absolute;
      top: 12px;
      right: 14px;
      width: 38px;
      height: 38px;
      border: 0;
      background: transparent;
      color: #9db2bd;
      font-size: 30px;
      line-height: 1;
      cursor: pointer;
    }
    .newsletter-success__logo {
      margin-bottom: 28px;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -1.5px;
      line-height: 1;
      text-transform: lowercase;
    }
    .newsletter-success__logo-name { color: #fff; }
    .newsletter-success__logo-domain { color: #ef3f4c; }
    .newsletter-success h2 {
      margin: 0;
      color: #fff;
      font-size: 28px;
      line-height: 1.3;
    }
    .newsletter-success__nick { color: #42a9ed; font-weight: 700; }
    .newsletter-success__confirmation,
    .newsletter-success__release {
      margin: 22px auto 0;
      color: #d4e0e5;
      font-size: 16px;
      line-height: 1.65;
    }
    .newsletter-success__release {
      margin-top: 14px;
      color: #aebfc7;
    }
    .newsletter-success__button {
      min-width: 180px;
      margin-top: 30px;
      padding: 14px 30px;
      border: 1px solid #1f5369;
      border-radius: 7px;
      background: #153f52;
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: .08em;
      cursor: pointer;
    }
    .newsletter-success__button:hover,
    .newsletter-success__button:focus { background: #1b5067; }
    body.newsletter-modal-open { overflow: hidden; }

    @media (max-width: 600px) {
      .newsletter-success { padding: 14px; }
      .newsletter-success__dialog {
        max-height: calc(100vh - 28px);
        padding: 38px 22px 30px;
        border-radius: 14px;
      }
      .newsletter-success__logo { margin-bottom: 22px; font-size: 30px; }
      .newsletter-success h2 { font-size: 22px; }
      .newsletter-success__confirmation,
      .newsletter-success__release { font-size: 15px; }
      .newsletter-success__button { width: 100%; }
    }
  </style>

  <script>
    (function () {
      var modal = document.getElementById('newsletter-success');
      if (!modal) return;

      var previousFocus = null;
      var closeButtons = modal.querySelectorAll('[data-newsletter-close]');
      var actionButton = modal.querySelector('.newsletter-success__button');

      window.showNewsletterSuccess = function () {
        previousFocus = document.activeElement;
        modal.hidden = false;
        document.body.classList.add('newsletter-modal-open');
        actionButton.focus();
      };

      function closeNewsletterSuccess() {
        modal.hidden = true;
        document.body.classList.remove('newsletter-modal-open');
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      }

      for (var i = 0; i < closeButtons.length; i += 1) {
        closeButtons[i].addEventListener('click', closeNewsletterSuccess);
      }

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !modal.hidden) closeNewsletterSuccess();
      });

      document.addEventListener('newsletter:success', window.showNewsletterSuccess);
    }());
  </script>

<?php
  echo('</div>');
?>
