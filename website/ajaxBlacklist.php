<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>
<?php
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
if (!isset($_SERVER['REQUEST_METHOD']) || strtoupper($_SERVER['REQUEST_METHOD']) !== 'POST') {
  http_response_code(405);
  echo(json_encode(array('state' => 'error', 'message' => 'Ta operacja wymaga metody POST.')));
  include_once($actual_path."wykonanie_procedur_koncowych.php");
  exit();
}
$action = isset($_POST['action']) ? $_POST['action'] : '';
$idUser = isset($_POST['id_user']) ? intval($_POST['id_user']) : 0;
$token = isset($_POST['token']) ? $_POST['token'] : '';

switch ($action)
{
  case 'block':
    try{
      AddToBlackList($idUser, $token);
      echo(json_encode(array('state' => 'blocked', 'id_user_blacklist' => $idUser)));
    }catch (Exception $e)
    {
      echo(json_encode(array('state' => 'error', 'message' => $e->getMessage())));
    }
  break;

  case 'unblock':
    try{
      DeleteFromBlackList($idUser, $token);
      echo(json_encode(array('state' => 'unblocked', 'id_user_blacklist' => $idUser)));
    }catch (Exception $e)
    {
      echo(json_encode(array('state' => 'error', 'message' => $e->getMessage())));
    }
  break;

  default:
    http_response_code(400);
    echo(json_encode(array('state' => 'error', 'message' => 'Action not supported.')));
  break;
}
?>
<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>