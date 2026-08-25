<?php include("variables_local.php"); include_once($header); ?>

  <div class="box light login">
    <div class="corner top left"></div>
    <div class="corner bottom left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom right"></div>
    <div class="border top"></div>
    <div class="border bottom"></div>
    <div class="border left"></div>
    <div class="border right"></div>
    <div class="content">
      <h1>Logowanie</h1>

      <?php
        if (isset($_POST['login']))
        {
          if ($_SESSION['account_type']>=USER)
          {
            echo('<div class="positive">Dziękujemy, zostałeś zalogowany. Zaraz nastąpi przekierowanie...</div>');
            if ($komunikat_logowania=='') RedirectJavaScript(GetAfterLoginRedirect(), 0);
          }else {
            if ($komunikat_logowania != '') echo('<div class="negative">'.htmlspecialchars((string)$komunikat_logowania, ENT_QUOTES, 'UTF-8').'</div>');
            DisplayFormLogin(false);
          }
        }else
        {
          if ($_SESSION['account_type']>=USER)
            echo('<div class="positive">Jesteś już zalogowany. Jeśli chcesz, możesz zalogować się teraz na inne konto.</div>');
          DisplayFormLogin(false);
        }

        // Starszy formularz jest generowany w library_main.php. Dołączamy zabezpieczenia centralnie
        // i przenosimy je skryptem do formularza bez przepisywania całego legacy UI.
        echo('<div id="security_login_fields" style="margin-top:12px;">'.CsrfField().TurnstileWidget().'</div>');
      ?>
      <script type="text/javascript">
      (function(){
        var holder = document.getElementById('security_login_fields');
        var form = document.querySelector('.login form') || document.querySelector('form');
        if (holder && form) form.appendChild(holder);
      })();
      </script>

    </div>
  </div>

<?php include_once($footer); ?>