<?php
final class DataProtectionService
{
    private static function key()
    {
        $raw = getenv('GRACZ_DATA_ENCRYPTION_KEY');
        if (!$raw) {
            throw new RuntimeException('GRACZ_DATA_ENCRYPTION_KEY is not configured.');
        }
        $decoded = base64_decode($raw, true);
        $key = ($decoded !== false && strlen($decoded) === 32) ? $decoded : hash('sha256', $raw, true);
        return $key;
    }

    public static function encrypt($plaintext, $aad = '')
    {
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt((string)$plaintext, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag, (string)$aad, 16);
        if ($ciphertext === false) {
            throw new RuntimeException('Encryption failed.');
        }
        return 'v1.'.self::b64($iv).'.'.self::b64($tag).'.'.self::b64($ciphertext);
    }

    public static function decrypt($payload, $aad = '')
    {
        $parts = explode('.', (string)$payload);
        if (count($parts) !== 4 || $parts[0] !== 'v1') {
            throw new RuntimeException('Unsupported encrypted payload.');
        }
        $iv = self::unb64($parts[1]);
        $tag = self::unb64($parts[2]);
        $ciphertext = self::unb64($parts[3]);
        $plain = openssl_decrypt($ciphertext, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag, (string)$aad);
        if ($plain === false) {
            throw new RuntimeException('Decryption failed or data was modified.');
        }
        return $plain;
    }

    private static function b64($value)
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function unb64($value)
    {
        $value = strtr($value, '-_', '+/');
        $value .= str_repeat('=', (4 - strlen($value) % 4) % 4);
        $decoded = base64_decode($value, true);
        if ($decoded === false) throw new RuntimeException('Invalid encrypted payload.');
        return $decoded;
    }
}
