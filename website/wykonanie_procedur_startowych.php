<?php

// Plik variables_local.php musi zostać wczytany
include_once("variables_local.php");
include_once('../variables_global.php'); // przetworzenie 5ms
include_once("exceptions.php");


$load = sys_getloadavg();
if ($load[0] > 80) {
    header('HTTP/1.1 503 Too busy, try again later');
    die('<meta charset="utf8" /><div style="width:70%; font-size:200%; margin:auto; margin-top:300px; background:f5f5f5; border-radius:10pt;">Przepraszamy,<br />nasz serwer jest zbyt obciążony. Spróbuj ponownie później.<br /><br /><span style="font-size:300%;">;(</span></div>');
    $filename = fopen($directory['log'].'too_busy.log','w+');
    fwrite($filename,'Server too busy at: '.date('Y-m-d h:m:s')."\r\n");
    fclose($filename);
}

// We are setting HTTP-ONLY parameter to our cookies
session_set_cookie_params(30*24*60*60, '/', $domain, false, true);

// Włączernie/Wyłączenie wyświetlania błędów
ini_set('display_errors',$production_mode?"Off":"On");
if (!$production_mode)
  error_reporting(E_ALL^E_NOTICE^E_DEPRECATED);
else
  error_reporting(E_ERROR^E_WARNING);


// Włączanie kompresji GZIP
if(!ini_get('zlib.output_compression')){
  if(substr_count($_SERVER['HTTP_ACCEPT_ENCODING'],'gzip')){
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
  $parametry = addslashes(htmlspecialchars(print_r($_REQUEST,true)));
  $url = addslashes(htmlspecialchars($_SERVER['REQUEST_URI']));
  $IP = addslashes(htmlspecialchars($_SERVER['REMOTE_ADDR']));
  if (isset($_SERVER['HTTP_X_FORWARDED_FOR']))
    $proxy = addslashes(htmlspecialchars($_SERVER['HTTP_X_FORWARDED_FOR']));
  else
    $proxy = '';

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
  {
    savePHPError($errno,$errstr,$errfile,$errline);
    // UWAGA - poniższa instrukcja throw ma skłonność do wypluwania parametrów funkcji na wyjście (w tym haseł w mysql_connect() ) !!!
    //throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
  }
  return false;
}

function UnhandledExceptionsCatcher($exception)
{
  global $path;
  $plik = fopen($path['log_exceptions_php'],'a+');
  if (!$plik) return;
  fwrite($plik,print_r($exception,true)."\r\n");
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

// Ustawianie lokalizacji // powoduje błędy przy liczbach zmiennoprzecinkowych (przecinek w lokalizacji polskiej jest przecinkiem a nie kropką)
//$arrLocale = array( "pl_PL", "polish_pol" );
//setlocale( LC_ALL, $arrLocale );

if (isset($_POST['PHPSESSID']))
{
  session_id($_POST['PHPSESSID']);
}


session_start();

//echo '(przesłany)'.$_REQUEST['token'].'=(nowy)'.$_SESSION['token'].',(stary)'.$_SESSION['token_last'];
include_once($actual_path.'library_main.php'); // przetworzenie 40ms

//Rejstracja wywołań
//$p = fopen('logi/aaa='.date('Y-m-d h.m.s'),'w+');
//fwrite($p, 'IP='.$_SERVER['REMOTE_ADDR']);

DatabaseConnect(); // ok. 10ms (ale zauważ, że gdy rozłączone, to nie tracimy czasu na wyk. zapytań)

// Wysyłanie różnego Content-Type w zależności od przeglądarki (dla IE XHTML należy dozować jako text/html ;)
// Również w zalezności od tego czy jest to zapytanie Ajaxowe czy normalne
header('Content-Type: text/html; charset=UTF-8;');
srand();

// It must be before TOKEN initialization (TOKEN is initialized in AuthorizeUser function)
// If user enter ActiveAccount page, we are logging him out.
if (strpos($_SERVER['REQUEST_URI'], $path['activate_account'])>0)
  Logout();


$komunikat_logowania = '';
try
{
  if (isset($_POST['buttonLogin']))
  {
    AuthorizeUser($_POST['login'], $_POST['password'], isset($_POST['remember_me'])?($_POST['remember_me']=='on'?true:false):false);
  }else
  {
    AuthorizeUser(); // po zalogowaniu, bez większego wpływu czasowego
  }
}catch(ExceptionRoot $e)
{
  $komunikat_logowania = $e;
}

ProtectAgainstSessionHijacking(); // bez większego wpływu czasowego

if (IsIPAddressBlocked($_SERVER['REMOTE_ADDR'])) // wahania ms - bez większego wpływu czasowego
{
  echo('Nie masz dostępu do serwisu ponieważ Twój adres IP został zablokowany przez administratora.');
  exit();
}

// Jeśli kliknięto przycisk rejestracji przez Facebook
if (isset($_REQUEST['facebookRegister']))
  facebookRedirectToFacebookLoginPage();

// Przekierowanie na stronę główną, gdy nie udało się zarejestrować konta przez Facebooka
if (isset($_REQUEST['error_reason'])&&($_REQUEST['error_reason']=='user_denied'))
  header('Location: '.$service_base_address."\r\n");

ZapiszAdresIPInternauty();
