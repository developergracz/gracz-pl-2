<?php include("variables_local.php"); include_once($header); ?>

<?php
function CreateAccountSecureLegacy($login, $email, $password, $password_confirm, $sex, $token, $accept_terms)
{
  global $database_handle, $database_prefix;

  if (!IsTokenValid($token)) {
    throw new ExceptionAccessDenied('Nieprawidłowy token bezpieczeństwa. Odśwież stronę i spróbuj ponownie.');
  }

  $login = trim((string)$login);
  $email = trim((string)$email);
  $password = (string)$password;
  $password_confirm = (string)$password_confirm;
  $sex = intval($sex);

  if (!$accept_terms) {
    throw new ExceptionInvalidData('Musisz zaakceptować regulamin i politykę prywatności.');
  }
  if ($password === '' || $password_confirm === '') {
    throw new ExceptionPasswordCantBeEmpty();
  }
  if (!hash_equals($password, $password_confirm)) {
    throw new ExceptionPasswordsDoesntMatch();
  }
  if (mb_strlen($password, 'UTF-8') < 15) {
    throw new ExceptionPasswordTooShort('Hasło musi mieć co najmniej 15 znaków.');
  }
  if ($login === '') {
    throw new ExceptionLoginCantBeEmpty();
  }
  if (!preg_match('/^[a-z0-9ąęśćżźółń_]{4,32}$/iu', $login)) {
    throw new ExceptionLoginFormatInvalid();
  }
  if ($email === '') {
    throw new ExceptionEmailCantBeEmpty();
  }
  if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
    throw new ExceptionEmailFormatInvalid();
  }
  if (!in_array($sex, array(SEX_FEMALE, SEX_MALE), true)) {
    throw new ExceptionInvalidData();
  }

  if (!LegacyPasswordColumnSupportsModernHash()) {
    throw new RuntimeException('Rejestracja jest chwilowo wstrzymana do czasu zastosowania bezpiecznej migracji kolumny hasła.');
  }

  $password_hash = HashModernPassword($password);
  if ($password_hash === false) {
    throw new RuntimeException('Nie udało się utworzyć bezpiecznego skrótu hasła.');
  }

  $activation_code = random_int(100000000, 2147483647);

  $query = 'INSERT INTO '.$database_prefix.'_users
              (login, password, email, active, sex, IP, date_register, activation_code)
            VALUES
              (:login, :password, :email, 0, :sex, :ip, CURRENT_TIMESTAMP(), :activation_code)';

  try {
    $stmt = $database_handle->prepare($query);
    $stmt->bindValue(':login', $login, PDO::PARAM_STR);
    $stmt->bindValue(':password', $password_hash, PDO::PARAM_STR);
    $stmt->bindValue(':email', $email, PDO::PARAM_STR);
    $stmt->bindValue(':sex', $sex, PDO::PARAM_INT);
    $stmt->bindValue(':ip', isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '', PDO::PARAM_STR);
    $stmt->bindValue(':activation_code', $activation_code, PDO::PARAM_INT);
    $stmt->execute();
  } catch (PDOException $e) {
    if ($e->getCode() === '23000') {
      throw new ExceptionEmailAlreadyExists();
    }
    throw new ExceptionSQL();
  }

  $new_user_id = intval($database_handle->lastInsertId());
  if ($new_user_id <= 0) {
    throw new ExceptionSQL();
  }

  SendActivateMailToUserWithId($new_user_id);
  return true;
}
?>

  <div class="box light" id="window_register">
    <div class="corner top left"></div>
    <div class="corner bottom left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom right"></div>
    <div class="border top"></div>
    <div class="border bottom"></div>
    <div class="border left"></div>
    <div class="border right"></div>
    <div class="content">

      <h1>Rejestracja</h1>

      <?php
        $account_created = false;

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['buttonRegister']))
        {
          try {
            CreateAccountSecureLegacy(
              isset($_POST['login']) ? $_POST['login'] : '',
              isset($_POST['email']) ? $_POST['email'] : '',
              isset($_POST['password']) ? $_POST['password'] : '',
              isset($_POST['password_confirmation']) ? $_POST['password_confirmation'] : '',
              isset($_POST['sex']) ? $_POST['sex'] : 0,
              isset($_POST['token']) ? $_POST['token'] : '',
              isset($_POST['register_accept_terms'])
            );
            echo('<div class="positive"><img src="'.$directory['design'].'icon_letter.png" alt="" width="16" />&nbsp;&nbsp;Twoje konto zostało utworzone. Na podany adres e-mail został wysłany link aktywujący konto - prosimy o jego kliknięcie aby dokończyć proces rejestracji.</div><br /><br /><a href="'.$directory['base'].'index.php">Strona główna</a>');
            $account_created = true;
          }catch(Exception $e){
            echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
          }
        }
      ?>

      <?php
        $default_login = isset($_POST['login']) ? trim(htmlspecialchars($_POST['login'], ENT_QUOTES, 'UTF-8')) : '';
        if ($default_login=='') $default_login = 'Wpisz login';
        $default_email = isset($_POST['email']) ? trim(htmlspecialchars($_POST['email'], ENT_QUOTES, 'UTF-8')) : '';
        if ($default_email=='') $default_email = 'twój@e-mail.pl';
        $default_sex = isset($_POST['sex']) ? intval($_POST['sex']) : SEX_MALE;
        if ($default_sex == 0) $default_sex = SEX_MALE;

        if (!$account_created)
        {
      ?>

      <form action="#" method="post" class="uniform_labels validate register" autocomplete="on">
      <fieldset>
        <input type="hidden" name="token" value="<?php echo(htmlspecialchars($_SESSION['token'], ENT_QUOTES, 'UTF-8')); ?>" />
        <p>
          <label for="register_email">E-mail:</label>
          <input type="email" name="email" id="register_email" value="<?php echo($default_email); ?>" maxlength="254" autocomplete="email" data-validation="email" />
        </p>
        <p>
          <label for="register_login">Login:</label>
          <input type="text" name="login" id="register_login" value="<?php echo($default_login); ?>" minlength="4" maxlength="32" autocomplete="username" data-validation="alphanumeric length" data-validation-allowing="_" data-validation-length="4-32" data-validation-error-msg="Login musi mieć 4-32 znaki i składać się z liter, cyfr lub znaku podkreślenia." />
        </p>
        <p>
          <label for="register_password_confirm">Hasło:</label>
          <input name="password_confirmation" id="register_password_confirm" type="password" minlength="15" maxlength="1024" autocomplete="new-password" data-validation="length" data-validation-length="min15">

          <br />
          <label for="register_password">Potwierdź hasło:</label>
          <input name="password" type="password" id="register_password" minlength="15" maxlength="1024" autocomplete="new-password" data-validation="confirmation" data-validation-strength="1">
        </p>
        <p>
          <label for="register_sex">Płeć:</label>
          <span id="register_sex">
            <input type="radio" id="radio_sex_female" name="sex" value="<?php echo(SEX_FEMALE); ?>" <?php echo($default_sex==SEX_FEMALE?'checked="checked"':''); ?>>
            <label for="radio_sex_female"><img src="<?=$directory['design']; ?>icon_female.png" alt="F" height="20" /><span>Kobieta</span></label>
            <input type="radio" id="radio_sex_male" name="sex" value="<?php echo(SEX_MALE); ?>" <?php echo($default_sex==SEX_MALE?'checked="checked"':''); ?>>
            <label for="radio_sex_male"><img src="<?=$directory['design']; ?>icon_male.png" alt="M" height="20" /><span>Mężczyzna</span></label>
          </span>
        </p>

        <p>
          <input type="checkbox" name="register_accept_terms" id="register_accept_terms" required />
          <label for="register_accept_terms">Akceptuję warunki <strong><a href="<?php echo($path['terms_of_service']); ?>" target="_blank" rel="noopener">regulaminu</a></strong> oraz zgadzam się z <strong><a href="<?php echo($path['privacy_policy']); ?>" target="_blank" rel="noopener">polityką prywatności</a></strong>.</label>
        </p>

        <button type="submit" name="buttonRegister">Zarejestruj</button>
        </fieldset>
      </form>

      <script type="text/javascript">
      jQuery(document).ready(function (){
        jQuery("#register_sex").buttonset();
      });
      </script>

      <?php
      }
      ?>

    </div>
  </div>

<?php include_once($footer); ?>