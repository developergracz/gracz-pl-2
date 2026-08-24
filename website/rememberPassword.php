<?php include("variables_local.php"); include_once($header); ?>
<div class="box light"><div class="content">
<h1>Odzyskiwanie hasła</h1>
<?php
try {
    $reset = GraczPasswordReset();
    $tokenFromLink = isset($_GET['token']) ? (string)$_GET['token'] : '';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['reset_token'])) {
        SecurityService::verifyStateChangingRequest();
        GraczRateLimiter()->enforce('password-reset-consume-ip', SecurityService::clientIp(), 10, 3600);
        $token = (string)$_POST['reset_token'];
        $password = SecurityService::validatePassword(isset($_POST['new_password']) ? $_POST['new_password'] : '');
        $confirm = isset($_POST['new_password_confirm']) ? (string)$_POST['new_password_confirm'] : '';
        if (!hash_equals($password, $confirm)) throw new InvalidArgumentException('Hasła nie są identyczne.');
        $uid = $reset->consumeAndSetPassword($token, $password);
        if (!$uid) {
            GraczAudit()->record('auth.password_reset.invalid_token', null, array(), 'warning');
            echo '<div class="negative">Link resetu jest nieprawidłowy, wykorzystany lub wygasł.</div>';
        } else {
            GraczSessions()->revokeAllForUser($uid, 'password_reset');
            GraczAudit()->record('auth.password_reset.completed', $uid, array('all_sessions_revoked'=>true));
            echo '<div class="positive">Hasło zostało ustawione. Wszystkie wcześniejsze sesje konta zostały unieważnione. Możesz się zalogować.</div>';
        }
    } elseif ($tokenFromLink !== '') {
        GraczRateLimiter()->enforce('password-reset-link-ip', SecurityService::clientIp(), 20, 3600);
        $uid = $reset->validateToken($tokenFromLink);
        if (!$uid) {
            echo '<div class="negative">Link resetu jest nieprawidłowy, wykorzystany lub wygasł.</div>';
        } else {
            ?>
            <form method="post" action="rememberPassword.php" autocomplete="off">
              <?php echo SecurityService::csrfInput(); ?>
              <input type="hidden" name="reset_token" value="<?php echo htmlspecialchars($tokenFromLink, ENT_QUOTES, 'UTF-8'); ?>">
              <label for="new_password">Nowe hasło:</label>
              <input type="password" name="new_password" id="new_password" minlength="12" maxlength="128" autocomplete="new-password" required><br>
              <label for="new_password_confirm">Powtórz nowe hasło:</label>
              <input type="password" name="new_password_confirm" id="new_password_confirm" minlength="12" maxlength="128" autocomplete="new-password" required><br>
              <button type="submit">Ustaw nowe hasło</button>
            </form>
            <?php
        }
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['email'])) {
        SecurityService::verifyStateChangingRequest();
        $email = SecurityService::validateEmail($_POST['email']);
        $limiter = GraczRateLimiter();
        $limiter->enforce('password-reset-ip', SecurityService::clientIp(), 5, 3600);
        $limiter->enforce('password-reset-email', hash('sha256',$email), 3, 3600);
        TurnstileService::verifyRequest();
        $issued = $reset->request($email);
        if ($issued) {
            $url = rtrim($service_base_address,'/').'/rememberPassword.php?token='.rawurlencode($issued['token']);
            SecureMailService::send($issued['email'], 'Reset hasła Gracz.pl', "Aby ustawić nowe hasło, otwórz poniższy jednorazowy link. Link wygasa po 60 minutach:\n\n".$url."\n\nJeśli to nie Ty, zignoruj tę wiadomość.");
        }
        GraczAudit()->record('auth.password_reset.requested', null, array('email_hash'=>hash('sha256',$email)));
        echo '<div class="positive">Jeżeli konto z tym adresem istnieje, wysłaliśmy instrukcję odzyskania dostępu.</div>';
    } else {
        ?>
        <p>Podaj adres e-mail konta. Ze względów bezpieczeństwa odpowiedź jest taka sama niezależnie od tego, czy adres istnieje w bazie.</p>
        <form action="rememberPassword.php" method="post" autocomplete="off">
          <?php echo SecurityService::csrfInput(); ?>
          <label for="email">Adres e-mail:</label>
          <input type="email" name="email" id="email" maxlength="254" autocomplete="email" required>
          <?php echo TurnstileService::widgetHtml(); ?>
          <button type="submit">Wyślij link resetu</button>
        </form>
        <?php if (getenv('CLOUDFLARE_TURNSTILE_SITE_KEY')) { ?><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><?php }
    }
} catch(Exception $e) {
    GraczAudit()->record('auth.password_reset.error', null, array('error_type'=>get_class($e)), 'warning');
    echo '<div class="negative">Nie można teraz wykonać tej operacji. Spróbuj ponownie później.</div>';
}
?>
</div></div>
<?php include_once($footer); ?>