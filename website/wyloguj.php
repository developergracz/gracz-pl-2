<?php
/** Bezpieczne wylogowanie: operacja zmieniająca stan jest wykonywana tylko metodą POST z CSRF. */
include("variables_local.php"); include_once($header); ?>

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
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['confirm_logout'])) {
      try {
        RequireCsrf();
        $userId = isset($_SESSION['id']) ? intval($_SESSION['id']) : null;
        $login = isset($_SESSION['login']) ? $_SESSION['login'] : '';
        AuditLog('auth.logout', 'user', $userId);

        // Legacy Logout aktualizuje flagę logged_in. Następnie wymuszamy pełne skasowanie cookie i sesji.
        Logout();
        SecurityDestroySession();

        echo('<h1 class="positive">Wylogowałeś się poprawnie</h1>');
        echo('<p>Dziękujemy za skorzystanie z serwisu.</p>');
        echo('<a href="'.$directory['base'].'index.php">Strona główna</a>');
      } catch (Exception $e) {
        echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
      }
    } else {
      if (!isset($_SESSION['initiated'])) {
        echo('<div class="uwaga">Nie jesteś obecnie zalogowany.</div>');
      } else {
        echo('<h1>Wylogowanie</h1>');
        echo('<p>Czy na pewno chcesz zakończyć bieżącą sesję?</p>');
        echo('<form method="post" action="">'.CsrfField().'<button type="submit" name="confirm_logout" value="1">Wyloguj</button></form>');
      }
    }
  ?>
  </div>
</div>

<?php include_once($footer); ?>