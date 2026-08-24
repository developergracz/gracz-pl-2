<?php include("variables_local.php"); include_once($header); ?>

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

        if (isset($_POST['buttonRegister']))
        {
          try {
            RequireCsrf();
            SecurityRequireRateLimit('register_ip', 5, 3600, 3600);
            $emailForLimit = strtolower(trim(isset($_POST['email']) ? $_POST['email'] : ''));
            SecurityRequireRateLimit('register_email', 3, 86400, 86400, $emailForLimit);

            if (!VerifyTurnstile()) throw new RuntimeException('Nie udało się potwierdzić, że formularz wypełnia człowiek. Spróbuj ponownie.');
            if (empty($_POST['register_accept_terms'])) throw new RuntimeException('Aby utworzyć konto, musisz zaakceptować regulamin i politykę prywatności.');

            $passwordCheck = SecurityValidatePassword(isset($_POST['password']) ? $_POST['password'] : '');
            if ($passwordCheck !== true) throw new RuntimeException($passwordCheck);

            CreateAccount($_POST['login'], $_POST['email'], $_POST['password'], $_POST['password_confirmation'], $_POST['sex']);
            // Stary CreateAccount zapisuje historyczny hash. Natychmiast zastępujemy go password_hash().
            if (!SecuritySetModernPasswordForIdentity($_POST['email'], $_POST['password'])) {
              throw new RuntimeException('Konto utworzono, ale nie udało się zakończyć bezpiecznego zapisu hasła. Skontaktuj się z administratorem.');
            }
            AuditLog('account.registered', 'account', strtolower(trim($_POST['login'])));
            echo('<div class="positive"><img src="'.$directory['design'].'icon_letter.png" alt="" width="16" />&nbsp;&nbsp;Twoje konto zostało utworzone. Na podany adres e-mail został wysłany link aktywujący konto - prosimy o jego kliknięcie aby dokończyć proces rejestracji.</div><br /><br /><a href="'.$directory['base'].'index.php">Strona główna</a>');
            $account_created = true;
          }catch(Exception $e){
            AuditLog('account.registration_failed', 'account', isset($_POST['login']) ? strtolower(trim($_POST['login'])) : null, array('reason'=>$e->getMessage()));
            echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
          }
        }

        $default_login = isset($_POST['login']) ? trim(htmlspecialchars($_POST['login'], ENT_QUOTES, 'UTF-8')) : '';
        if ($default_login=='') $default_login = 'Wpisz login';
        $default_email = isset($_POST['email']) ? trim(htmlspecialchars($_POST['email'], ENT_QUOTES, 'UTF-8')) : '';
        if ($default_email=='') $default_email = 'twój@e-mail.pl';
        $default_sex = isset($_POST['sex']) ? intval($_POST['sex']) : 0;
        if ($default_sex == 0) $default_sex = SEX_MALE;

        if (!$account_created)
        {
      ?>

      <form action="#" method="post" class="uniform_labels validate register" autocomplete="off">
      <fieldset>
        <?php echo CsrfField(); ?>
        <p>
          <label for="register_email">E-mail:</label>
          <input type="email" name="email" id="register_email" value="<?php echo($default_email); ?>" data-validation="email" maxlength="254" autocomplete="email" required />
        </p>
        <p>
          <label for="register_login">Login:</label>
          <input type="text" name="login" id="register_login" value="<?php echo($default_login); ?>" data-validation="alphanumeric length" data-validation-allowing="_" data-validation-length="min4" data-validation-error-msg="Login musi mieć przynajmniej 4 znaki i składać się z liter, cyfr lub znaku podkreślenia." maxlength="32" autocomplete="username" required />
        </p>
        <p>
          <label for="register_password">Hasło:</label>
          <input name="password" id="register_password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required>
          <small>Minimum 12 znaków, mała i wielka litera oraz cyfra.</small>
          <br />
          <label for="register_password_confirm">Potwierdź hasło:</label>
          <input name="password_confirmation" type="password" id="register_password_confirm" minlength="12" maxlength="128" autocomplete="new-password" required>
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
          <input type="checkbox" name="register_accept_terms" id="register_accept_terms" value="1" required />
          <label for="register_accept_terms">Akceptuję warunki <strong><a href="<?php echo($path['terms_of_service']); ?>" target="_blank" rel="noopener">regulaminu</a></strong> oraz <strong><a href="<?php echo($path['privacy_policy']); ?>" target="_blank" rel="noopener">politykę prywatności</a></strong>.</label>
        </p>

        <?php echo TurnstileWidget(); ?>
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