<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

  <?php

  switch ($_REQUEST['action'])
  {

    case 'getInvitations':
      try
      {
        $invitations = getInvitationsList(false, $_REQUEST['setAsRead']==1);
        echo(json_encode(array(
            'invitations' => $invitations
        )));
      }catch(Exception $e)
      {
        echo(json_encode(array(
            'state' => 'error',
            'message' => $e->getMessage()
        )));
      }
      break;

    case 'setInvitationAsRead':
      try{
        setInvitationAsRead($_REQUEST['id_invitation']);
        echo(json_encode(array(
            'state' => 'ok'
        )));
      }catch (Exception $e) {
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