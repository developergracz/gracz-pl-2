<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

  <?php
    //header('Content-Type: application/json');

    switch ($_REQUEST['action'])
    {

      case 'report':
      {
        try{
          ReportAbuse($_REQUEST['address'], $_REQUEST['description'], $_REQUEST['token']);
          echo(json_encode(array(
            'state' => 'reported',
            'message' => 'Twoje zgłoszenie zostało przyjęte. Dziękujemy!'
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


      case 'delete':
      {
        try{
          DeleteAbuseReport($_REQUEST['id_abuse'], $_REQUEST['token']);
          echo(json_encode(array(
            'state' => 'deleted'
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
          'message' => 'Unsupported action.'
        )));
        break;
      }

    }
  ?>

<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>