<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>
<?php
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
$input = $method === 'POST' ? $_POST : $_GET;
$action = isset($input['action']) ? $input['action'] : '';

if ($action === 'setInvitationAsRead' && $method !== 'POST') {
  http_response_code(405);
  echo(json_encode(array('state' => 'error', 'message' => 'Ta operacja wymaga metody POST.')));
  include_once($actual_path."wykonanie_procedur_koncowych.php");
  exit();
}

switch ($action)
{
  case 'getInvitations':
    try
    {
      $setAsRead = isset($input['setAsRead']) && intval($input['setAsRead']) === 1;
      if ($setAsRead && $method !== 'POST') {
        http_response_code(405);
        echo(json_encode(array('state' => 'error', 'message' => 'Zmiana stanu zaproszeń wymaga metody POST.')));
        break;
      }
      $invitations = getInvitationsList(false, $setAsRead);
      echo(json_encode(array('invitations' => $invitations)));
    }catch(Exception $e)
    {
      echo(json_encode(array('state' => 'error', 'message' => $e->getMessage())));
    }
  break;

  case 'setInvitationAsRead':
    try{
      setInvitationAsRead(isset($_POST['id_invitation']) ? intval($_POST['id_invitation']) : 0);
      echo(json_encode(array('state' => 'ok')));
    }catch (Exception $e) {
      echo(json_encode(array('state' => 'error', 'message' => $e->getMessage())));
    }
  break;

  default:
    http_response_code(400);
    echo(json_encode(array('state' => 'error', 'message' => 'Nieprawidłowa akcja.')));
  break;
}
?>
<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>