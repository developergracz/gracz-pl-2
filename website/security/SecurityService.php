<?php
/**
 * Central security primitives for Gracz.pl.
 * Keep this file free of application/business logic.
 */
final class SecurityService
{
    const SESSION_IDLE_TTL = 1800;      // 30 minutes
    const SESSION_ABSOLUTE_TTL = 28800; // 8 hours

    private static $sensitiveKeys = array(
        'password', 'password_confirmation', 'current_password', 'new_password',
        'token', 'csrf', 'csrf_token', 'activation_code', 'authorization',
        'api_key', 'apikey', 'secret', 'turnstile_token', 'cf-turnstile-response'
    );

    public static function configureSessionCookie()
    {
        $secure = self::isHttps();
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_secure', $secure ? '1' : '0');
        ini_set('session.cookie_samesite', 'Lax');
        ini_set('session.gc_maxlifetime', (string) self::SESSION_ABSOLUTE_TTL);

        session_set_cookie_params(array(
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax'
        ));
    }

    public static function isHttps()
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }
        if (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
            $proto = strtolower(trim(explode(',', $_SERVER['HTTP_X_FORWARDED_PROTO'])[0]));
            return $proto === 'https';
        }
        return false;
    }

    public static function sendSecurityHeaders()
    {
        if (headers_sent()) {
            return;
        }
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        header('Cross-Origin-Opener-Policy: same-origin');
        header('Cross-Origin-Resource-Policy: same-site');
        if (self::isHttps()) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
        }
        // Legacy UI needs inline styles/scripts for now. Tighten after CSP inventory.
        header("Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests");
    }

    public static function initializeSessionState()
    {
        $now = time();
        if (!isset($_SESSION['security_created_at'])) {
            $_SESSION['security_created_at'] = $now;
        }
        if (!isset($_SESSION['security_last_seen'])) {
            $_SESSION['security_last_seen'] = $now;
        }

        $idleExpired = ($now - (int) $_SESSION['security_last_seen']) > self::SESSION_IDLE_TTL;
        $absoluteExpired = ($now - (int) $_SESSION['security_created_at']) > self::SESSION_ABSOLUTE_TTL;
        if ($idleExpired || $absoluteExpired) {
            self::destroySession();
            self::configureSessionCookie();
            session_start();
            $_SESSION['security_created_at'] = $now;
        }
        $_SESSION['security_last_seen'] = $now;
    }

    public static function rotateSessionAfterAuthentication()
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
            $_SESSION['security_created_at'] = time();
            $_SESSION['security_last_seen'] = time();
        }
    }

    public static function destroySession()
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return;
        }
        $_SESSION = array();
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', array(
                'expires' => time() - 42000,
                'path' => isset($p['path']) ? $p['path'] : '/',
                'domain' => isset($p['domain']) ? $p['domain'] : '',
                'secure' => !empty($p['secure']),
                'httponly' => true,
                'samesite' => 'Lax'
            ));
        }
        session_destroy();
    }

    public static function csrfToken()
    {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    public static function csrfInput()
    {
        return '<input type="hidden" name="csrf_token" value="'.htmlspecialchars(self::csrfToken(), ENT_QUOTES, 'UTF-8').'">';
    }

    public static function verifyStateChangingRequest($token = null)
    {
        if (!in_array($_SERVER['REQUEST_METHOD'], array('POST', 'PUT', 'PATCH', 'DELETE'), true)) {
            return true;
        }
        self::verifyOrigin();
        if ($token === null) {
            $token = isset($_POST['csrf_token']) ? $_POST['csrf_token'] : null;
        }
        if (!is_string($token) || !hash_equals(self::csrfToken(), $token)) {
            http_response_code(403);
            throw new RuntimeException('Nieprawidłowy token bezpieczeństwa formularza.');
        }
        return true;
    }

    public static function verifyOrigin()
    {
        $expectedHost = isset($_SERVER['HTTP_HOST']) ? strtolower(preg_replace('/:\\d+$/', '', $_SERVER['HTTP_HOST'])) : '';
        if ($expectedHost === '') {
            return true;
        }
        foreach (array('HTTP_ORIGIN', 'HTTP_REFERER') as $key) {
            if (empty($_SERVER[$key])) {
                continue;
            }
            $host = strtolower((string) parse_url($_SERVER[$key], PHP_URL_HOST));
            if ($host !== '' && !hash_equals($expectedHost, $host)) {
                http_response_code(403);
                throw new RuntimeException('Żądanie pochodzi z niedozwolonego źródła.');
            }
            return true;
        }
        return true; // CSRF token remains mandatory; Origin/Referer can be absent legitimately.
    }

    public static function clientIp()
    {
        // Trust REMOTE_ADDR only. Reverse proxies should overwrite it with a trusted connector configuration.
        return isset($_SERVER['REMOTE_ADDR']) ? substr((string) $_SERVER['REMOTE_ADDR'], 0, 45) : '0.0.0.0';
    }

    public static function redact($value, $key = '')
    {
        if ($key !== '' && in_array(strtolower((string) $key), self::$sensitiveKeys, true)) {
            return '[REDACTED]';
        }
        if (is_array($value)) {
            $out = array();
            foreach ($value as $k => $v) {
                $out[$k] = self::redact($v, (string) $k);
            }
            return $out;
        }
        $text = (string) $value;
        $text = preg_replace('/(Bearer\\s+)[A-Za-z0-9._~+\\/-]+=*/i', '$1[REDACTED]', $text);
        return mb_substr($text, 0, 4000, 'UTF-8');
    }

    public static function requireRole($allowedRoles)
    {
        $role = isset($_SESSION['role']) ? $_SESSION['role'] : self::legacyRole();
        if (!in_array($role, (array) $allowedRoles, true)) {
            http_response_code(403);
            exit('Brak uprawnień.');
        }
    }

    public static function legacyRole()
    {
        $type = isset($_SESSION['account_type']) ? (int) $_SESSION['account_type'] : 0;
        if (defined('ADMINISTRATOR') && $type >= ADMINISTRATOR) {
            return 'administrator';
        }
        if (defined('MODERATOR') && $type >= MODERATOR) {
            return 'moderator';
        }
        if (defined('USER') && $type >= USER) {
            return 'player';
        }
        return 'guest';
    }

    public static function validateEmail($email)
    {
        $email = trim((string) $email);
        if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('Nieprawidłowy adres e-mail.');
        }
        return strtolower($email);
    }

    public static function validateLogin($login)
    {
        $login = trim((string) $login);
        if (!preg_match('/^[\\p{L}0-9_]{4,32}$/u', $login)) {
            throw new InvalidArgumentException('Login musi mieć 4–32 znaki i zawierać tylko litery, cyfry lub _.');
        }
        return $login;
    }

    public static function validatePassword($password)
    {
        $password = (string) $password;
        if (strlen($password) < 12 || strlen($password) > 128) {
            throw new InvalidArgumentException('Hasło musi mieć od 12 do 128 znaków.');
        }
        $common = array('password1234', 'qwerty123456', '123456789012', 'admin12345678');
        if (in_array(strtolower($password), $common, true)) {
            throw new InvalidArgumentException('To hasło jest zbyt popularne. Wybierz inne.');
        }
        return $password;
    }
}
