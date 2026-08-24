<?php include("variables_local.php"); include_once($header); ?>

  <div class="box light">
    <div class="corner top left"></div>
    <div class="corner bottom left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom right"></div>
    <div class="border top"></div>
    <div class="border bottom"></div>
    <div class="border left"></div>
    <div class="border right"></div>
    <div class="content">
      <h1>Przypomnij hasło</h1>
      <?php
      if (isset($_GET['id_account']) && isset($_GET['activation_code']))
      {
        SecurityRequireRateLimit('password_reset_activate', 10, 3600, 3600);
        if(AccountActivateGeneratedPassword($_GET['id_account'], $_GET['activation_code']))
        {
          AuditLog('password.reset_completed', 'user', intval($_GET['id_account']));
          echo('<div class="positive">Hasło zostało zmienione. Dla bezpieczeństwa zaloguj się ponownie i ustaw własne, unikalne hasło.</div>');
        }else
        {
          AuditLog('password.reset_activation_failed', 'user', intval($_GET['id_account']));
          echo('<div class="negative">Link jest nieprawidłowy lub wygasł.</div>');
        }
      }

      if (isset($_POST['email']))
      {
        try {
          RequireCsrf();
          SecurityRequireRateLimit('password_reset_ip', 5, 3600, 3600);
          $normalizedEmail = strtolower(trim($_POST['email']));
          SecurityRequireRateLimit('password_reset_email', 3, 3600, 3600, $normalizedEmail);
          if (!VerifyTurnstile()) throw new RuntimeException('Nie udało się potwierdzić weryfikacji bezpieczeństwa.');

          // Zawsze ta sama odpowiedź, aby nie ujawniać, czy adres znajduje się w bazie.
          @AccountSendNewGeneratedPassword($normalizedEmail);
          AuditLog('password.reset_requested', 'account', SecurityHashIdentifier($normalizedEmail));
          echo('<div class="positive">Jeżeli podany adres jest przypisany do konta, wysłaliśmy wiadomość z dalszymi instrukcjami.</div>');
        } catch (Exception $e) {
          AuditLog('password.reset_request_blocked', 'account', null, array('reason'=>$e->getMessage()));
          echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
        }
      }else if (!isset($_REQUEST['activation_code']))
      {
        echo('<p>Wpisz adres e-mail przypisany do konta. Ze względów bezpieczeństwa nie informujemy, czy dany adres znajduje się w bazie.</p>');
        echo('<form action="" method="post" autocomplete="off"><div>'.CsrfField().'
          <label for="email">Adres e-mail:</label>
          <input type="email" name="email" id="email" maxlength="254" autocomplete="email" required />'.TurnstileWidget().'
          <button type="submit">Wyślij instrukcje</button>
        </div></form>');
      }
      ?>

    </div>
  </div>

<?php include_once($footer); ?>