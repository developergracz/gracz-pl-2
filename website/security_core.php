<?php
/**
 * Centralny moduł bezpieczeństwa Gracz.pl.
 * Nie przechowuj tu sekretów. Sekrety są pobierane wyłącznie ze zmiennych środowiskowych.
 */

function SecurityEnv($name, $default = null)
{
    $value = getenv($name);
    return ($value === false || $value === '') ? $default : $value;
}

function SecurityClientIp()
{
    // Ufamy CF-Connecting-IP tylko, gdy ruch przechodzi przez Cloudflare.
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return substr($_SERVER['HTTP_CF_CONNECTING_IP'], 0, 64);
    }
    return substr(isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0', 0, 64);
}

function SecurityHashIdentifier($value)
{
    $pepper = SecurityEnv('SECURITY_HASH_PEPPER', '');
    return hash_hmac('sha256', (string)$value, $pepper);
}

function SecurityRedactArray(array $data)
{
    $blocked = array('password','password_confirmation','passwd','pass','token','csrf','authorization','phpSESSID','PHPSESSID','activation_code','secret','api_key','apikey');
    $out = array();
    foreach ($data as $key => $value) {
        $lower = strtolower((string)$key);
        $sensitive = false;
        foreach ($blocked as $needle) {
            if (strpos($lower, strtolower($needle)) !== false) {
                $sensitive = true;
                break;
            }
        }
        if ($sensitive) {
            $out[$key] = '[REDACTED]';
        } elseif (is_array($value)) {
            $out[$key] = SecurityRedactArray($value);
        } else {
            $out[$key] = is_string($value) && strlen($value) > 500 ? substr($value, 0, 500).'…' : $value;
        }
    }
    return $out;
}

function SecurityApplyHeaders()
{
    if (headers_sent()) return;
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Resource-Policy: same-origin');
    header("Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; object-src 'none'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com");
    if ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || isset($_SERVER['HTTP_CF_VISITOR'])) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

function SecurityConfigureSession($domain = '')
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', '1');
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.gc_maxlifetime', '7200');

    $params = array(
        'lifetime' => 0,
        'path' => '/',
        'domain' => $domain,
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax'
    );
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params($params);
    } else {
        session_set_cookie_params(0, '/; samesite=Lax', $domain, true, true);
    }
}

function SecurityEnforceSessionLifetime()
{
    if (session_status() !== PHP_SESSION_ACTIVE) return;
    $now = time();
    $idleTtl = intval(SecurityEnv('SESSION_IDLE_TTL', 1800));
    $absoluteTtl = intval(SecurityEnv('SESSION_ABSOLUTE_TTL', 7200));

    if (!isset($_SESSION['security_created_at'])) $_SESSION['security_created_at'] = $now;
    if (!isset($_SESSION['security_last_seen'])) $_SESSION['security_last_seen'] = $now;

    if (($now - $_SESSION['security_last_seen']) > $idleTtl || ($now - $_SESSION['security_created_at']) > $absoluteTtl) {
        SecurityDestroySession();
        return;
    }
    $_SESSION['security_last_seen'] = $now;
}

function SecurityRotateSessionAfterLogin()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
        $_SESSION['security_created_at'] = time();
        $_SESSION['security_last_seen'] = time();
    }
}

function SecurityDestroySession()
{
    if (session_status() !== PHP_SESSION_ACTIVE) return;
    $_SESSION = array();
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], !empty($p['secure']), !empty($p['httponly']));
    }
    session_destroy();
}

function CsrfToken()
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function CsrfField()
{
    return '<input type="hidden" name="csrf_token" value="'.htmlspecialchars(CsrfToken(), ENT_QUOTES, 'UTF-8').'" />';
}

function SecurityOriginAllowed()
{
    $host = isset($_SERVER['HTTP_HOST']) ? strtolower(preg_replace('/:\\d+$/', '', $_SERVER['HTTP_HOST'])) : '';
    foreach (array('HTTP_ORIGIN','HTTP_REFERER') as $header) {
        if (empty($_SERVER[$header])) continue;
        $parts = parse_url($_SERVER[$header]);
        if (!isset($parts['host']) || strtolower($parts['host']) !== $host) return false;
    }
    return true;
}

