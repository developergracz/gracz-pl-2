<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>
<?php
header('Content-Type: application/json; charset=UTF-8');

$action = isset($_REQUEST['action']) ? (string)$_REQUEST['action'] : '';

switch ($action)
{
  case 'receive':
    try
    {
      SecurityRequireRateLimit('messages_receive', 120, 60, 60, isset($_SESSION['id']) ? 'user:'.$_SESSION['id'] : SecurityClientIp());
      $messages = ReceiveConversationsWithUser(
        intval(isset($_REQUEST['id_last_message']) ? $_REQUEST['id_last_message'] : 0),
        intval(isset($_REQUEST['id_user_interlocutor']) ? $_REQUEST['id_user_interlocutor'] : 0),
        !empty($_REQUEST['update_last_downloaded_message_id']),
        isset($_REQUEST['token']) ? $_REQUEST['token'] : ''
      );
      echo(json_encode(array(
        'state' => 'received',
        'messages_from_id_and_above' => intval(isset($_REQUEST['id_last_message']) ? $_REQUEST['id_last_message'] : 0),
        'messages' => $messages
      )));
    }catch(Exception $e)
    {
      echo(json_encode(array('state'=>'error','message'=>'Nie udało się pobrać wiadomości.')));
    }
  break;

  case 'send':
    try
    {
      if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        throw new RuntimeException('Niedozwolona metoda.');
      }
      $actor = isset($_SESSION['id']) ? 'user:'.intval($_SESSION['id']) : SecurityClientIp();
      SecurityRequireRateLimit('messages_send_minute', 20, 60, 300, $actor);
      SecurityRequireRateLimit('messages_send_hour', 200, 3600, 3600, $actor);

      $recipient = intval(isset($_POST['id_user_recipient']) ? $_POST['id_user_recipient'] : 0);
      $message = isset($_POST['message']) ? trim((string)$_POST['message']) : '';
      if ($recipient <= 0) throw new RuntimeException('Nieprawidłowy odbiorca.');
      if ($message === '') throw new RuntimeException('Wiadomość nie może być pusta.');
      if (mb_strlen($message, 'UTF-8') > 4000) throw new RuntimeException('Wiadomość jest zbyt długa.');

      // Legacy chat nie posiada bezpiecznego sanitizera HTML. Do czasu wdrożenia whitelisty RTF
      // przyjmujemy wyłącznie tekst. Eliminuje to XSS/HTML injection i złośliwe znaczniki.
      $message = strip_tags($message);
      $message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $message);

      SendMessageToUser($recipient, $message, isset($_POST['token']) ? $_POST['token'] : '');
      AuditLog('message.sent', 'user', $recipient, array('length'=>mb_strlen($message, 'UTF-8')));
      echo(json_encode(array('state' => 'sent')));
    }catch(Exception $e)
    {
      echo(json_encode(array('state'=>'error','message'=>htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8'))));
    }
  break;

  case 'show_desktop_notifications':
  case 'play_new_message_sound':
    try
    {
      if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        throw new RuntimeException('Niedozwolona metoda.');
      }
      SecurityRequireRateLimit('profile_settings', 30, 60, 300, isset($_SESSION['id']) ? 'user:'.$_SESSION['id'] : SecurityClientIp());
      $field = $action === 'show_desktop_notifications' ? 'show_desktop_notifications' : 'play_new_message_sound';
      $value = !empty($_POST['value']) ? 1 : 0;
      ChangeUserProfileSetting($field, $value);
      AuditLog('profile.setting_changed', 'user', isset($_SESSION['id']) ? $_SESSION['id'] : null, array('field'=>$field));
      echo(json_encode(array('state'=>'set','value'=>$value)));
    }catch(Exception $e)
    {
      echo(json_encode(array('state'=>'error','message'=>'Nie udało się zmienić ustawienia.')));
    }
  break;

  default:
    http_response_code(400);
    echo(json_encode(array('state'=>'error','message'=>'Nieprawidłowa akcja.')));
  break;
}
?>
<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>