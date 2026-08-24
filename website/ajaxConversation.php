<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>
<?php
header('Content-Type: application/json; charset=UTF-8');
$action = isset($_REQUEST['action']) ? (string)$_REQUEST['action'] : '';

try {
  if (empty($_SESSION['initiated']) || empty($_SESSION['id'])) {
    http_response_code(401);
    throw new RuntimeException('Wymagane logowanie.');
  }

  switch ($action) {
    case 'receive':
      GraczRateLimiter()->enforce('messages-receive-user', (string)$_SESSION['id'], 240, 60);
      $lastId = isset($_REQUEST['id_last_message']) ? max(0, intval($_REQUEST['id_last_message'])) : 0;
      $interlocutor = isset($_REQUEST['id_user_interlocutor']) ? max(1, intval($_REQUEST['id_user_interlocutor'])) : 0;
      $update = !empty($_REQUEST['update_last_downloaded_message_id']);
      $legacyToken = isset($_REQUEST['token']) ? (string)$_REQUEST['token'] : '';
      $messages = ReceiveConversationsWithUser($lastId, $interlocutor, $update, $legacyToken);
      echo json_encode(array('state'=>'received','messages_from_id_and_above'=>$lastId,'messages'=>$messages));
      break;

    case 'send':
      SecurityService::verifyOrigin();
      $recipient = isset($_REQUEST['id_user_recipient']) ? intval($_REQUEST['id_user_recipient']) : 0;
      if ($recipient <= 0 || $recipient === intval($_SESSION['id'])) {
        throw new InvalidArgumentException('Nieprawidłowy odbiorca.');
      }
      $legacyToken = isset($_REQUEST['token']) ? (string)$_REQUEST['token'] : '';
      if (!IsTokenValid($legacyToken)) {
        http_response_code(403);
        throw new RuntimeException('Nieprawidłowy token bezpieczeństwa.');
      }
      $limiter = GraczRateLimiter();
      $limiter->enforce('messages-send-user', (string)$_SESSION['id'], 30, 60);
      $limiter->enforce('messages-send-recipient', $_SESSION['id'].'|'.$recipient, 12, 60);

      $result = ModerationService::message(isset($_REQUEST['message']) ? $_REQUEST['message'] : '');
      ModerationService::recordDecision($database_handle, $database_prefix, $_SESSION['id'], 'message', $result);
      if ($result['decision'] === 'block') {
        GraczAudit()->record('message.blocked', $_SESSION['id'], array('recipient'=>$recipient,'content_hash'=>$result['hash']), 'warning');
        throw new RuntimeException('Wiadomość została odrzucona przez zabezpieczenia.');
      }
      SendMessageToUser($recipient, $result['value'], $legacyToken);
      GraczAudit()->record('message.sent', $_SESSION['id'], array('recipient'=>$recipient,'content_hash'=>$result['hash'],'moderation'=>$result['decision']));
      echo json_encode(array('state'=>'sent','moderation'=>$result['decision']));
      break;

    case 'show_desktop_notifications':
    case 'play_new_message_sound':
      SecurityService::verifyOrigin();
      $legacyToken = isset($_REQUEST['token']) ? (string)$_REQUEST['token'] : '';
      if (!IsTokenValid($legacyToken)) {
        http_response_code(403);
        throw new RuntimeException('Nieprawidłowy token bezpieczeństwa.');
      }
      $value = isset($_REQUEST['value']) ? intval((bool)$_REQUEST['value']) : 0;
      ChangeUserProfileSetting($action, $value);
      echo json_encode(array('state'=>'set','value'=>$value));
      break;

    default:
      http_response_code(400);
      throw new InvalidArgumentException('Nieprawidłowa akcja.');
  }
} catch (Exception $e) {
  echo json_encode(array('state'=>'error','message'=>htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8')));
}
?>
<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>