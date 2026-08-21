<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

  <?php
    //header('Content-Type: application/json');

    switch ($_REQUEST['action'])
    {
    
      case 'block':
      {
        try{
          AddToBlackList($_REQUEST['id_user'], $_REQUEST['token']);
          echo(json_encode(array(
            'state' => 'blocked',
            'id_user_blacklist' => intval($_REQUEST['id_user'])
          )));
        }catch (Exception $e)
        {
          echo(json_encode(array(
            'state' => 'error',
            'message' => $e->getMessage()
          )));
        }
      
        break;
      }
      
    
      case 'unblock':
      {
        try{
          DeleteFromBlackList($_REQUEST['id_user'], $_REQUEST['token']);
          echo(json_encode(array(
            'state' => 'unblocked',
            'id_user_blacklist' => intval($_REQUEST['id_user'])
          )));
          
        }catch (Exception $e)
        {
          echo(json_encode(array(
            'state' => 'error',
            'message' => $e->getMessage()
          )));
        }      
        break;
      }
    
      default:
      {
        echo(json_encode(array(
          'state' => 'error',
          'message' => 'Action not supported.'
        )));
        break;
      }
          
    }
    
  ?>

<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>