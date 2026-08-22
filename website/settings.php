<?php include("variables_local.php"); include_once($header); ?>

<div class="box light">
  <div class="corner top left"></div><div class="corner bottom left"></div>
  <div class="corner top right"></div><div class="corner bottom right"></div>
  <div class="border top"></div><div class="border bottom"></div>
  <div class="border left"></div><div class="border right"></div>
  <div class="content">
<?php
function settings_e($v) { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function settings_password_ok($plain, $stored)
{
  global $seed_private;
  if (is_string($stored) && strlen($stored) === 40 && ctype_xdigit($stored))
    return hash_equals(strtolower($stored), sha1($seed_private.(string)$plain));
  return is_string($stored) && password_verify((string)$plain, $stored);
}

if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < USER) {
  echo('<div class="warning">Zaloguj się aby zmienić ustawienia profilu.</div>');
} else {
  $message = '';

  if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['buttonChangePassword'])) {
    try {
      if (!isset($_POST['token']) || !hash_equals((string)$_SESSION['token'], (string)$_POST['token']))
        throw new Exception('Nieprawidłowy token bezpieczeństwa.');
      $old = isset($_POST['password_old']) ? (string)$_POST['password_old'] : '';
      $new = isset($_POST['password_new']) ? (string)$_POST['password_new'] : '';
      $confirm = isset($_POST['password_new_confirm']) ? (string)$_POST['password_new_confirm'] : '';
      if (mb_strlen($new, 'UTF-8') < 15) throw new Exception('Nowe hasło musi mieć co najmniej 15 znaków.');
      if (!hash_equals($new, $confirm)) throw new Exception('Nowe hasła nie są identyczne.');

      $stmt = $database_handle->prepare('SELECT password FROM '.$database_prefix.'_users WHERE id = :id LIMIT 1');
      $stmt->execute(array(':id' => intval($_SESSION['id'])));
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      if (!$row || !settings_password_ok($old, $row['password'])) throw new Exception('Aktualne hasło jest nieprawidłowe.');

      $newHash = password_hash($new, PASSWORD_DEFAULT);
      if ($newHash === false) throw new Exception('Nie udało się zabezpieczyć nowego hasła.');
      $stmt = $database_handle->prepare('UPDATE '.$database_prefix.'_users SET password = :password WHERE id = :id LIMIT 1');
      $stmt->execute(array(':password' => $newHash, ':id' => intval($_SESSION['id'])));
      Logout();
      echo('<div class="positive">Hasło zostało zmienione. Zaloguj się ponownie.</div>');
      echo('<a href="'.settings_e($path['login']).'" class="button_normal">Zaloguj się</a>');
      include_once($footer);
      exit();
    } catch (Exception $e) {
      $message = '<div class="negative">'.settings_e($e->getMessage()).'</div>';
    }
  }

  if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['buttonSaveAccountInformation'])) {
    try {
      if (!isset($_POST['token']) || !hash_equals((string)$_SESSION['token'], (string)$_POST['token']))
        throw new Exception('Nieprawidłowy token bezpieczeństwa.');
      $email = trim(isset($_POST['email']) ? (string)$_POST['email'] : '');
      $name = trim(isset($_POST['name']) ? (string)$_POST['name'] : '');
      $surname = trim(isset($_POST['surname']) ? (string)$_POST['surname'] : '');
      $sex = intval(isset($_POST['sex']) ? $_POST['sex'] : 0);
      $password = isset($_POST['password']) ? (string)$_POST['password'] : '';
      if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) throw new Exception('Nieprawidłowy adres e-mail.');
      if (!in_array($sex, array(SEX_FEMALE, SEX_MALE), true)) throw new Exception('Nieprawidłowa wartość pola płeć.');
      if (mb_strlen($name, 'UTF-8') > 100 || mb_strlen($surname, 'UTF-8') > 100) throw new Exception('Imię lub nazwisko jest zbyt długie.');

      $stmt = $database_handle->prepare('SELECT password, email FROM '.$database_prefix.'_users WHERE id = :id LIMIT 1');
      $stmt->execute(array(':id' => intval($_SESSION['id'])));
      $current = $stmt->fetch(PDO::FETCH_ASSOC);
      if (!$current || !settings_password_ok($password, $current['password'])) throw new Exception('Aktualne hasło jest nieprawidłowe.');

      $database_handle->beginTransaction();
      $stmt = $database_handle->prepare('UPDATE '.$database_prefix.'_users SET name = :name, surname = :surname, sex = :sex WHERE id = :id');
      $stmt->execute(array(':name'=>$name, ':surname'=>$surname, ':sex'=>$sex, ':id'=>intval($_SESSION['id'])));

      $emailChanged = !hash_equals((string)$current['email'], $email);
      if ($emailChanged) {
        $stmt = $database_handle->prepare('SELECT id FROM '.$database_prefix.'_users WHERE email = :email AND id <> :id LIMIT 1');
        $stmt->execute(array(':email'=>$email, ':id'=>intval($_SESSION['id'])));
        if ($stmt->fetch(PDO::FETCH_ASSOC)) throw new Exception('Ten adres e-mail jest już używany przez inne konto.');
        $stmt = $database_handle->prepare('UPDATE '.$database_prefix.'_users SET new_email = :email, active = 0 WHERE id = :id');
        $stmt->execute(array(':email'=>$email, ':id'=>intval($_SESSION['id'])));
      }
      $database_handle->commit();
      $_SESSION['profile'] = GetAccountDetails($_SESSION['id']);
      $message = '<div class="positive">Pomyślnie zapisano ustawienia profilu.</div>';
      if ($emailChanged) {
        SendActivateMailToUserWithId($_SESSION['id']);
        $message .= '<div class="warning">Adres e-mail został zmieniony. Sprawdź pocztę i aktywuj nowy adres.</div>';
      }
    } catch (Exception $e) {
      if ($database_handle->inTransaction()) $database_handle->rollBack();
      $message = '<div class="negative">'.settings_e($e->getMessage()).'</div>';
    }
  }

  echo('<h1>Ustawienia konta</h1>'.$message);
  $profile = isset($_SESSION['profile']) && is_array($_SESSION['profile']) ? $_SESSION['profile'] : array();
