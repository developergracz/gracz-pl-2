<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php");
header('Content-Type: application/json; charset=UTF-8');
try {
    if(empty($_SESSION['initiated'])||empty($_SESSION['id'])){ http_response_code(401); throw new RuntimeException('Wymagane logowanie.'); }
    if($_SERVER['REQUEST_METHOD']!=='POST'){ http_response_code(405); throw new RuntimeException('Dozwolona jest tylko metoda POST.'); }
    SecurityService::verifyStateChangingRequest();
    GraczRateLimiter()->enforce('upload-user',(string)$_SESSION['id'],10,3600);
    GraczRateLimiter()->enforce('upload-ip',SecurityService::clientIp(),30,3600);
    if(empty($_FILES['file'])) throw new InvalidArgumentException('Brak pliku.');
    $destination=$actual_path.'uploads/private';
    $stored=UploadSecurityService::store($_FILES['file'],$destination,5242880);
    $moderation=array('decision'=>'allow','value'=>$stored['filename'],'reason'=>null,'hash'=>hash('sha256',$stored['filename']));
    ModerationService::recordDecision($database_handle,$database_prefix,$_SESSION['id'],'upload',$moderation);
    GraczAudit()->record('upload.stored',$_SESSION['id'],array('mime'=>$stored['mime'],'size'=>$stored['size'],'file_hash'=>$moderation['hash']));
    echo json_encode(array('state'=>'stored','file'=>$stored['filename'],'mime'=>$stored['mime'],'size'=>$stored['size']));
}catch(Exception $e){
    if(http_response_code()<400) http_response_code(400);
    GraczAudit()->record('upload.rejected',isset($_SESSION['id'])?$_SESSION['id']:null,array('type'=>get_class($e)),'warning');
    echo json_encode(array('state'=>'error','message'=>'Plik został odrzucony przez zabezpieczenia.'));
}
include_once($actual_path."wykonanie_procedur_koncowych.php");