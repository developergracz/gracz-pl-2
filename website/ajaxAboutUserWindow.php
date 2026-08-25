<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>
<?php
header('X-Content-Type-Options: nosniff');

function h_about($value)
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
  $id_user = isset($_GET['id_user']) ? intval($_GET['id_user']) : 0;
  if ($id_user <= 0) {
    throw new ExceptionInvalidData();
  }

  $row = getUserDataFromId($id_user);
  $id = intval($row['id']);
  $loginText = h_about($row['login']);
  $loginUrl = rawurlencode((string)$row['login']);
  $tokenAttr = h_about(isset($_SESSION['token']) ? $_SESSION['token'] : '');

  echo('<a href="'.h_about($path['profile']).'-'.$loginUrl.'" class="button_normal" id="visit_profile_button">Odwiedź profil</a>');
  echo('<h2><span class="profile_field"><img src="'.h_about($directory['design']).'users.png" alt="" /> '.$loginText.'</span></h2>');
  echo('<div id="tabs_profile_information"><div class="sex">'.($row['sex']==SEX_FEMALE?'kobieta':'mężczyzna').'</div>');

  $last_seen_value = isset($row['last_seen']) ? floatval($row['last_seen']) : 0;
  $last_seen = 'Przed sekundką';
  if ($last_seen_value>0) $last_seen = round($last_seen_value).' sekund temu';
  if ($last_seen_value>60) $last_seen = round($last_seen_value/60).' minut temu';
  if ($last_seen_value>3600) $last_seen = round($last_seen_value/3600).' godzin temu';
  if ($last_seen_value>3600*24) $last_seen = round($last_seen_value/3600.0/24.0).' dni temu';
  if ($last_seen_value>31536000) $last_seen = round($last_seen_value/31536000).' lat temu';

  $plays_count = intval(isset($row['plays_count']) ? $row['plays_count'] : 0);
  $won = intval(isset($row['won']) ? $row['won'] : 0);
  $lost = intval(isset($row['lost']) ? $row['lost'] : 0);
  $scores_sum = intval(isset($row['scores_sum']) ? $row['scores_sum'] : 0);
  $ranking_pos = isset($row['ranking_pos']) && $row['ranking_pos'] !== '' ? h_about($row['ranking_pos']) : 'Użytkownik nie rozegrał jeszcze ani jednej partii.';
  $procent_wygranych = $plays_count > 0 ? round((100*$won)/$plays_count,1) : 0;
  $date_register = h_about(isset($row['date_register']) ? $row['date_register'] : '');

  echo('<table>');
  echo('<tr><td>Miejsce w rankingu</td><td>'.$ranking_pos.'</td></tr>');
  echo('<tr><td>Punktacja</td><td>'.$scores_sum.' pkt.</td></tr>');
  echo('<tr><td>Ilość rozgrywek</td><td>'.$plays_count.'</td></tr>');
  echo('<tr><td class="indent">w tym wygranych</td><td>'.$won.' ('.$procent_wygranych.'%)</td></tr>');
  echo('<tr><td class="indent">w tym przegranych</td><td>'.$lost.'</td></tr>');
  echo('<tr><td>Ostatnio widziany</td><td>'.h_about($last_seen).' (czas przybliżony)</td></tr>');
  echo('<tr><td>Data rejestracji</td><td>'.$date_register.'</td></tr>');
  echo('</table>');

  if ($id !== intval($_SESSION['id']))
  {
    echo('<br /><a href="'.h_about($path['conversation']).'-'.$loginUrl.'" class="button_normal small">Wyślij wiadomość</a>');

    if (!IsFriendship($id))
      echo('<a href="#" class="button_normal small friends" data-id_user="'.$id.'" data-token="'.$tokenAttr.'">Dodaj do znajomych</a>');
    else
      echo('<a href="#" class="button_hot small friends" data-id_user="'.$id.'" data-token="'.$tokenAttr.'">Usuń ze znajomych</a>');

    if (!IsInUserBlacklist($id))
      echo('<a href="#" class="button_normal small blacklist" data-id_user="'.$id.'" data-token="'.$tokenAttr.'">Zablokuj</a>');
    else
      echo('<a href="#" class="button_hot small blacklist" data-id_user="'.$id.'" data-token="'.$tokenAttr.'">Odblokuj</a>');

    echo('<script type="text/javascript">jQuery(document).ready(function(){ initiateControlsEvents(); });</script>');
  }
}
catch(ExceptionNoResults $e)
{
  http_response_code(404);
  echo('Podany użytkownik nie istnieje.');
}
catch(Exception $e)
{
  http_response_code(400);
  echo('Nie udało się pobrać danych użytkownika.');
}
?>
<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>