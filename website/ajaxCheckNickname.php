<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php");
header('Content-Type: application/json; charset=UTF-8');
try {
    SecurityService::verifyOrigin();
    GraczRateLimiter()->enforce('nickname-check-ip', SecurityService::clientIp(), 30, 60);
    $login = SecurityService::validateLogin(isset($_REQUEST['login']) ? $_REQUEST['login'] : '');
    $moderation = ModerationService::nickname($login);
    ModerationService::recordDecision($database_handle, $database_prefix, null, 'nickname', $moderation);
    if ($moderation['decision'] !== 'allow') {
        echo json_encode(array('available'=>false,'reason'=>'moderation'));
        exit;
    }
    $stmt = $database_handle->prepare('SELECT 1 FROM '.$database_prefix.'_users WHERE login = :login LIMIT 1');
    $stmt->execute(array(':login'=>$login));
    echo json_encode(array('available'=>$stmt->fetchColumn() ? false : true));
} catch(Exception $e) {
    http_response_code($e instanceof InvalidArgumentException ? 400 : 429);
    echo json_encode(array('available'=>false,'reason'=>'invalid_or_limited'));
}
include_once($actual_path."wykonanie_procedur_koncowych.php");