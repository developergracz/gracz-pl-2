<?php include("variables_local.php"); include_once($header); ?>
<div class="box light"><div class="content">
<h1>Weryfikacja dwuetapowa</h1>
<?php
try {
    if (empty($_SESSION['initiated']) || empty($_SESSION['id'])) {
        http_response_code(401);
        throw new RuntimeException('Najpierw się zaloguj.');
    }
    $role = RbacService::currentRole($database_handle, $database_prefix);
    if (!TwoFactorService::roleRequires2fa($role)) {
        http_response_code(403);
        throw new RuntimeException('Ta strona jest przeznaczona dla moderatorów i administratorów.');
    }

    $table = $database_prefix.'_two_factor';
    $stmt = $database_handle->prepare("SELECT method, secret_ciphertext, verified_at FROM {$table} WHERE user_id=:uid AND method='totp' LIMIT 1");
    $stmt->execute(array(':uid'=>(int)$_SESSION['id']));
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        SecurityService::verifyStateChangingRequest();
        GraczRateLimiter()->enforce('staff-2fa-user', (string)$_SESSION['id'], 10, 600);
        $code = isset($_POST['totp_code']) ? $_POST['totp_code'] : '';

        if ($existing) {
            $secret = DataProtectionService::decrypt($existing['secret_ciphertext'], 'totp:'.(int)$_SESSION['id']);
            if (!TwoFactorService::verifyTotp($secret, $code)) {
                GraczAudit()->record('auth.2fa.failed', $_SESSION['id'], array('role'=>$role), 'warning');
                throw new RuntimeException('Nieprawidłowy kod uwierzytelniający.');
            }
            $_SESSION['2fa_verified_at'] = time();
            SecurityService::rotateSessionAfterAuthentication();
            GraczAudit()->record('auth.2fa.success', $_SESSION['id'], array('role'=>$role));
            echo '<div class="positive">Weryfikacja 2FA zakończona. Możesz wejść do panelu administracyjnego.</div><a href="service_administration_panel.php">Panel administracyjny</a>';
        } else {
            if (empty($_SESSION['pending_totp_secret'])) throw new RuntimeException('Sesja konfiguracji wygasła. Odśwież stronę.');
            $secret = $_SESSION['pending_totp_secret'];
            if (!TwoFactorService::verifyTotp($secret, $code)) throw new RuntimeException('Kod nie pasuje. Sprawdź zegar telefonu i spróbuj ponownie.');
            $cipher = DataProtectionService::encrypt($secret, 'totp:'.(int)$_SESSION['id']);
            $stmt = $database_handle->prepare("INSERT INTO {$table} (user_id,method,secret_ciphertext,verified_at,created_at,updated_at) VALUES (:uid,'totp',:secret,NOW(),NOW(),NOW()) ON DUPLICATE KEY UPDATE secret_ciphertext=VALUES(secret_ciphertext), verified_at=NOW(), updated_at=NOW()");
            $stmt->execute(array(':uid'=>(int)$_SESSION['id'], ':secret'=>$cipher));
            unset($_SESSION['pending_totp_secret']);
            $_SESSION['2fa_verified_at'] = time();
            SecurityService::rotateSessionAfterAuthentication();
            GraczAudit()->record('auth.2fa.enrolled', $_SESSION['id'], array('role'=>$role));
            echo '<div class="positive">2FA zostało włączone. Zapisz kody odzyskiwania po wdrożeniu modułu recovery i nie udostępniaj sekretu nikomu.</div><a href="service_administration_panel.php">Panel administracyjny</a>';
        }
    } elseif ($existing) {
        echo '<p>Podaj 6-cyfrowy kod z aplikacji uwierzytelniającej.</p><form method="post">'.SecurityService::csrfInput().'<input name="totp_code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required><button type="submit">Zweryfikuj</button></form>';
    } else {
        if (empty($_SESSION['pending_totp_secret'])) $_SESSION['pending_totp_secret'] = TwoFactorService::generateSecret();
        $secret = $_SESSION['pending_totp_secret'];
        $uri = TwoFactorService::provisioningUri(isset($_SESSION['login']) ? $_SESSION['login'] : 'admin', $secret, 'Gracz.pl');
        echo '<p>Dodaj konto TOTP w aplikacji uwierzytelniającej. Sekret jest pokazany tylko podczas konfiguracji.</p>';
        echo '<p><strong>Sekret:</strong> <code>'.htmlspecialchars($secret, ENT_QUOTES, 'UTF-8').'</code></p>';
        echo '<p><small>'.htmlspecialchars($uri, ENT_QUOTES, 'UTF-8').'</small></p>';
        echo '<form method="post">'.SecurityService::csrfInput().'<label>Kod z aplikacji: <input name="totp_code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><button type="submit">Włącz 2FA</button></form>';
    }
} catch (Exception $e) {
    echo '<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>';
}
?>
</div></div>
<?php include_once($footer); ?>