<?php include("variables_local.php"); include_once($header); ?>

<div class="box light login">
  <div class="corner top left"></div><div class="corner bottom left"></div><div class="corner top right"></div><div class="corner bottom right"></div>
  <div class="border top"></div><div class="border bottom"></div><div class="border left"></div><div class="border right"></div>
  <div class="content">
    <h1>Logowanie</h1>
    <?php
      if (isset($_POST['login'])) {
        if ($_SESSION['account_type']>=USER) {
          echo('<div class="positive">Dziękujemy, zostałeś zalogowany. Zaraz nastąpi przekierowanie...</div>');
          if ($komunikat_logowania=='') RedirectJavaScript(GetAfterLoginRedirect(), 0);
        } else {
          DisplayFormLogin(false);
        }
      } else {
        if ($_SESSION['account_type']>=USER) echo('<div class="positive">Jesteś już zalogowany. Jeśli chcesz, możesz zalogować się teraz na inne konto.</div>');
        DisplayFormLogin(false);
      }

      if (!empty($_SESSION['login_requires_turnstile'])) {
        echo('<div class="uwaga">Wykryliśmy kilka nieudanych prób logowania. Wymagane jest dodatkowe potwierdzenie antybotowe.</div>');
        echo('<div id="login_turnstile_holder">'.TurnstileService::widgetHtml().'</div>');
        if (getenv('CLOUDFLARE_TURNSTILE_SITE_KEY')) {
          echo('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>');
          echo('<script>(function(){var h=document.getElementById("login_turnstile_holder");var f=document.querySelector("form[name=login_form2]")||document.querySelector("form[action*=login]");if(h&&f){f.appendChild(h);}})();</script>');
        }
      }
    ?>
  </div>
</div>

<?php include_once($footer); ?>