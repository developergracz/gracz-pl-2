<?php
final class TwoFactorService
{
    public static function generateSecret($bytes = 20)
    {
        return self::base32Encode(random_bytes(max(16, (int)$bytes)));
    }

    public static function verifyTotp($secret, $code, $window = 1, $period = 30, $digits = 6)
    {
        $code = preg_replace('/\\D/', '', (string)$code);
        if (strlen($code) !== $digits) return false;
        $counter = (int) floor(time() / $period);
        for ($i = -abs((int)$window); $i <= abs((int)$window); $i++) {
            if (hash_equals(self::totp($secret, $counter + $i, $digits), $code)) return true;
        }
        return false;
    }

    public static function totp($secret, $counter, $digits = 6)
    {
        $key = self::base32Decode($secret);
        $binCounter = pack('N*', 0).pack('N*', $counter);
        $hash = hash_hmac('sha1', $binCounter, $key, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $binary = ((ord($hash[$offset]) & 0x7F) << 24) |
                  ((ord($hash[$offset + 1]) & 0xFF) << 16) |
                  ((ord($hash[$offset + 2]) & 0xFF) << 8) |
                  (ord($hash[$offset + 3]) & 0xFF);
        return str_pad((string)($binary % pow(10, $digits)), $digits, '0', STR_PAD_LEFT);
    }

    public static function provisioningUri($account, $secret, $issuer = 'Gracz.pl')
    {
        return 'otpauth://totp/'.rawurlencode($issuer.':'.$account).'?secret='.rawurlencode($secret).'&issuer='.rawurlencode($issuer).'&algorithm=SHA1&digits=6&period=30';
    }

    public static function roleRequires2fa($role)
    {
        return in_array($role, array('moderator','administrator','owner'), true);
    }

    private static function base32Encode($data)
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        for ($i=0; $i<strlen($data); $i++) $bits .= str_pad(decbin(ord($data[$i])), 8, '0', STR_PAD_LEFT);
        $out = '';
        foreach (str_split($bits, 5) as $chunk) {
            $out .= $alphabet[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
        }
        return $out;
    }

    private static function base32Decode($secret)
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = strtoupper(preg_replace('/[^A-Z2-7]/i', '', (string)$secret));
        $bits = '';
        for ($i=0; $i<strlen($secret); $i++) {
            $pos = strpos($alphabet, $secret[$i]);
            if ($pos === false) throw new InvalidArgumentException('Invalid TOTP secret.');
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) $out .= chr(bindec($chunk));
        }
        return $out;
    }
}
