<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

  <?php

  switch ($_REQUEST['action'])
  {
    case 'receive':
      try
      {
        $messages = ReceiveConversationsWithUser( $_REQUEST['id_last_message'], $_REQUEST['id_user_interlocutor'], $_REQUEST['update_last_downloaded_message_id'], $_REQUEST['token']);
        echo(json_encode(array(
          'state' => 'received',
          'messages_from_id_and_above' => intval($_REQUEST['id_last_message']),
          'messages' => $messages
        )));
      }catch(Exception $e)
      {
        echo(json_encode(array(
          'state' => 'error',
          'message' => $e->getMessage()
        )));
      }
    break;

    case 'send':
      try
      {
        SendMessageToUser($_REQUEST['id_user_recipient'], $_REQUEST['message'], $_REQUEST['token']);
        echo(json_encode(array(
          'state' => 'sent'
        )));
      }catch(Exception $e)
      {
        echo(json_encode(array(
          'state' => 'error',
          'message' => $e->getMessage()
        )));
      }
    break;

    case 'show_desktop_notifications':
      try
      {
        ChangeUserProfileSetting('show_desktop_notifications', $_REQUEST['value']);
        echo(json_encode(array(
          'state' => 'set',
          'value' => $_SESSION['show_desktop_notifications']
        )));
      }catch(Exception $e)
      {
        echo(json_encode(array(
          'state' => 'error',
          'message' => $e->getMessage()
        )));
      }
    break;

    case 'play_new_message_sound':
      try
      {
        ChangeUserProfileSetting('play_new_message_sound', $_REQUEST['value']);
        echo(json_encode(array(
          'state' => 'set',
          'value' => $_SESSION['play_new_message_sound']
        )));
      }catch(Exception $e)
      {
        echo(json_encode(array(
          'state' => 'error',
          'message' => $e->getMessage()
        )));
      }
    break;

    default:
        echo(json_encode(array(
          'state' => 'error',
          'message' => 'Nieprawidłowa akcja.'
        )));
    break;
  }

  ?>


<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>