function RequireCsrf()
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return true;
    if (!SecurityOriginAllowed()) {
        http_response_code(403);
        throw new RuntimeException('Nieprawidłowe źródło żądania.');
    }
    $provided = isset($_POST['csrf_token']) ? (string)$_POST['csrf_token'] : '';
    if ($provided === '' || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $provided)) {
        http_response_code(403);
        throw new RuntimeException('Sesja formularza wygasła. Odśwież stronę i spróbuj ponownie.');
    }
    return true;
}

function RateLimitEnsureTable()
{
    global $database_handle, $database_prefix;
    if (!$database_handle) return;
    $database_handle->exec('CREATE TABLE IF NOT EXISTS '.$database_prefix.'_security_rate_limits (
        bucket VARCHAR(80) NOT NULL,
        identifier_hash CHAR(64) NOT NULL,
        window_start DATETIME NOT NULL,
        hits INT UNSIGNED NOT NULL DEFAULT 0,
        blocked_until DATETIME NULL,
        PRIMARY KEY (bucket, identifier_hash),
        INDEX idx_blocked_until (blocked_until)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function RateLimitCheck($bucket, $limit, $windowSeconds, $blockSeconds = 0, $identifier = null)
{
    global $database_handle, $database_prefix;
    if (!$database_handle) return true;
    RateLimitEnsureTable();
    $identifier = $identifier === null ? SecurityClientIp() : $identifier;
    $hash = SecurityHashIdentifier($identifier);
    $bucket = substr(preg_replace('/[^a-zA-Z0-9_.:-]/', '_', $bucket), 0, 80);

    $database_handle->beginTransaction();
    try {
        $stmt = $database_handle->prepare('SELECT hits, window_start, blocked_until FROM '.$database_prefix.'_security_rate_limits WHERE bucket=:bucket AND identifier_hash=:hash FOR UPDATE');
        $stmt->execute(array(':bucket'=>$bucket, ':hash'=>$hash));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $now = time();
        if ($row && !empty($row['blocked_until']) && strtotime($row['blocked_until']) > $now) {
            $database_handle->commit();
            return false;
        }
        $hits = 1;
        $windowStart = date('Y-m-d H:i:s', $now);
        if ($row && ($now - strtotime($row['window_start'])) < $windowSeconds) {
            $hits = intval($row['hits']) + 1;
            $windowStart = $row['window_start'];
        }
        $blockedUntil = null;
        if ($hits > $limit && $blockSeconds > 0) $blockedUntil = date('Y-m-d H:i:s', $now + $blockSeconds);
        $sql = 'INSERT INTO '.$database_prefix.'_security_rate_limits (bucket,identifier_hash,window_start,hits,blocked_until) VALUES (:bucket,:hash,:window_start,:hits,:blocked_until)
                ON DUPLICATE KEY UPDATE window_start=VALUES(window_start), hits=VALUES(hits), blocked_until=VALUES(blocked_until)';
        $up = $database_handle->prepare($sql);
        $up->execute(array(':bucket'=>$bucket, ':hash'=>$hash, ':window_start'=>$windowStart, ':hits'=>$hits, ':blocked_until'=>$blockedUntil));
        $database_handle->commit();
        return $hits <= $limit;
    } catch (Exception $e) {
        if ($database_handle->inTransaction()) $database_handle->rollBack();
        error_log('RateLimit error: '.$e->getMessage());
        return true; // fail-open, aby awaria licznika nie wyłączyła serwisu
    }
}

function RateLimitReset($bucket, $identifier = null)
{
    global $database_handle, $database_prefix;
    if (!$database_handle) return;
    $identifier = $identifier === null ? SecurityClientIp() : $identifier;
    $stmt = $database_handle->prepare('DELETE FROM '.$database_prefix.'_security_rate_limits WHERE bucket=:bucket AND identifier_hash=:hash');
    $stmt->execute(array(':bucket'=>$bucket, ':hash'=>SecurityHashIdentifier($identifier)));
}

function TurnstileEnabled()
{
    return SecurityEnv('TURNSTILE_SECRET_KEY', '') !== '';
}

function TurnstileWidget()
{
    $siteKey = SecurityEnv('TURNSTILE_SITE_KEY', '');
    if ($siteKey === '') return '';
    return '<div class="cf-turnstile" data-sitekey="'.htmlspecialchars($siteKey, ENT_QUOTES, 'UTF-8').'"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
}

function VerifyTurnstile($response = null)
{
    $secret = SecurityEnv('TURNSTILE_SECRET_KEY', '');
    if ($secret === '') return true; // można wdrożyć kod przed ustawieniem sekretu
    if ($response === null) $response = isset($_POST['cf-turnstile-response']) ? $_POST['cf-turnstile-response'] : '';
    if ($response === '') return false;
    $payload = http_build_query(array('secret'=>$secret, 'response'=>$response, 'remoteip'=>SecurityClientIp()));
    $opts = array('http'=>array('method'=>'POST','header'=>'Content-Type: application/x-www-form-urlencoded\r\n','content'=>$payload,'timeout'=>5));
    $raw = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, stream_context_create($opts));
    if ($raw === false) return false;
    $json = json_decode($raw, true);
    return is_array($json) && !empty($json['success']);
}

function SecurityValidatePassword($password)
{
    $password = (string)$password;
    if (strlen($password) < 12) return 'Hasło musi mieć co najmniej 12 znaków.';
    if (!preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password) || !preg_match('/[0-9]/', $password)) return 'Hasło musi zawierać małą i wielką literę oraz cyfrę.';
    $common = array('password','password123','qwerty','qwerty123','123456789','admin123','zaq12wsx','gracz.pl','gracz123');
    if (in_array(strtolower($password), $common, true)) return 'To hasło jest zbyt popularne. Wybierz inne.';
    return true;
}

