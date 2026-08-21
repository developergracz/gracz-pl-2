<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

  <?php
    //header('Content-Type: application/json');

    switch ($_REQUEST['action'])
    {
    
      case 'reset':
      {
        try{
          AdvertisementsResetCounter($_REQUEST['token'], $_REQUEST['id_advertisement']);
          echo(json_encode(array(
            'state' => 'reseted'
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
      
    
      case 'change_purchased_views':
      {       
        try{
          AdvertisementsChangePurchasedViews($_REQUEST['token'], $_REQUEST['id_advertisement'], $_REQUEST['purchased_views']);
          echo(json_encode(array(
            'state' => 'changed'
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
    
      case 'change_remaining_views':
      {       
        try{
          AdvertisementsChangeRemainingViews($_REQUEST['token'], $_REQUEST['id_advertisement'], $_REQUEST['remaining_views']);
          echo(json_encode(array(
            'state' => 'changed'
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