<?php
include("variables_local.php");
include_once($actual_path."wykonanie_procedur_startowych.php");

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  header('Allow: POST');
  echo json_encode(array(
    'state' => 'error',
    'message' => 'Method not allowed.'
  ));
  include_once($actual_path."wykonanie_procedur_koncowych.php");
  exit;
}

$action = isset($_POST['action']) ? (string)$_POST['action'] : '';

switch ($action)
{
  case 'report':
  {
    try{
      ReportAbuse(
        isset($_POST['address']) ? $_POST['address'] : '',
        isset($_POST['description']) ? $_POST['description'] : '',
        isset($_POST['token']) ? $_POST['token'] : ''
      );
      echo(json_encode(array(
        'state' => 'reported',
        'message' => 'Twoje zgłoszenie zostało przyjęte. Dziękujemy!'
      )));
    }catch (Exception $e)
    {
      http_response_code(400);
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
      DeleteAbuseReport(
        isset($_POST['id_abuse']) ? $_POST['id_abuse'] : '',
        isset($_POST['token']) ? $_POST['token'] : ''
      );
      echo(json_encode(array(
        'state' => 'deleted'
      )));
    }catch (Exception $e)
    {
      http_response_code(400);
      echo(json_encode(array(
        'state' => 'error',
        'message' => $e->getMessage()
      )));
    }
    break;
  }

  default:
  {
    http_response_code(400);
    echo(json_encode(array(
      'state' => 'error',
      'message' => 'Unsupported action.'
    )));
    break;
  }
}

include_once($actual_path."wykonanie_procedur_koncowych.php");
?>