function AuditEnsureTable()
{
    global $database_handle, $database_prefix;
    if (!$database_handle) return;
    $database_handle->exec('CREATE TABLE IF NOT EXISTS '.$database_prefix.'_audit_log (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actor_user_id BIGINT NULL,
        actor_role VARCHAR(32) NULL,
        event_type VARCHAR(80) NOT NULL,
        target_type VARCHAR(80) NULL,
        target_id VARCHAR(191) NULL,
        ip_hash CHAR(64) NOT NULL,
        metadata_json TEXT NULL,
        prev_hash CHAR(64) NULL,
        entry_hash CHAR(64) NOT NULL,
        INDEX idx_created_at (created_at), INDEX idx_event_type (event_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function AuditLog($eventType, $targetType = null, $targetId = null, array $metadata = array())
{
    global $database_handle, $database_prefix;
    if (!$database_handle) return;
    AuditEnsureTable();
    $last = $database_handle->query('SELECT entry_hash FROM '.$database_prefix.'_audit_log ORDER BY id DESC LIMIT 1')->fetchColumn();
    $actorId = isset($_SESSION['id']) ? intval($_SESSION['id']) : null;
    $actorRole = isset($_SESSION['security_role']) ? $_SESSION['security_role'] : (isset($_SESSION['account_type']) ? (string)$_SESSION['account_type'] : null);
    $meta = json_encode(SecurityRedactArray($metadata), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $prev = $last ? $last : str_repeat('0', 64);
    $payload = implode('|', array(date('c'), $actorId, $actorRole, $eventType, $targetType, $targetId, SecurityHashIdentifier(SecurityClientIp()), $meta, $prev));
    $entryHash = hash_hmac('sha256', $payload, SecurityEnv('AUDIT_LOG_HMAC_KEY', SecurityEnv('SECURITY_HASH_PEPPER', '')));
    $stmt = $database_handle->prepare('INSERT INTO '.$database_prefix.'_audit_log (actor_user_id,actor_role,event_type,target_type,target_id,ip_hash,metadata_json,prev_hash,entry_hash) VALUES (:actor,:role,:event,:tt,:tid,:ip,:meta,:prev,:hash)');
    $stmt->execute(array(':actor'=>$actorId, ':role'=>$actorRole, ':event'=>substr($eventType,0,80), ':tt'=>$targetType, ':tid'=>$targetId, ':ip'=>SecurityHashIdentifier(SecurityClientIp()), ':meta'=>$meta, ':prev'=>$prev, ':hash'=>$entryHash));
}

function SecurityRequireRateLimit($bucket, $limit, $window, $block = 0, $identifier = null)
{
    if (!RateLimitCheck($bucket, $limit, $window, $block, $identifier)) {
        http_response_code(429);
        header('Retry-After: '.max(60, intval($block)));
        throw new RuntimeException('Wykonano zbyt wiele prób. Spróbuj ponownie później.');
    }
}
