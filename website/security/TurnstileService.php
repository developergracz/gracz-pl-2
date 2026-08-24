<?php
final class TurnstileService
{
    public static function isConfigured()
    {
        return (bool) getenv('CLOUDFLARE_TURNSTILE_SECRET_KEY');
    }

    public static function verifyRequest($responseToken = null)
    {
        $secret = getenv('CLOUDFLARE_TURNSTILE_SECRET_KEY');
        if (!$secret) {
            if (getenv('GRACZ_ENV') === 'production') {
                throw new RuntimeException('Turnstile nie jest skonfigurowany.');
            }
            return true;
        }

        if ($responseToken === null) {
            $responseToken = isset($_POST['cf-turnstile-response']) ? $_POST['cf-turnstile-response'] : '';
        }
        if (!is_string($responseToken) || strlen($responseToken) < 10 || strlen($responseToken) > 2048) {
            throw new RuntimeException('Potwierdź, że nie jesteś botem.');
        }

        $payload = http_build_query(array(
            'secret' => $secret,
            'response' => $responseToken,
            'remoteip' => SecurityService::clientIp()
        ), '', '&');

        $context = stream_context_create(array('http' => array(
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\nConnection: close\r\n",
            'content' => $payload,
            'timeout' => 5,
            'ignore_errors' => true
        )));
        $raw = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $context);
        if ($raw === false) {
            throw new RuntimeException('Nie udało się zweryfikować zabezpieczenia antybotowego.');
        }
        $result = json_decode($raw, true);
        if (!is_array($result) || empty($result['success'])) {
            throw new RuntimeException('Weryfikacja antybotowa nie powiodła się.');
        }
        return true;
    }

    public static function widgetHtml()
    {
        $siteKey = getenv('CLOUDFLARE_TURNSTILE_SITE_KEY');
        if (!$siteKey) {
            return '';
        }
        return '<div class="cf-turnstile" data-sitekey="'.htmlspecialchars($siteKey, ENT_QUOTES, 'UTF-8').'"></div>';
    }
}
