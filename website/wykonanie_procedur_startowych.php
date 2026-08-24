<?php

// Plik variables_local.php musi zostać wczytany
include_once("variables_local.php");
include_once('../variables_global.php'); // przetworzenie 5ms
include_once("exceptions.php");
include_once($actual_path.'security_core.php');

SecurityApplyHeaders();
SecurityConfigureSession(isset($domain) ? $domain : '');

$load = sys_getloadavg();
if (is_array($load) && isset($load[0]) && $load[0] > 80) {
    header('HTTP/1.1 503 Too busy, try again later');
    die('<meta charset="utf8" /><div style="width:70%; font-size:200%; margin:auto; margin-top:300px; background:f5f5f5; border-radius:10pt;">Przepraszamy,<br />nasz serwer jest zbyt obciążony. Spróbuj ponownie później.<br /><br /><span style="font-size:300%;">;(</span></div>');
}

// Włączenie/Wyłączenie wyświetlania błędów
ini_set('display_errors',$production_mode?"Off":"On");
if (!$production_mode)
  error_reporting(E_ALL^E_NOTICE^E_DEPRECATED);
else
  error_reporting(E_ERROR^E_WARNING);

// Włączanie kompresji GZIP
if(!ini_get('zlib.output_compression')){
  if(isset($_SERVER['HTTP_ACCEPT_ENCODING']) && substr_count($_SERVER['HTTP_ACCEPT_ENCODING'],'gzip')){
    ini_set('zlib.output_compression_level',1);
    ob_start('ob_gzhandler');
  }
}

function savePHPError($kod_bledu, $opis_bledu, $plik_wystapienia, $linia)
{
  global $path;
  $kod_bledu = intval($kod_bledu);
  $opis_bledu = htmlspecialchars((string)$opis_bledu, ENT_QUOTES, 'UTF-8');
  $plik_wystapienia = htmlspecialchars((string)$plik_wystapienia, ENT_QUOTES, 'UTF-8');
  $linia = intval($linia);
  // Nigdy nie zapisujemy całego $_REQUEST bez filtrowania: może zawierać hasła, tokeny i prywatne wiadomości.
  $parametry = htmlspecialchars(print_r(SecurityRedactArray($_REQUEST),true), ENT_QUOTES, 'UTF-8');
  $url = htmlspecialchars(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '', ENT_QUOTES, 'UTF-8');
  $IP = SecurityHashIdentifier(SecurityClientIp());

  $plik = @fopen($path['log_errors_php'],'a+');
  if (!$plik) return;
  fwrite($plik,'kod_bledu = "'.$kod_bledu.'"'."\r\n");
  fwrite($plik,'opis_bledu = "'.$opis_bledu.'"'."\r\n");
  fwrite($plik,'plik_wystapienia = "'.$plik_wystapienia.'"'."\r\n");
  fwrite($plik,'linia = '.$linia."\r\n");
  fwrite($plik,'IP_HASH = '.$IP."\r\n");
  fwrite($plik,'URL = "'.$url.'"'."\r\n");
  fwrite($plik,'REQUEST_REDACTED = "'.$parametry.'"'."\r\n");
  fwrite($plik,'==========================================='."\r\n");
  fclose($plik);
}

function UnhandledErrorsCatcher($errno, $errstr, $errfile, $errline)
{
  if(in_array($errno, array(E_ERROR, E_WARNING, E_PARSE, E_RECOVERABLE_ERROR)))
    savePHPError($errno,$errstr,$errfile,$errline);
  return false;
}

function UnhandledExceptionsCatcher($exception)
{
  global $path;
  $plik = @fopen($path['log_exceptions_php'],'a+');
  if (!$plik) return;
  // Logujemy klasę i komunikat, ale bez pełnego stack trace z argumentami funkcji.
  fwrite($plik,get_class($exception).': '.SecurityRedactArray(array('message'=>$exception->getMessage()))['message']."\r\n");
  fwrite($plik,'==========================================='."\r\n");
  fclose($plik);
  return false;
}

if ($production_mode) {
  set_exception_handler('UnhandledExceptionsCatcher');
  set_error_handler('UnhandledErrorsCatcher');
}

mb_internal_encoding('UTF-8');
date_default_timezone_set('Europe/Warsaw');

if (isset($_SERVER['X-Purpose'])&&$_SERVER['X-Purpose']=='preview')
{
  echo('<div style="text-align:center; font-size:200%; color:navy; text-shadow:0 0 10px silver;">'.$service_name.'</div>');
  exit();
}

// Zabronione: ustawianie identyfikatora sesji na podstawie danych POST (session fixation).
session_start();
SecurityEnforceSessionLifetime();

include_once($actual_path.'library_main.php'); // przetworzenie 40ms
DatabaseConnect(); // ok. 10ms
RateLimitEnsureTable();
AuditEnsureTable();

header('Content-Type: text/html; charset=UTF-8;');
srand();

if (strpos($_SERVER['REQUEST_URI'], $path['activate_account'])>0)
  Logout();

$komunikat_logowania = '';
try
{
  if (isset($_POST['buttonLogin']))
  {
    $loginIdentity = strtolower(trim(isset($_POST['login']) ? $_POST['login'] : ''));
    $compoundIdentity = SecurityClientIp().'|'.$loginIdentity;

    // Limit twardy: 15 prób / 15 min, następnie blokada 30 min.
    SecurityRequireRateLimit('login_hard', 15, 900, 1800, $compoundIdentity);

    // Po kilku próbach wymagamy dodatkowej weryfikacji Turnstile, jeżeli klucze są skonfigurowane.
    $softAllowed = RateLimitCheck('login_soft', 5, 900, 0, $compoundIdentity);
    if (!$softAllowed && TurnstileEnabled() && !VerifyTurnstile()) {
      AuditLog('auth.turnstile_failed', 'account', $loginIdentity);
      throw new RuntimeException('Wymagana jest dodatkowa weryfikacja bezpieczeństwa.');
    }

    $loggedIn = AuthorizeUser($_POST['login'], $_POST['password'], isset($_POST['remember_me'])?($_POST['remember_me']=='on'):false);
    if ($loggedIn) {
      SecurityRotateSessionAfterLogin();
      RateLimitReset('login_hard', $compoundIdentity);
      RateLimitReset('login_soft', $compoundIdentity);
      AuditLog('auth.login_success', 'user', isset($_SESSION['id']) ? $_SESSION['id'] : null);
    } else {
      AuditLog('auth.login_failed', 'account', $loginIdentity);
      $komunikat_logowania = 'Nieprawidłowy login/e-mail lub hasło.';
    }
  }else
  {
    AuthorizeUser();
  }
}catch(Exception $e)
{
  $komunikat_logowania = htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
}

ProtectAgainstSessionHijacking();

if (IsIPAddressBlocked(SecurityClientIp()))
{
  echo('Nie masz dostępu do serwisu ponieważ Twój adres IP został zablokowany przez administratora.');
  exit();
}

if (isset($_REQUEST['facebookRegister']))
  facebookRedirectToFacebookLoginPage();

if (isset($_REQUEST['error_reason'])&&($_REQUEST['error_reason']=='user_denied'))
  header('Location: '.$service_base_address."\r\n");

ZapiszAdresIPInternauty();
