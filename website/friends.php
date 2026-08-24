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
if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < USER) {
  http_response_code(403);
  echo('<div class="warning">Musisz być zalogowany, aby zarządzać znajomymi.</div>');
} else {
  $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
  $actionDone = false;

  if ($method === 'POST' && isset($_POST['add_friend_id'])) {
    echo('<h1>Dodaj do znajomych</h1>');
    try {
      AddToFriendList(intval($_POST['add_friend_id']), isset($_POST['token']) ? $_POST['token'] : '');
      echo('<div class="positive">Wskazany użytkownik został dodany do znajomych.</div>');
    } catch (Exception $e) {
      echo('<div class="negative">Nie udało się dodać użytkownika do znajomych.</div>');
    }
    $actionDone = true;
  }

  if ($method === 'POST' && isset($_POST['delete_friend_id'])) {
    echo('<h1>Usuń ze znajomych</h1>');
    try {
      DeleteFromFriendList(intval($_POST['delete_friend_id']), isset($_POST['token']) ? $_POST['token'] : '');
      echo('<div class="positive">Wskazany użytkownik został usunięty z listy znajomych.</div>');
    } catch (Exception $e) {
      echo('<div class="negative">Nie udało się usunąć użytkownika z listy znajomych.</div>');
    }
    $actionDone = true;
  }

  if ($method !== 'POST' && (isset($_GET['add_friend_id']) || isset($_GET['delete_friend_id']))) {
    http_response_code(405);
    echo('<div class="warning">Ta operacja wymaga bezpiecznego żądania POST.</div>');
    $actionDone = true;
  }

  if (!$actionDone) {
    echo('<h1>Twoi znajomi</h1>');
    try {
      DisplayFriendList(intval($_SESSION['id']));
    } catch (ExceptionNoResults $e) {
      echo('<div class="information">Nie masz żadnych znajomych.</div>');
    } catch (Exception $e) {
      echo('<div class="negative">Nie udało się pobrać listy znajomych.</div>');
    }
  }

  echo('<br /><br /><a href="'.htmlspecialchars($path['profile'], ENT_QUOTES, 'UTF-8').'" class="button_normal">Twój profil</a>');
}
?>

  </div>
</div>

<?php include_once($footer); ?>