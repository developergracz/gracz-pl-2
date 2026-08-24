<?php include("variables_local.php"); include_once($header); ?>

<div class="box light"><div class="content">
  <h1>Odzyskiwanie hasła</h1>
  <?php
  try {
    if (isset($_GET['id_account'], $_GET['activation_code'])) {
      GraczRateLimiter()->enforce('password-reset-activation-ip', SecurityService::clientIp(), 20, 3600);
      if (AccountActivateGeneratedPassword(intval($_GET['id_account']), (string)$_GET['activation_code'])) {
        GraczAudit()->record('auth.password_reset.activated', intval($_GET['id_account']));
        echo('<div class="positive">Nowe hasło zostało aktywowane. Zmień je po zalogowaniu na własne, silne hasło.</div>');
      } else {
        GraczAudit()->record('auth.password_reset.activation_failed', intval($_GET['id_account']), array(), 'warning');
        echo('<div class="negative">Link jest nieprawidłowy lub wygasł.</div>');
      }
    }

    if (isset($_POST['email'])) {
      SecurityService::verifyStateChangingRequest();
      $email = SecurityService::validateEmail($_POST['email']);
      $limiter = GraczRateLimiter();
      $limiter->enforce('password-reset-ip', SecurityService::clientIp(), 5, 3600);
      $limiter->enforce('password-reset-email', hash('sha256', $email), 3, 3600);
      TurnstileService::verifyRequest();

      // Deliberately use the same response regardless of whether the account exists.
      AccountSendNewGeneratedPassword($email);
      GraczAudit()->record('auth.password_reset.requested', null, array('email_hash' => hash('sha256', $email)));
      echo('<div class="positive">Jeżeli konto z tym adresem istnieje, wysłaliśmy instrukcję odzyskania dostępu.</div>');
    } elseif (!isset($_GET['activation_code'])) {
      ?>
      <p>Podaj adres e-mail konta. Ze względów bezpieczeństwa nie informujemy, czy dany adres znajduje się w bazie.</p>
      <form action="" method="post" autocomplete="off">
        <?php echo SecurityService::csrfInput(); ?>
        <div>
          <label for="email">Adres e-mail:</label>
          <input type="email" name="email" id="email" maxlength="254" autocomplete="email" required />
          <?php echo TurnstileService::widgetHtml(); ?>
          <button type="submit">Wyślij instrukcję</button>
        </div>
      </form>
      <?php if (getenv('CLOUDFLARE_TURNSTILE_SITE_KEY')) { ?><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><?php }
    }
  } catch (Exception $e) {
    GraczAudit()->record('auth.password_reset.error', null, array('error_type' => get_class($e)), 'warning');
    echo('<div class="negative">Nie można teraz wykonać tej operacji. Spróbuj ponownie później.</div>');
  }
  ?>
</div></div>

<?php include_once($footer); ?>