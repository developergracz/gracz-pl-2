<?php
/* Centralny guard bezpieczeństwa dla starego PHP. */

if (!function_exists('gracz_request_path')) {
    function gracz_request_path()
    {
        $uri = isset($_SERVER['REQUEST_URI']) ? (string)$_SERVER['REQUEST_URI'] : '/';
        $path = parse_url($uri, PHP_URL_PATH);
        return is_string($path) ? $path : '/';
    }
}

if (!function_exists('gracz_security_fail')) {
    function gracz_security_fail($status, $message)
    {
        http_response_code((int)$status);
        header('Content-Type: text/plain; charset=UTF-8');
        header('Cache-Control: no-store');
        echo $message;
        exit();
    }
}

$requestMethod = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string)$_SERVER['REQUEST_METHOD']) : 'GET';
$requestPath = gracz_request_path();

/* Nie zezwalaj na operacje administracyjne zmieniające stan przez GET. */
if (strpos($requestPath, 'service_administration_panel') !== false &&
    ($requestMethod === 'GET') &&
    (isset($_GET['block']) || isset($_GET['unblock']))) {
    gracz_security_fail(405, 'Ta operacja administracyjna wymaga bezpiecznego żądania POST.');
}

/* Dodatkowa walidacja identyfikatora profilu przed użyciem w starym kodzie. */
if (isset($_REQUEST['profile_login'])) {
    $profileLogin = (string)$_REQUEST['profile_login'];
    if (!preg_match('/^[a-z0-9ąćęłńóśźż_]{1,32}$/iu', $profileLogin)) {
        gracz_security_fail(400, 'Nieprawidłowa nazwa profilu.');
    }
    $_GET['profile_login'] = $profileLogin;
    $_REQUEST['profile_login'] = $profileLogin;
}

/* Podstawowe nagłówki ograniczające klasę ataków w starych widokach. */
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
