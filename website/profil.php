<?php include("variables_local.php"); include_once($header); ?>

<div class="box light">
  <div class="corner top left"></div>
  <div class="corner bottom left"></div>
  <div class="corner top right"></div>
  <div class="corner bottom right"></div>
  <div class="border top"></div>
  <div class="border bottom"></div>
  <div class="border left"></div>
  <div class="border right"></div>
  <div class="content">

<?php
function profile_h($value)
{
  return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function profile_login_url($login)
{
  return rawurlencode((string)$login);
}

try
{
  if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < USER) {
    throw new ExceptionAccessDenied();
  }

  $profile_login = isset($_GET['profile_login']) ? trim((string)$_GET['profile_login']) : '';
  if ($profile_login === '' && isset($_REQUEST['profile_login'])) {
    $profile_login = trim((string)$_REQUEST['profile_login']);
  }
  if (!preg_match('/^[a-z0-9ąęśćżźółń_]{1,32}$/iu', $profile_login)) {
    throw new ExceptionNoResults();
  }

  $row = getUserDataFromLogin($profile_login);
  $id = intval($row['id']);
  $isOwn = intval($_SESSION['id']) === $id;
  $loginRaw = (string)$row['login'];
  $login = profile_h($loginRaw);
  $loginUrl = profile_login_url($loginRaw);
  $token = profile_h(isset($_SESSION['token']) ? $_SESSION['token'] : '');

  echo('<h1>Profil '.$login.'</h1>');

  if ($isOwn)
  {
    echo('<div class="column_4"><h4>Dane personalne</h4>');
    echo('<h5>Imię</h5><span class="profile_field">'.profile_h(isset($row['name']) ? $row['name'] : '').'</span>');
    echo('<h5>Nazwisko</h5><span class="profile_field">'.profile_h(isset($row['surname']) ? $row['surname'] : '').'</span></div>');

    echo('<div class="column_4"><h4>Użytkownik</h4>');
    echo('<h5>Nazwa użytkownika</h5><span class="profile_field"><img src="'.profile_h($directory['design']).'users.png" alt="" /> '.$login.'</span>');
    echo('<h5>Płeć</h5><span class="profile_field">'.($row['sex']==SEX_MALE?'mężczyzna':'kobieta').'</span></div>');

    echo('<div class="column_4"><h4>Twój adres e-mail</h4>');
    echo('<h5>Adres e-mail</h5><span class="profile_field">'.profile_h(isset($row['email']) ? $row['email'] : '').'</span></div>');
    echo('<br /><br />');
  }
  else
  {
    $interval = ((new DateTime())->getTimestamp() - (new DateTime($row['date_last_visit']))->getTimestamp()) / 60.0;
    $isAvailable = $interval < $player_active_state_time_period;

    echo('<a href="'.profile_h($path['conversation']).'-'.$loginUrl.'" id="conversationWithUserButton" class="button_'.($isAvailable?'hot':'normal').'">Rozmowa</a>');
    echo('<div class="column_4" style="float:left;"><h4>Użytkownik</h4>');
    echo('<h5>Nazwa użytkownika</h5><span class="profile_field"><img src="'.profile_h($directory['design']).'users.png" alt="" /> '.$login.'</span>');
    echo('<h5>Płeć</h5><span class="profile_field">'.($row['sex']==SEX_MALE?'mężczyzna':'kobieta').'</span>');

    echo('<h5>Znajomi</h5>');
    echo('<a href="#" class="button_'.(IsFriendship($id)?'hot':'normal').' small friends" data-id_user="'.$id.'" data-token="'.$token.'">'.(IsFriendship($id)?'Usuń ze znajomych':'Dodaj do znajomych').'</a>');

    echo('<h5>Zablokowany</h5>');
    echo('<a href="#" class="button_'.(IsInUserBlacklist($id)?'hot':'normal').' small blacklist" data-id_user="'.$id.'" data-token="'.$token.'">'.(IsInUserBlacklist($id)?'Odblokuj':'Zablokuj').'</a>');

    if ($_SESSION['account_type'] >= ADMINISTRATOR)
    {
      $emailRaw = isset($row['email']) ? (string)$row['email'] : '';
      $ipRaw = isset($row['IP']) ? (string)$row['IP'] : '';
      $safeIpForUrl = rawurlencode($ipRaw);
      echo('<br /><br /><a href="#" onclick="jQuery(\'#secret_personal_info\').slideToggle(); return false;">Pokaż pełne dane osobowe</a>');
      echo('<div id="secret_personal_info" style="display:none">');
      echo('<h5>Identyfikator</h5><span class="profile_field">#'.$id.'</span>');
      echo('<h5>Imię</h5><span class="profile_field">'.profile_h(isset($row['name']) ? $row['name'] : '').'</span>');
      echo('<h5>Nazwisko</h5><span class="profile_field">'.profile_h(isset($row['surname']) ? $row['surname'] : '').'</span>');
      echo('<h5>Adres e-mail</h5><span class="profile_field"><a href="mailto:'.profile_h($emailRaw).'">'.profile_h($emailRaw).'</a></span>');
      echo('<h5>Ostatni adres IP</h5><span class="profile_field"><a href="https://who.is/whois-ip/ip-address/'.$safeIpForUrl.'" target="_blank" rel="noopener noreferrer">'.profile_h($ipRaw).'</a></span>');
      echo('<h5>Konto aktywowane?</h5><span class="profile_field">'.(intval($row['active'])===1?'tak':'nie').'</span>');
      echo('<h5>Konto zablokowane?</h5><span class="profile_field">'.(intval($row['blocked'])===1?'tak':'nie').'</span>');
      echo('<h5>Data ostatniej wizyty</h5><span class="profile_field">'.profile_h(isset($row['date_last_visit']) ? $row['date_last_visit'] : '').'</span>');
      echo('<h5>Data ostatniego logowania</h5><span class="profile_field">'.profile_h(isset($row['date_last_login']) ? $row['date_last_login'] : '').'</span>');
      echo('<h5>Data rejestracji</h5><span class="profile_field">'.profile_h(isset($row['date_register']) ? $row['date_register'] : '').'</span>');
      echo('</div>');
    }
    echo('</div>');
  }

  echo('<div id="tabs_profile" class="'.($isOwn?'':'window_at_right').'">');
  echo('<ul><li><a href="#tabs_profile_information">Informacje</a></li><li><a href="#tabs_profile_opponents">Przeciwnicy</a></li><li><a href="#tabs_profile_plays">Rozgrywki</a></li><li><a href="#tabs_profile_friends">Znajomi</a></li>');
  if ($isOwn) {
    echo('<li><a href="#tabs_profile_blacklist">Czarna lista</a></li><li><a href="#tabs_profile_last_interlocutors">Ostatnie rozmowy</a></li>');
  }
  echo('</ul>');

  $lastSeenValue = isset($row['last_seen']) ? floatval($row['last_seen']) : 0;
  $lastSeen = 'Przed sekundką';
  if ($lastSeenValue>0) $lastSeen = round($lastSeenValue).' sekund temu';
  if ($lastSeenValue>60) $lastSeen = round($lastSeenValue/60).' minut temu';
  if ($lastSeenValue>3600) $lastSeen = round($lastSeenValue/3600).' godzin temu';
  if ($lastSeenValue>86400) $lastSeen = round($lastSeenValue/86400).' dni temu';
  if ($lastSeenValue>31536000) $lastSeen = round($lastSeenValue/31536000).' lat temu';

  $playsCount = intval(isset($row['plays_count']) ? $row['plays_count'] : 0);
  $won = intval(isset($row['won']) ? $row['won'] : 0);
  $lost = intval(isset($row['lost']) ? $row['lost'] : 0);
  $scores = intval(isset($row['scores_sum']) ? $row['scores_sum'] : 0);
  $winPct = $playsCount > 0 ? round((100*$won)/$playsCount, 1) : 0;
  $ranking = isset($row['ranking_pos']) && $row['ranking_pos'] !== '' ? profile_h($row['ranking_pos']) : 'Użytkownik nie rozegrał jeszcze ani jednej partii.';

  echo('<div id="tabs_profile_information"><table style="margin:15pt;">');
  echo('<tr><td>Miejsce w rankingu</td><td>'.$ranking.'</td></tr>');
  echo('<tr><td>Punktacja</td><td>'.$scores.' pkt.</td></tr>');
  echo('<tr><td>Ilość rozgrywek</td><td>'.$playsCount.'</td></tr>');
  echo('<tr><td class="indent">w tym wygranych</td><td>'.$won.' ('.$winPct.'%)</td></tr>');
  echo('<tr><td class="indent">w tym przegranych</td><td>'.$lost.'</td></tr>');
  echo('<tr><td>Ostatnio widziany</td><td>'.profile_h($lastSeen).' (czas przybliżony)</td></tr>');
  echo('<tr><td>Data rejestracji</td><td>'.profile_h(isset($row['date_register']) ? $row['date_register'] : '').'</td></tr>');
  echo('</table></div>');

  echo('<div id="tabs_profile_opponents">');
  try {
    $opponents = getUserOpponents($profile_login);
    echo('Ilość dotychczasowych rywali: '.count($opponents).'<br /><br />');
    foreach($opponents as $opponent) {
      $oppLoginRaw = isset($opponent['login']) ? (string)$opponent['login'] : '';
      echo('<a href="'.profile_h($path['profile']).'-'.profile_login_url($oppLoginRaw).'" title="Ostatni bój stoczony '.profile_h(isset($opponent['date']) ? $opponent['date'] : '').'">'.profile_h($oppLoginRaw).'</a> ');
    }
  } catch(ExceptionNoResults $e) {
    echo('<div class="information">Jak na razie nie masz żadnych rywali.</div>');
  } catch(Exception $e) {
    echo('<div class="negative">Nie udało się pobrać listy rywali.</div>');
  }
  echo('</div>');

  echo('<div id="tabs_profile_plays">');
  try {
    $playsList = getPlaysList($profile_login);
    echo('<table><thead><tr><th>Gra</th><th>Przeciwnik</th><th>Data rozgrywki</th><th>Wynik</th></tr></thead><tbody>');
    foreach($playsList as $play) {
      $gameId = intval($play['id_game']);
      $categoryId = intval($play['id_game_category']);
      $gameplayId = intval($play['id_gameplay']);
      $oppRaw = isset($play['login']) ? (string)$play['login'] : '';
      echo('<tr><td><a href="'.profile_h($path['games']).'?id_category='.$categoryId.'&amp;id_game='.$gameId.'">'.profile_h(isset($play['title']) ? $play['title'] : '').'</a></td>');
      echo('<td><a href="'.profile_h($path['profile']).'-'.profile_login_url($oppRaw).'">'.profile_h($oppRaw).'</a></td>');
      echo('<td>Rozpoczęto: '.profile_h(isset($play['date_gameplay_started']) ? $play['date_gameplay_started'] : '').'<br />Zakończono: '.profile_h(isset($play['date_gameplay_ended']) ? $play['date_gameplay_ended'] : '').'</td>');
      echo('<td>'.(intval($play['score'])>0?'przegrana':'wygrana').'<br /><a href="#" onclick="displayGameplayMovesWindow('.$gameplayId.'); return false;">Zobacz zapis z gry</a></td></tr>');
    }
    echo('</tbody></table>');
  } catch(ExceptionNoResults $e) {
    echo('<div class="information">Póki co brak listy rozgrywek.</div>');
  } catch(Exception $e) {
    echo('<div class="negative">Nie udało się pobrać listy rozgrywek.</div>');
  }
  echo('</div>');

  echo('<div id="tabs_profile_friends">');
  try { DisplayFriendList($id); }
  catch(ExceptionNoResults $e) { echo('<div class="information">Brak znajomych.</div>'); }
  catch(Exception $e) { echo('<div class="negative">Nie udało się pobrać listy znajomych.</div>'); }
  echo('</div>');

  if ($isOwn)
  {
    echo('<div id="tabs_profile_blacklist">');
    try { DisplayUserBlackList(); }
    catch(Exception $e) { echo('<div class="negative">Nie udało się pobrać czarnej listy.</div>'); }
    echo('</div>');

    echo('<div id="tabs_profile_last_interlocutors"><form action="" class="form_new_conversation"><input type="text" name="conversation_interlocutor" value="Wpisz nazwę gracza z którym chcesz rozmawiać" size="50" /><button type="submit">Rozpocznij rozmowę</button></form><h3>Twoi ostatni rozmówcy</h3>');
    try { DisplayMyLastInterlocutors(); }
    catch(Exception $e) { echo('<div class="negative">Nie udało się pobrać listy rozmówców.</div>'); }
    echo('</div>');
  }

  echo('</div><br style="clear:both" />');
  echo('<div style="text-align:right">Oglądnij również <a href="'.profile_h($path['statistics']).'">statystyki serwisu</a>.</div>');
  echo('<script type="text/javascript">function displayGameplayMovesWindow(id_gameplay){var w=jQuery("<div class=\"gameplayMovesWindow\"></div>");w.load("'.profile_h($path['ajaxGameplayMovesWindow']).'?id_gameplay="+encodeURIComponent(id_gameplay));w.dialog({title:"Zapis rozgrywki #"+id_gameplay,closeText:"Zamknij",width:"50%",minWidth:250,height:410,minHeight:410});} jQuery("#tabs_profile").tabs();</script>');
}
catch(ExceptionNoResults $e)
{
  http_response_code(404);
  echo('<div class="information">Nie znaleziono użytkownika.</div>');
}
catch(ExceptionAccessDenied $e)
{
  http_response_code(403);
  echo('<div class="warning">Nie masz uprawnień do przeglądania tej podstrony. <a href="'.profile_h($path['login']).'">Zaloguj się</a>.</div><br />');
}
catch(Exception $e)
{
  http_response_code(400);
  echo('<div class="negative">Nie udało się wyświetlić profilu.</div>');
}
?>

  </div>
</div>

<?php include_once($footer); ?>