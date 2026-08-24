<?php
final class SecureMailService
{
    public static function send($to, $subject, $textBody, array $extraHeaders = array())
    {
        $to = SecurityService::validateEmail($to);
        $subject = self::singleLine($subject, 180);
        $from = getenv('GRACZ_MAIL_FROM');
        if (!$from) $from = 'noreply@'.(getenv('GRACZ_DOMAIN') ?: 'gracz.pl');
        $from = SecurityService::validateEmail($from);

        $headers = array(
            'From: Gracz.pl <'.$from.'>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            'X-Auto-Response-Suppress: All'
        );
        foreach ($extraHeaders as $name => $value) {
            $name = preg_replace('/[^A-Za-z0-9-]/', '', (string)$name);
            if ($name === '' || in_array(strtolower($name), array('to','bcc','cc','from','authorization'), true)) continue;
            $headers[] = $name.': '.self::singleLine($value, 500);
        }
        $body = str_replace("\0", '', (string)$textBody);
        return mail($to, $subject, $body, implode("\r\n", $headers));
    }

    private static function singleLine($value, $max)
    {
        $value = preg_replace('/[\r\n]+/', ' ', trim((string)$value));
        return mb_substr($value, 0, $max, 'UTF-8');
    }
}
