<?php
include("variables_local.php");
include_once($actual_path."wykonanie_procedur_startowych.php");
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function bug_json($status, $payload) { http_response_code($status); echo json_encode($payload); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Allow: POST');
  bug_json(405, array('state'=>'error','message'=>'Method not allowed.'));
  include_once($actual_path."wykonanie_procedur_koncowych.php"); exit;
}
if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < USER) {
  bug_json(403, array('state'=>'error','message'=>'Wymagane zalogowanie.'));
  include_once($actual_path."wykonanie_procedur_koncowych.php"); exit;
}
$action = isset($_POST['action']) ? (string)$_POST['action'] : '';
$token = isset($_POST['token']) ? (string)$_POST['token'] : '';
if (!isset($_SESSION['token']) || !is_string($_SESSION['token']) || !hash_equals($_SESSION['token'], $token)) {
  bug_json(403, array('state'=>'error','message'=>'Nieprawidłowy token bezpieczeństwa.'));
  include_once($actual_path."wykonanie_procedur_koncowych.php"); exit;
}

try {
  if ($action === 'report') {
    $address = trim(isset($_POST['address']) ? (string)$_POST['address'] : '');
    $requestData = isset($_POST['request_data']) ? (string)$_POST['request_data'] : '';
    $browser = trim(isset($_POST['browser']) ? (string)$_POST['browser'] : '');
    $description = trim(isset($_POST['description']) ? (string)$_POST['description'] : '');
    if (strlen($address) > 2048 || strlen($requestData) > 12000 || mb_strlen($browser,'UTF-8') > 512 || mb_strlen($description,'UTF-8') > 4000)
      throw new Exception('Zgłoszenie jest zbyt długie.');
    $stmt = $database_handle->prepare('INSERT INTO '.$database_prefix.'_bug_notifications (id_user, description, address, request_data, browser, date_add) VALUES (:user_id, :description, :address, :request_data, :browser, CURRENT_TIMESTAMP())');
    $stmt->execute(array(':user_id'=>intval($_SESSION['id']), ':description'=>$description, ':address'=>$address, ':request_data'=>$requestData, ':browser'=>$browser));
    bug_json(200, array('state'=>'reported','message'=>'Twoje zgłoszenie zostało przyjęte. Dziękujemy!'));
  } elseif ($action === 'delete') {
    if ($_SESSION['account_type'] < ADMINISTRATOR) throw new Exception('Brak uprawnień.');
    $id = intval(isset($_POST['id_bug']) ? $_POST['id_bug'] : 0);
    if ($id <= 0) throw new Exception('Nieprawidłowy identyfikator.');
    $stmt = $database_handle->prepare('DELETE FROM '.$database_prefix.'_bug_notifications WHERE id = :id LIMIT 1');
    $stmt->execute(array(':id'=>$id));
    bug_json(200, array('state'=>'deleted'));
  } else {
    bug_json(400, array('state'=>'error','message'=>'Unsupported action.'));
  }
} catch (Exception $e) {
  error_log('Bug endpoint error: '.get_class($e));
  bug_json(400, array('state'=>'error','message'=>'Nie udało się wykonać operacji.'));
}
include_once($actual_path."wykonanie_procedur_koncowych.php");
?>