?>
  <form id="FormChangePassword" method="post" autocomplete="on">
    <h2>Zmiana hasła</h2>
    <input type="hidden" name="token" value="<?php echo settings_e($_SESSION['token']); ?>" />
    <label for="password_old">Aktualne hasło:</label><br />
    <input type="password" name="password_old" id="password_old" autocomplete="current-password" required /><br /><br />
    <label for="password_new">Nowe hasło (min. 15 znaków):</label><br />
    <input type="password" name="password_new" id="password_new" minlength="15" maxlength="1024" autocomplete="new-password" required /><br /><br />
    <label for="password_new_confirm">Potwierdź nowe hasło:</label><br />
    <input type="password" name="password_new_confirm" id="password_new_confirm" minlength="15" maxlength="1024" autocomplete="new-password" required /><br /><br />
    <button type="submit" name="buttonChangePassword">Zmień hasło</button>
  </form>

  <form method="post" class="uniform_labels editProfile" autocomplete="on">
    <h2>Dane profilu</h2>
    <input type="hidden" name="token" value="<?php echo settings_e($_SESSION['token']); ?>" />
    <label for="email">E-mail:</label>
    <input type="email" name="email" id="email" maxlength="254" value="<?php echo settings_e(isset($profile['email'])?$profile['email']:''); ?>" required /><br /><br />
    <label for="password">Aktualne hasło:</label>
    <input type="password" name="password" id="password" autocomplete="current-password" required /><br /><br />
    <label for="name">Imię:</label>
    <input type="text" name="name" id="name" maxlength="100" value="<?php echo settings_e(isset($profile['name'])?$profile['name']:''); ?>" /><br /><br />
    <label for="surname">Nazwisko:</label>
    <input type="text" name="surname" id="surname" maxlength="100" value="<?php echo settings_e(isset($profile['surname'])?$profile['surname']:''); ?>" /><br /><br />
    <label for="sex">Płeć:</label>
    <select name="sex" id="sex">
      <option value="<?php echo SEX_FEMALE; ?>" <?php echo (isset($profile['sex']) && intval($profile['sex'])===SEX_FEMALE)?'selected="selected"':''; ?>>kobieta</option>
      <option value="<?php echo SEX_MALE; ?>" <?php echo (isset($profile['sex']) && intval($profile['sex'])===SEX_MALE)?'selected="selected"':''; ?>>mężczyzna</option>
    </select><br /><br />
    <button type="submit" name="buttonSaveAccountInformation">Zapisz wszystko</button>
  </form>
<?php } ?>
  </div>
</div>
<?php include_once($footer); ?>
