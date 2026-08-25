<?php include("variables_local.php"); include_once($header); ?>

  <div class="box light" id="window_register">
    <div class="corner top left"></div><div class="corner bottom left"></div><div class="corner top right"></div><div class="corner bottom right"></div>
    <div class="border top"></div><div class="border bottom"></div><div class="border left"></div><div class="border right"></div>
    <div class="content">
      <h1>Rejestracja</h1>
      <?php
        $account_created = false;
        if (isset($_POST['buttonRegister']))
        {
          try {
            SecurityService::verifyStateChangingRequest();
            GraczRateLimiter()->enforce('registration-ip', SecurityService::clientIp(), 5, 3600);
            TurnstileService::verifyRequest();

            $login = SecurityService::validateLogin(isset($_POST['login']) ? $_POST['login'] : '');
            $email = SecurityService::validateEmail(isset($_POST['email']) ? $_POST['email'] : '');
            $password = SecurityService::validatePassword(isset($_POST['password']) ? $_POST['password'] : '');
            $confirmation = isset($_POST['password_confirmation']) ? (string)$_POST['password_confirmation'] : '';
            if (!hash_equals($password, $confirmation)) {
              throw new InvalidArgumentException('Hasła nie są identyczne.');
            }
            if (empty($_POST['register_accept_terms'])) {
              throw new InvalidArgumentException('Musisz zaakceptować regulamin i politykę prywatności.');
            }
            $sex = isset($_POST['sex']) ? intval($_POST['sex']) : 0;
            if (!in_array($sex, array(SEX_FEMALE, SEX_MALE), true)) {
              throw new InvalidArgumentException('Nieprawidłowa wartość pola płeć.');
            }

            CreateAccount($login, $email, $password, $confirmation, $sex);
            GraczAudit()->record('account.registration.created', isset($_SESSION['id']) ? $_SESSION['id'] : null, array('login' => $login, 'email_hash' => hash('sha256', $email)));
            echo('<div class="positive"><img src="'.$directory['design'].'icon_letter.png" alt="" width="16" />&nbsp;&nbsp;Twoje konto zostało utworzone. Na podany adres e-mail został wysłany link aktywujący konto.</div><br /><br /><a href="'.$directory['base'].'index.php">Strona główna</a>');
            $account_created = true;
          }catch(Exception $e){
            echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
          }
        }

        $default_login = isset($_POST['login']) ? trim(htmlspecialchars($_POST['login'], ENT_QUOTES, 'UTF-8')) : '';
        if ($default_login=='') $default_login = 'Wpisz login';
        $default_email = isset($_POST['email']) ? trim(htmlspecialchars($_POST['email'], ENT_QUOTES, 'UTF-8')) : '';
        if ($default_email=='') $default_email = 'twój@e-mail.pl';
        $default_sex = isset($_POST['sex']) ? intval($_POST['sex']) : SEX_MALE;

        if (!$account_created) {
      ?>
      <form action="#" method="post" class="uniform_labels validate register" autocomplete="on">
      <fieldset>
        <?php echo SecurityService::csrfInput(); ?>
        <p><label for="register_email">E-mail:</label><input type="email" name="email" id="register_email" maxlength="254" autocomplete="email" value="<?php echo($default_email); ?>" required /></p>
        <p><label for="register_login">Login:</label><input type="text" name="login" id="register_login" minlength="4" maxlength="32" autocomplete="username" value="<?php echo($default_login); ?>" required /></p>
        <p>
          <label for="register_password">Hasło:</label>
          <input name="password" id="register_password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required>
          <br />
          <label for="register_password_confirm">Potwierdź hasło:</label>
          <input name="password_confirmation" id="register_password_confirm" type="password" minlength="12" maxlength="128" autocomplete="new-password" required>
          <small>Minimum 12 znaków. Nie używaj popularnego hasła ani hasła z innego serwisu.</small>
        </p>
        <p><label for="register_sex">Płeć:</label><span id="register_sex">
          <input type="radio" id="radio_sex_female" name="sex" value="<?php echo(SEX_FEMALE); ?>" <?php echo($default_sex==SEX_FEMALE?'checked="checked"':''); ?>><label for="radio_sex_female">Kobieta</label>
          <input type="radio" id="radio_sex_male" name="sex" value="<?php echo(SEX_MALE); ?>" <?php echo($default_sex==SEX_MALE?'checked="checked"':''); ?>><label for="radio_sex_male">Mężczyzna</label>
        </span></p>
        <p><input type="checkbox" name="register_accept_terms" id="register_accept_terms" value="1" required /><label for="register_accept_terms">Akceptuję <strong><a href="<?php echo($path['terms_of_service']); ?>" target="_blank" rel="noopener">regulamin</a></strong> oraz <strong><a href="<?php echo($path['privacy_policy']); ?>" target="_blank" rel="noopener">politykę prywatności</a></strong>.</label></p>
        <?php echo TurnstileService::widgetHtml(); ?>
        <button type="submit" name="buttonRegister">Zarejestruj</button>
      </fieldset>
      </form>
      <?php if (getenv('CLOUDFLARE_TURNSTILE_SITE_KEY')) { ?><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><?php } ?>
      <?php } ?>
    </div>
  </div>
<?php include_once($footer); ?>