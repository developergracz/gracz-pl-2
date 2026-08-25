<?php
final class RequestGuardService
{
    public static function enforceStateChangingRequest()
    {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string)$_SERVER['REQUEST_METHOD']) : 'GET';
        if (!in_array($method,array('POST','PUT','PATCH','DELETE'),true)) return true;

        SecurityService::verifyOrigin();

        $csrf = isset($_POST['csrf_token']) ? (string)$_POST['csrf_token'] : '';
        if ($csrf !== '') {
            return SecurityService::verifyStateChangingRequest($csrf);
        }

        // Transitional support for legacy Gracz.pl forms/AJAX. The legacy token is session-bound.
        $legacy = isset($_REQUEST['token']) ? (string)$_REQUEST['token'] : '';
        if ($legacy !== '' && function_exists('IsTokenValid') && IsTokenValid($legacy)) {
            return true;
        }

        // Login form also uses the legacy session token and is handled above.
        http_response_code(403);
        throw new RuntimeException('Brak poprawnego tokenu CSRF dla operacji zmieniającej dane.');
    }
}
