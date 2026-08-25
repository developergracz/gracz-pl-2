<?php

// Plik variables_local.php musi zostać wczytany
include_once("variables_local.php");
include_once('../variables_global.php');
include_once("exceptions.php");

$load = sys_getloadavg();
if (is_array($load) && $load[0] > 80) {
    header('HTTP/1.1 503 Too busy, try again later');
    die('<meta charset="utf8" /><div style="width:70%; font-size:200%; margin:auto; margin-top:300px; background:f5f5f5; border-radius:10pt;">Przepraszamy,<br />nasz serwer jest zbyt obciążony. Spróbuj ponownie później.<br /><br /><span style="font-size:300%;">;(</span></div>');
}

$is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
            (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.use_trans_sid', '0');
session_set_cookie_params(30*24*60*60, '/', $domain, $is_https, true);

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

ini_set('display_errors',$production_mode?"Off":"On");
if (!$production_mode)
  error_reporting(E_ALL^E_NOTICE^E_DEPRECATED);
else
  error_reporting(E_ERROR^E_WARNING);

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
  $opis_bledu = addslashes(htmlspecialchars($opis_bledu));
  $plik_wystapienia = addslashes(htmlspecialchars($plik_wystapienia));
  $linia = intval($linia);

  $safe_request = $_REQUEST;
  foreach (array('password','password2','password_confirmation','old_password','new_password','new_password_confirm','password_old','password_new','password_new_confirm','token','PHPSESSID','authorization') as $sensitive_key)
  {
    if (isset($safe_request[$sensitive_key]))
      $safe_request[$sensitive_key] = '[REDACTED]';
  }
  $parametry = addslashes(htmlspecialchars(print_r($safe_request,true)));
  $url = addslashes(htmlspecialchars(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : ''));
  $IP = addslashes(htmlspecialchars(isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''));
  $proxy = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? addslashes(htmlspecialchars($_SERVER['HTTP_X_FORWARDED_FOR'])) : '';

  $plik = fopen($path['log_errors_php'],'a+');
  if (!$plik) return;
  fwrite($plik,'kod_bledu = "'.$kod_bledu.'"'."\r\n");
  fwrite($plik,'opis_bledu = "'.$opis_bledu.'"'."\r\n");
  fwrite($plik,'plik_wystapienia = "'.$plik_wystapienia.'"'."\r\n");
  fwrite($plik,'linia = '.$linia."\r\n");
  fwrite($plik,'IP = '.$IP.' ('.$proxy.') '."\r\n");
  fwrite($plik,'URL = "'.$url.'"'."\r\n");
  fwrite($plik,'REQUEST = "'.$parametry.'"'."\r\n");
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
  $plik = fopen($path['log_exceptions_php'],'a+');
  if (!$plik) return;
  fwrite($plik,get_class($exception).': '.$exception->getMessage()."\r\n");
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

session_start();

// Migrate weak legacy numeric CSRF tokens to 256-bit random tokens. Existing open
// forms may need one refresh during the migration, but no weak token is retained.
if (!isset($_SESSION['token']) || !is_string($_SESSION['token']) || strlen($_SESSION['token']) < 64) {
  $_SESSION['token'] = bin2hex(random_bytes(32));
}

include_once($actual_path.'legacy_security_shim.php');
include_once($actual_path.'library_main.php');
DatabaseConnect();
include_once($actual_path.'legacy_auth_security.php');

header('Content-Type: text/html; charset=UTF-8;');

if (strpos($_SERVER['REQUEST_URI'], $path['activate_account'])>0)
  Logout();

$komunikat_logowania = '';
try
{
  if (isset($_POST['buttonLogin']))
  {
    $login_ok = SecureAuthorizeUser(
      isset($_POST['login']) ? $_POST['login'] : '',
      isset($_POST['password']) ? $_POST['password'] : '',
      isset($_POST['remember_me']) && $_POST['remember_me'] === 'on'
    );
    if (!$login_ok) {
      $komunikat_logowania = 'Nieprawidłowy login/e-mail lub hasło.';
    }
    // Legacy login code may have generated a weak numeric token internally.
    $_SESSION['token'] = bin2hex(random_bytes(32));
  }else
  {
    AuthorizeUser();
    if (!isset($_SESSION['token']) || !is_string($_SESSION['token']) || strlen($_SESSION['token']) < 64)
      $_SESSION['token'] = bin2hex(random_bytes(32));
  }
}catch(ExceptionRoot $e)
{
  $komunikat_logowania = $e;
}catch(Exception $e)
{
  $komunikat_logowania = 'Logowanie nie powiodło się.';
  error_log('Gracz.pl login error: '.get_class($e));
}

ProtectAgainstSessionHijacking();

if (IsIPAddressBlocked($_SERVER['REMOTE_ADDR']))
{
  echo('Nie masz dostępu do serwisu ponieważ Twój adres IP został zablokowany przez administratora.');
  exit();
}

if (isset($_REQUEST['facebookRegister']))
  facebookRedirectToFacebookLoginPage();

if (isset($_REQUEST['error_reason'])&&($_REQUEST['error_reason']=='user_denied'))
  header('Location: '.$service_base_address."\r\n");

ZapiszAdresIPInternauty();
