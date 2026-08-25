<?php include("variables_local.php"); include_once($header); ?>
<?php
echo('<div class="panel_lewy">');
WyswietlLewyPanel($_SESSION['account_type']);
echo('</div>');

if (empty($_SESSION['initiated']) || $_SESSION['account_type'] < USER) {
  echo('<div class="tresc"><div class="uwaga">Musisz być zalogowany, aby zmienić hasło.</div></div>');
} else {
  echo('<div class="tresc"><h1>Zmiana hasła</h1>');
  if (isset($_POST['nowe_password_OK'])) {
    try {
      SecurityService::verifyStateChangingRequest();
      GraczRateLimiter()->enforce('password-change-user', (string)$_SESSION['id'], 5, 3600);
      $new = SecurityService::validatePassword(isset($_POST['new_password']) ? $_POST['new_password'] : '');
      $confirm = isset($_POST['new_password_confirm']) ? (string)$_POST['new_password_confirm'] : '';
      if (!hash_equals($new, $confirm)) throw new InvalidArgumentException('Nowe hasła nie są identyczne.');
      $old = isset($_POST['old_password']) ? (string)$_POST['old_password'] : '';
      $uid = (int)$_SESSION['id'];
      AccountChangePassword($uid, $old, $new, $confirm);
      GraczSessions()->revokeAllForUser($uid, 'password_change');
      GraczAudit()->record('auth.password.changed', $uid, array('all_sessions_revoked'=>true));
      Logout();
      SecurityService::destroySession();
      echo('<div class="positive">Hasło zostało zmienione. Wszystkie aktywne sesje tego konta zostały unieważnione. Zaloguj się ponownie.</div>');
    } catch(Exception $e) {
      GraczAudit()->record('auth.password.change_failed', isset($_SESSION['id'])?$_SESSION['id']:null, array('type'=>get_class($e)), 'warning');
      echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
    }
  } else {
    echo('<form action="" method="post" class="formularz_wyrownany" autocomplete="off"><fieldset>');
    echo SecurityService::csrfInput();
    echo('<label for="old_password">Stare hasło:</label><input type="password" name="old_password" id="old_password" autocomplete="current-password" required><br>');
    echo('<label for="new_password">Nowe hasło:<br><small>Minimum 12 znaków.</small></label><input type="password" name="new_password" id="new_password" minlength="12" maxlength="128" autocomplete="new-password" required><br>');
    echo('<label for="new_password_confirm">Powtórz nowe hasło:</label><input type="password" name="new_password_confirm" id="new_password_confirm" minlength="12" maxlength="128" autocomplete="new-password" required><br>');
    echo('<button type="submit" name="nowe_password_OK" value="1">Zmień hasło</button></fieldset></form>');
  }
  echo('</div>');
}
?>
<?php include_once($footer); ?>