<?php
final class TokenService
{
    const DEFAULT_TTL = 3600;

    public static function generate()
    {
        $plain = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        return array(
            'plain' => $plain,
            'hash' => self::hash($plain)
        );
    }

    public static function hash($plainToken)
    {
        return hash('sha256', (string) $plainToken);
    }

    public static function verify($plainToken, $storedHash)
    {
        if (!is_string($plainToken) || !is_string($storedHash) || strlen($storedHash) !== 64) {
            return false;
        }
        return hash_equals($storedHash, self::hash($plainToken));
    }

    public static function expiresAt($ttl = self::DEFAULT_TTL)
    {
        return date('Y-m-d H:i:s', time() + max(60, (int) $ttl));
    }
}
