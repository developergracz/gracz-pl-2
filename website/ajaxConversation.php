<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>
<?php
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
$input = $method === 'POST' ? $_POST : $_GET;
$action = isset($input['action']) ? $input['action'] : '';
$mutating = array('send', 'show_desktop_notifications', 'play_new_message_sound');

if (in_array($action, $mutating, true) && $method !== 'POST') {
  http_response_code(405);
  echo(json_encode(array('state' => 'error', 'message' => 'Ta operacja wymaga metody POST.')));
  include_once($actual_path."wykonanie_procedur_koncowych.php");
  exit();
}

function sanitizeLegacyConversationMessage($message)
{
  $message = trim((string)$message);
  if ($message === '') {
    throw new ExceptionInvalidData('Wiadomość nie może być pusta.');
  }
  if (mb_strlen($message, 'UTF-8') > 1024) {
    throw new ExceptionInvalidData('Wiadomość jest zbyt długa.');
  }

  // Legacy renderer supports BBCode that can create arbitrary href/src values.
  // Disable URL/image BBCode in user messages until the renderer is replaced.
  $message = preg_replace('/\[(?:\/)?(?:url|img)(?:=[^\]]*)?\]/iu', '', $message);

  // Never persist raw HTML from the client in the legacy conversation store.
  $message = strip_tags($message);

  // Remove control characters except tab/newline/carriage return.
  $message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $message);

  return trim($message);
}

switch ($action)
{
  case 'receive':
    try
    {
      $messages = ReceiveConversationsWithUser(
        isset($input['id_last_message']) ? $input['id_last_message'] : 0,
        isset($input['id_user_interlocutor']) ? $input['id_user_interlocutor'] : 0,
        isset($input['update_last_downloaded_message_id']) ? $input['update_last_downloaded_message_id'] : 0,
        isset($input['token']) ? $input['token'] : ''
      );
      echo(json_encode(array(
        'state' => 'received',
        'messages_from_id_and_above' => intval(isset($input['id_last_message']) ? $input['id_last_message'] : 0),
        'messages' => $messages
      )));
    }catch(Exception $e)
    {
      echo(json_encode(array('state' => 'error', 'message' => $e->getMessage())));
    }
  break;

  case 'send':
    try
    {
      $safeMessage = sanitizeLegacyConversationMessage(isset($_POST['message']) ? $_POST['message'] : '');
      SendMessageToUser(
        isset($_POST['id_user_recipient']) ? $_POST['id_user_recipient'] : 0,
        $safeMessage,
        isset($_POST['token']) ? $_POST['token'] : ''
      );
      echo(json_encode(array('state' => 'sent')));
    }catch(Exception $e)
    {
      echo(json_encode(array('state' => 'error', 'message' => $e->getMessage())));
    }
  break;

  case 'show_desktop_notifications':
    try
    {
      ChangeUserProfileSetting('show_desktop_notifications', isset($_POST['value']) ? $_POST['value'] : 0);
      echo(json_encode(array('state' => 'set', 'value' => $_SESSION['show_desktop_notifications'])));
    }catch(Exception $e)
    {
      echo(json_encode(array('state' => 'error', 'message' => $e->getMessage())));
    }
  break;

  case 'play_new_message_sound':
    try
    {
      ChangeUserProfileSetting('play_new_message_sound', isset($_POST['value']) ? $_POST['value'] : 0);
      echo(json_encode(array('state' => 'set', 'value' => $_SESSION['play_new_message_sound'])));
    }catch(Exception $e)
    {
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