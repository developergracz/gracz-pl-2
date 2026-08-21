<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

  <?php
    //header('Content-Type: application/json');

    switch ($_REQUEST['action'])
    {
    
      case 'add':
      {
        try{
          AddToFriendList($_REQUEST['id_user'], $_REQUEST['token']);
          echo(json_encode(array(
            'state' => 'added',
            'id_user_friend' => intval($_REQUEST['id_user'])
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
      
    
      case 'remove':
      {
        try{
          DeleteFromFriendList($_REQUEST['id_user'], $_REQUEST['token']);
          echo(json_encode(array(
            'state' => 'removed',
            'id_user_friend' => intval($_REQUEST['id_user'])
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
          
    }
  ?>

<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>