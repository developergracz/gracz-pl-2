<?php
final class SessionService
{
    private $pdo;
    private $prefix;

    public function __construct(PDO $pdo, $prefix)
    {
        $this->pdo = $pdo;
        $this->prefix = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$prefix);
    }

    public function registerCurrent($userId)
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !$userId) return false;
        $table = $this->prefix.'_security_sessions';
        $hash = $this->currentHash();
        $now = date('Y-m-d H:i:s');
        $expires = date('Y-m-d H:i:s', time() + SecurityService::SESSION_ABSOLUTE_TTL);
        $ipHash = $this->privacyHash(SecurityService::clientIp());
        $uaHash = $this->privacyHash(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '');
        $stmt = $this->pdo->prepare("INSERT INTO {$table} (session_hash,user_id,created_at,last_seen_at,expires_at,revoked_at,revoke_reason,ip_hash,user_agent_hash)
            VALUES (:hash,:uid,:created,:seen,:expires,NULL,NULL,:ip,:ua)
            ON DUPLICATE KEY UPDATE last_seen_at=VALUES(last_seen_at), expires_at=VALUES(expires_at), ip_hash=VALUES(ip_hash), user_agent_hash=VALUES(user_agent_hash)");
        return $stmt->execute(array(':hash'=>$hash, ':uid'=>(int)$userId, ':created'=>$now, ':seen'=>$now, ':expires'=>$expires, ':ip'=>$ipHash, ':ua'=>$uaHash));
    }

    public function validateCurrent($userId)
    {
        if (!$userId || session_status() !== PHP_SESSION_ACTIVE) return false;
        $table = $this->prefix.'_security_sessions';
        try {
            $stmt = $this->pdo->prepare("SELECT revoked_at, expires_at FROM {$table} WHERE session_hash=:hash AND user_id=:uid LIMIT 1");
            $stmt->execute(array(':hash'=>$this->currentHash(), ':uid'=>(int)$userId));
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            // During rollout, register legacy authenticated sessions on first sight.
            if (!$row) return $this->registerCurrent($userId);
            if (!empty($row['revoked_at']) || strtotime($row['expires_at']) <= time()) return false;
            $stmt = $this->pdo->prepare("UPDATE {$table} SET last_seen_at=NOW() WHERE session_hash=:hash AND user_id=:uid");
            $stmt->execute(array(':hash'=>$this->currentHash(), ':uid'=>(int)$userId));
            return true;
        } catch (Exception $e) {
            // Until migration is applied on staging/prod, do not lock out all users.
            return true;
        }
    }

    public function revokeCurrent($reason = 'logout')
    {
        $table = $this->prefix.'_security_sessions';
        try {
            $stmt = $this->pdo->prepare("UPDATE {$table} SET revoked_at=NOW(), revoke_reason=:reason WHERE session_hash=:hash AND revoked_at IS NULL");
            return $stmt->execute(array(':reason'=>substr((string)$reason,0,80), ':hash'=>$this->currentHash()));
        } catch (Exception $e) {
            return false;
        }
    }

    public function revokeAllForUser($userId, $reason = 'password_change')
    {
        $table = $this->prefix.'_security_sessions';
        try {
            $stmt = $this->pdo->prepare("UPDATE {$table} SET revoked_at=NOW(), revoke_reason=:reason WHERE user_id=:uid AND revoked_at IS NULL");
            return $stmt->execute(array(':reason'=>substr((string)$reason,0,80), ':uid'=>(int)$userId));
        } catch (Exception $e) {
            return false;
        }
    }

    private function currentHash()
    {
        return hash_hmac('sha256', session_id(), $this->pepper());
    }

    private function privacyHash($value)
    {
        return hash_hmac('sha256', (string)$value, $this->pepper());
    }

    private function pepper()
    {
        $key = getenv('GRACZ_APP_KEY');
        if (!$key) $key = getenv('GRACZ_AUDIT_PEPPER');
        if (!$key) $key = 'development-only-change-me';
        return $key;
    }
}
