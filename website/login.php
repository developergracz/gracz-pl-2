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
            if ($komunikat_logowania=='')
            {
              RedirectJavaScript(GetAfterLoginRedirect(), 0);
            }
          }else
            DisplayFormLogin(false);
        }else
        { // if browser didn't send login data
          // if user is already logged (and he call login page)
          if ($_SESSION['account_type']>=USER)
            echo('<div class="positive">Jesteś już zalogowany. Jeśli chcesz, możesz zalogować się teraz na inne konto.</div>');
          DisplayFormLogin(false);

        }
      ?>

    </div>
  </div>

<?php include_once($footer); ?>