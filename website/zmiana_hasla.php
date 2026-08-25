<?php include("variables_local.php"); include_once($header); ?>

<?php
function ChangeLegacyPasswordSecure($userId, $oldPassword, $newPassword, $confirmPassword, $token)
{
  global $database_handle, $database_prefix;

  if ($_SESSION['account_type'] < USER || intval($userId) !== intval($_SESSION['id'])) {
    throw new ExceptionAccessDenied();
  }
  if (!IsTokenValid($token)) {
    throw new ExceptionAccessDenied('Nieprawidłowy token bezpieczeństwa. Odśwież stronę i spróbuj ponownie.');
  }

  $oldPassword = (string)$oldPassword;
  $newPassword = (string)$newPassword;
  $confirmPassword = (string)$confirmPassword;

  if ($oldPassword === '' || $newPassword === '' || $confirmPassword === '') {
    throw new ExceptionPasswordTooShort('Wszystkie pola hasła są wymagane.');
  }
  if (!hash_equals($newPassword, $confirmPassword)) {
    throw new ExceptionPasswordsDoesntMatch();
  }
  if (mb_strlen($newPassword, 'UTF-8') < 15) {
    throw new ExceptionPasswordTooShort('Nowe hasło musi mieć co najmniej 15 znaków.');
  }
  if (hash_equals($oldPassword, $newPassword)) {
    throw new ExceptionPasswordsAreIdentical('Nowe hasło musi różnić się od obecnego.');
  }

  $stmt = $database_handle->prepare(
    'SELECT password FROM '.$database_prefix.'_users WHERE id = :id LIMIT 1'
  );
  $stmt->bindValue(':id', intval($userId), PDO::PARAM_INT);
  $stmt->execute();
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$row || !VerifyLegacyOrModernPassword($row['password'], $oldPassword)) {
    throw new ExceptionInvalidPassword('Wprowadzone aktualne hasło jest nieprawidłowe.');
  }

  if (!LegacyPasswordColumnSupportsModernHash()) {
    throw new RuntimeException('Kolumna hasła w bazie jest zbyt krótka dla bezpiecznego hasha. Najpierw zastosuj migrację 2026-08-22_password_hash_upgrade.sql.');
  }

  $newHash = HashModernPassword($newPassword);
  if ($newHash === false) {
    throw new RuntimeException('Nie udało się utworzyć bezpiecznego skrótu hasła.');
  }

  $stmt = $database_handle->prepare(
    'UPDATE '.$database_prefix.'_users SET password = :new_password WHERE id = :id AND password = :old_password LIMIT 1'
  );
  $stmt->bindValue(':new_password', $newHash, PDO::PARAM_STR);
  $stmt->bindValue(':id', intval($userId), PDO::PARAM_INT);
  $stmt->bindValue(':old_password', $row['password'], PDO::PARAM_STR);
  $stmt->execute();

  if ($stmt->rowCount() !== 1) {
    throw new ExceptionSQL();
  }

  DailyAdd('Zmieniono hasło konta '.intval($userId).' i zapisano nowoczesny hash.', LEVEL_INF);
  Logout();
  return true;
}

echo('<div class="panel_lewy">');
WyswietlLewyPanel(isset($_SESSION['account_type']) ? $_SESSION['account_type'] : 0);
echo('</div>');

if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < USER)
{
  echo('<div class="tresc"><div class="uwaga">Nie zalogowałeś się do tej pory. Jedynie zalogowani użytkownicy mają dostęp do tej strony.</div></div>');
}
else
{
  echo('<div class="tresc"><h1>Zmiana Twojego hasła</h1><h4>Poniższy formularz pozwoli Ci zmienić hasło Twojego konta.</h4>');

  if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['nowe_password_OK']))
  {
    try
    {
      ChangeLegacyPasswordSecure(
        $_SESSION['id'],
        isset($_POST['old_password']) ? $_POST['old_password'] : '',
        isset($_POST['new_password']) ? $_POST['new_password'] : '',
        isset($_POST['new_password_confirm']) ? $_POST['new_password_confirm'] : '',
        isset($_POST['token']) ? $_POST['token'] : ''
      );
      echo('<div class="positive">Gratulacje, zmiana hasła powiodła się.</div>');
      RedirectJavaScript($service_base_address, 1);
    } catch(Exception $e) {
      echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
    }
  }

  echo('
  <form action="" method="post" class="formularz_wyrownany" autocomplete="on">
    <fieldset>
      <input type="hidden" name="token" value="'.htmlspecialchars($_SESSION['token'], ENT_QUOTES, 'UTF-8').'" />
      <label for="old_password">Stare hasło: </label>
      <input type="password" name="old_password" id="old_password" autocomplete="current-password" required /><br />
      <label for="new_password">Nowe hasło: <br /><small>Powinno mieć przynajmniej 15 znaków.</small></label>
      <input type="password" name="new_password" id="new_password" minlength="15" maxlength="1024" autocomplete="new-password" required /><br />
      <label for="new_password_confirm">Powtórz nowe hasło: </label>
      <input type="password" name="new_password_confirm" id="new_password_confirm" minlength="15" maxlength="1024" autocomplete="new-password" required /><br />
      <input type="submit" name="nowe_password_OK" value="Zmień hasło" />
    </fieldset>
  </form>
  </div>');
}
?>

<?php include_once($footer); ?>