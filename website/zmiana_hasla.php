<?php include("variables_local.php"); include_once($header); ?>

<?php

  echo('\n  <div class="panel_lewy">\n  ');

    WyswietlLewyPanel($_SESSION['account_type']);

  echo('\n  </div>\n  ');

if ($_SESSION['account_type'] != USER)
{
  echo('\n  <div class="tresc">\n    <div class="uwaga">Nie zalogowałeś się do tej pory. Jedynie zalogowani użytkownicy mają dostęp do tej strony.</div>\n  </div>\n  ');
}else
{
  echo('\n  <div class="tresc">\n\n  <h1>Zmiana Twojego hasła</h1>\n  <h4>Poniższy formularz pozwoli Ci zmienić hasło Twojego konta.</h4>\n  ');

  if (isset($_POST['nowe_password_OK']))
  {
    try
    {
      RequireCsrf();
      SecurityRequireRateLimit('password_change', 5, 900, 1800, isset($_SESSION['id']) ? (string)$_SESSION['id'] : SecurityClientIp());
      $passwordValidation = SecurityValidatePassword(isset($_POST['new_password']) ? $_POST['new_password'] : '');
      if ($passwordValidation !== true) {
        throw new RuntimeException($passwordValidation);
      }
      AccountChangePassword($_SESSION['id'], $_POST['old_password'], $_POST['new_password'], $_POST['new_password_confirm']);
      if (!SecuritySetModernPasswordForIdentity($_SESSION['login'], $_POST['new_password'])) {
        throw new RuntimeException('Nie udało się zakończyć bezpiecznego zapisu nowego hasła.');
      }
      AuditLog('auth.password_changed', 'user', $_SESSION['id'], array('hash'=>'password_hash'));
      echo('<div class="positive">Gratulacje, zmiana hasła powiodła się. Zostaniesz wylogowany, aby unieważnić dotychczasową sesję.</div>');
      Logout();
      RedirectJavaScript($service_base_address, 1);
    }catch(Exception $e)
    {
      echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
    }
  }

  echo('\n  <form action="" method="post" class="formularz_wyrownany">\n    <fieldset>\n      '.CsrfField().'\n      <label for="old_password">Stare hasło: </label>\n      <input type="password" name="old_password" id="old_password" autocomplete="current-password" required /><br />\n      <label for="new_password">Nowe hasło: <br /><small>Co najmniej 12 znaków, mała i wielka litera oraz cyfra.</small></label>\n      <input type="password" name="new_password" id="new_password" autocomplete="new-password" minlength="12" maxlength="128" required /><br />\n      <label for="new_password_confirm">Powtórz nowe hasło: </label>\n      <input type="password" name="new_password_confirm" id="new_password_confirm" autocomplete="new-password" minlength="12" maxlength="128" required /><br />\n\n      <input type="submit" name="nowe_password_OK" value="Zmień hasło" />\n    </fieldset>\n  </form>\n\n  </div>\n  ');
}

?>

<?php include_once($footer); ?>