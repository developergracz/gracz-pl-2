<?php include("variables_local.php"); include_once($header); ?>
<div class="box light"><div class="content">
<h1>Newsletter Gracz.pl</h1>
<?php
try {
    $newsletter = GraczNewsletter();
    $action = isset($_GET['action']) ? (string)$_GET['action'] : '';
    $token = isset($_GET['token']) ? (string)$_GET['token'] : '';

    if ($action === 'confirm' && $token !== '') {
        GraczRateLimiter()->enforce('newsletter-confirm-ip', SecurityService::clientIp(), 30, 3600);
        $ok = $newsletter->consume($token, 'newsletter_check');
        GraczAudit()->record($ok ? 'newsletter.confirmed' : 'newsletter.confirm_failed', null, array(), $ok ? 'info' : 'warning');
        echo $ok ? '<div class="positive">Adres został potwierdzony.</div>' : '<div class="negative">Link jest nieprawidłowy, wykorzystany lub wygasł.</div>';
    } elseif ($action === 'unsubscribe' && $token !== '') {
        GraczRateLimiter()->enforce('newsletter-unsubscribe-ip', SecurityService::clientIp(), 30, 3600);
        $ok = $newsletter->consume($token, 'newsletter_unsubscribe');
        GraczAudit()->record($ok ? 'newsletter.unsubscribed' : 'newsletter.unsubscribe_failed', null, array(), $ok ? 'info' : 'warning');
        echo $ok ? '<div class="positive">Adres został wypisany z newslettera.</div>' : '<div class="negative">Link jest nieprawidłowy, wykorzystany lub wygasł.</div>';
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['newsletter_email'])) {
        SecurityService::verifyStateChangingRequest();
        TurnstileService::verifyRequest();
        $email = SecurityService::validateEmail($_POST['newsletter_email']);
        $limiter = GraczRateLimiter();
        $limiter->enforce('newsletter-signup-ip', SecurityService::clientIp(), 5, 3600);
        $limiter->enforce('newsletter-signup-email', hash('sha256', $email), 3, 86400);

        $confirmToken = $newsletter->subscribe($email);
        $unsubscribeToken = $newsletter->issueUnsubscribeToken($email);
        $base = rtrim($service_base_address, '/').'/newsletter.php';
        $confirmUrl = $base.'?action=confirm&token='.rawurlencode($confirmToken);
        $unsubscribeUrl = $base.'?action=unsubscribe&token='.rawurlencode($unsubscribeToken);
        SecureMailService::send($email, 'Potwierdź zapis do newslettera Gracz.pl',
            "Potwierdź zapis:\n".$confirmUrl."\n\nJeżeli to nie Ty, możesz anulować zapis:\n".$unsubscribeUrl);
        GraczAudit()->record('newsletter.signup_requested', null, array('email_hash'=>hash('sha256',$email)));
        echo '<div class="positive">Sprawdź skrzynkę e-mail i potwierdź zapis.</div>';
    } else {
        ?>
        <form method="post" action="newsletter.php" autocomplete="off">
          <?php echo SecurityService::csrfInput(); ?>
          <label for="newsletter_email">E-mail:</label>
          <input type="email" id="newsletter_email" name="newsletter_email" maxlength="254" required>
          <?php echo TurnstileService::widgetHtml(); ?>
          <button type="submit">Zapisz mnie</button>
        </form>
        <?php if (getenv('CLOUDFLARE_TURNSTILE_SITE_KEY')) { ?><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><?php }
    }
} catch (Exception $e) {
    GraczAudit()->record('newsletter.error', null, array('type'=>get_class($e)), 'warning');
    echo '<div class="negative">Nie można teraz wykonać tej operacji. Spróbuj ponownie później.</div>';
}
?>
</div></div>
<?php include_once($footer); ?>