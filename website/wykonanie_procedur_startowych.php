<?php
include_once("variables_local.php");
include_once('../variables_global.php');
include_once("exceptions.php");
require_once($actual_path.'security/SecurityBootstrap.php');

$load = sys_getloadavg();
if (isset($load[0]) && $load[0] > 80) {
    header('HTTP/1.1 503 Too busy, try again later');
    die('<meta charset="utf8" /><div>Serwer jest chwilowo przeciążony. Spróbuj ponownie później.</div>');
}

SecurityService::configureSessionCookie();
ini_set('display_errors',$production_mode?"Off":"On");
if (!$production_mode) error_reporting(E_ALL^E_NOTICE^E_DEPRECATED); else error_reporting(E_ERROR^E_WARNING);
if(!ini_get('zlib.output_compression') && isset($_SERVER['HTTP_ACCEPT_ENCODING']) && substr_count($_SERVER['HTTP_ACCEPT_ENCODING'],'gzip')){
  ini_set('zlib.output_compression_level',1);
  ob_start('ob_gzhandler');
}

function savePHPError($kod_bledu, $opis_bledu, $plik_wystapienia, $linia)
{
  global $path;
  $safeRequest = SecurityService::redact($_REQUEST);
  $entry = array(
    'time'=>gmdate('c'),'code'=>intval($kod_bledu),'description'=>SecurityService::redact((string)$opis_bledu),
    'file'=>(string)$plik_wystapienia,'line'=>intval($linia),
    'ip_hash'=>hash('sha256', SecurityService::clientIp().'|'.(getenv('GRACZ_AUDIT_PEPPER') ?: 'local')),
    'url'=>isset($_SERVER['REQUEST_URI']) ? SecurityService::redact($_SERVER['REQUEST_URI']) : '','request'=>$safeRequest
  );
  $plik = @fopen($path['log_errors_php'],'a+'); if (!$plik) return;
  fwrite($plik,json_encode($entry,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\r\n"); fclose($plik);
}
function UnhandledErrorsCatcher($errno,$errstr,$errfile,$errline){ if(in_array($errno,array(E_ERROR,E_WARNING,E_PARSE,E_RECOVERABLE_ERROR),true)) savePHPError($errno,$errstr,$errfile,$errline); return false; }
function UnhandledExceptionsCatcher($exception)
{
  global $path; $plik=@fopen($path['log_exceptions_php'],'a+'); if(!$plik) return;
  $safe=array('time'=>gmdate('c'),'type'=>get_class($exception),'message'=>SecurityService::redact($exception->getMessage()),'file'=>$exception->getFile(),'line'=>$exception->getLine());
  fwrite($plik,json_encode($safe,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\r\n"); fclose($plik); return false;
}
if($production_mode){ set_exception_handler('UnhandledExceptionsCatcher'); set_error_handler('UnhandledErrorsCatcher'); }

mb_internal_encoding('UTF-8'); date_default_timezone_set('Europe/Warsaw');
session_start(); SecurityService::initializeSessionState();
include_once($actual_path.'library_main.php');
DatabaseConnect();
header('Content-Type: text/html; charset=UTF-8;');

if(strpos(isset($_SERVER['REQUEST_URI'])?$_SERVER['REQUEST_URI']:'',$path['activate_account'])>0) Logout();

$komunikat_logowania='';
try {
  if(isset($_POST['buttonLogin'])){
    SecurityService::verifyOrigin();
    $legacyToken=isset($_POST['token'])?(string)$_POST['token']:'';
    if(!IsTokenValid($legacyToken)) throw new RuntimeException('Nieprawidłowy token bezpieczeństwa formularza.');
    if(!empty($_SESSION['login_requires_turnstile'])) TurnstileService::verifyRequest();
    $limiter=GraczRateLimiter(); $ip=SecurityService::clientIp();
    $loginIdentity=isset($_POST['login'])?strtolower(trim($_POST['login'])):'';
    $limiter->enforce('login-ip',$ip,20,900); $limiter->enforce('login-account',$loginIdentity,12,900);
    $remember=isset($_POST['remember_me'])?($_POST['remember_me']=='on'):(isset($_POST['pamietaj_sesje'])&&$_POST['pamietaj_sesje']=='on');
    $authorized=AuthorizeUser($_POST['login'],$_POST['password'],$remember);
    if($authorized){
      SecurityService::rotateSessionAfterAuthentication(); unset($_SESSION['login_requires_turnstile']);
      if(!empty($_SESSION['id'])) GraczSessions()->registerCurrent($_SESSION['id']);
      GraczAudit()->record('auth.login.success',isset($_SESSION['id'])?$_SESSION['id']:null,array('login'=>$loginIdentity));
    } else {
      $delay=$limiter->loginDelaySeconds($loginIdentity,$ip);
      if($delay>=15) $_SESSION['login_requires_turnstile']=true;
      GraczAudit()->record('auth.login.failed',null,array('login'=>$loginIdentity,'delay_seconds'=>$delay,'turnstile_required'=>!empty($_SESSION['login_requires_turnstile'])),'warning');
      if($delay>0) sleep($delay);
    }
  } else AuthorizeUser();
}catch(ExceptionRoot $e){ $komunikat_logowania=$e; }
catch(Exception $e){ $komunikat_logowania=htmlspecialchars($e->getMessage(),ENT_QUOTES,'UTF-8'); }

if(!empty($_SESSION['initiated'])&&!empty($_SESSION['id'])){
  try{
    if(!GraczSessions()->validateCurrent($_SESSION['id'])){
      GraczAudit()->record('auth.session.revoked_or_expired',$_SESSION['id'],array(),'warning'); Logout(); SecurityService::destroySession();
      http_response_code(401); exit('Sesja wygasła lub została unieważniona. Zaloguj się ponownie.');
    }
  }catch(Exception $e){}
}

ProtectAgainstSessionHijacking();
if(IsIPAddressBlocked(SecurityService::clientIp())){ http_response_code(403); exit('Twój adres IP został zablokowany.'); }

$currentScript=basename(isset($_SERVER['SCRIPT_NAME'])?$_SERVER['SCRIPT_NAME']:'');

// Moderator/admin/owner must complete 2FA immediately after password authentication.
if(!empty($_SESSION['initiated'])&&!empty($_SESSION['id'])){
  $currentRole=RbacService::currentRole($database_handle,$database_prefix);
  if(TwoFactorService::roleRequires2fa($currentRole) && (empty($_SESSION['2fa_verified_at']) || time()-(int)$_SESSION['2fa_verified_at']>43200)){
    if(!in_array($currentScript,array('admin_2fa.php','wyloguj.php'),true)){
      GraczAudit()->record('auth.2fa.required',$_SESSION['id'],array('role'=>$currentRole));
      if(!headers_sent()) header('Location: '.$directory['base'].'admin_2fa.php');
      exit('To konto wymaga weryfikacji 2FA. <a href="admin_2fa.php">Przejdź do weryfikacji</a>.');
    }
  }
}

// Central RBAC gate. Each privileged route gets only the permission it actually needs.
$privilegedPermissions=array(
  'admin_panel_secure.php'=>'audit.read','service_administration_panel.php'=>'audit.read','mailing.php'=>'content.manage',
  'admin_reported_abuses.php'=>'moderation.review','admin_reported_bugs.php'=>'content.manage','advertisement_management.php'=>'content.manage',
  'code_paste_management.php'=>'content.manage','gry_dodaj.php'=>'content.manage','daily.php'=>'audit.read','moderator_panel.php'=>'moderation.review'
);
if(isset($privilegedPermissions[$currentScript])){
  GraczRequirePermission($privilegedPermissions[$currentScript]);
  GraczRequireAdmin2fa();
  if($currentScript==='service_administration_panel.php'&&(isset($_GET['block'])||isset($_GET['unblock']))){
    GraczAudit()->record('admin.legacy_get_mutation.blocked',isset($_SESSION['id'])?$_SESSION['id']:null,array('script'=>$currentScript),'warning');
    http_response_code(405); exit('Ta operacja administracyjna wymaga bezpiecznego formularza POST.');
  }
  GraczAudit()->record('admin.area.access',isset($_SESSION['id'])?$_SESSION['id']:null,array('script'=>$currentScript,'permission'=>$privilegedPermissions[$currentScript]));
}

if(isset($_REQUEST['facebookRegister'])) facebookRedirectToFacebookLoginPage();
if(isset($_REQUEST['error_reason'])&&$_REQUEST['error_reason']=='user_denied') header('Location: '.$service_base_address."\r\n");
ZapiszAdresIPInternauty();
