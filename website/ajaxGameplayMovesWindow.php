<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>
<?php
header('X-Content-Type-Options: nosniff');

function h_move($value)
{
  return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < USER)
{
  http_response_code(403);
  echo('Brak dostępu.');
  include_once($actual_path."wykonanie_procedur_koncowych.php");
  exit();
}

try
{
  $id_gameplay = isset($_GET['id_gameplay']) ? intval($_GET['id_gameplay']) : 0;
  if ($id_gameplay <= 0) {
    throw new ExceptionInvalidData();
  }

  $moves = getGameplayMoves($id_gameplay);
  echo('<h1>Rozgrywka #'.$id_gameplay.'</h1>');
  echo('<table><thead><tr><th>#</th><th>Ruch wykonał</th><th>Ruch</th><th>Znacznik czasu</th></tr></thead><tbody>');

  foreach($moves as $move)
  {
    $moveId = intval(isset($move['id']) ? $move['id'] : 0);
    $loginRaw = isset($move['login']) ? (string)$move['login'] : '';
    $loginText = h_move($loginRaw);
    $loginUrl = rawurlencode($loginRaw);
    $moveText = h_move(isset($move['move']) ? $move['move'] : '');
    $timestamp = h_move(isset($move['timestamp']) ? $move['timestamp'] : '');

    echo('<tr><td>'.$moveId.'</td><td><a href="'.h_move($path['profile']).'-'.$loginUrl.'" target="_blank" rel="noopener noreferrer">'.$loginText.'</a></td><td>'.$moveText.'</td><td>'.$timestamp.'</td></tr>');
  }

  echo('</tbody></table>');
}
catch(ExceptionNoResults $e)
{
  http_response_code(404);
  echo('Podana rozgrywka nie istnieje.');
}
catch(Exception $e)
{
  http_response_code(400);
  echo('Nie udało się pobrać zapisu rozgrywki.');
}
?>
<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>