<?php
/** CSRF-safe logout: GET only shows confirmation, POST revokes and destroys the session. */
include("variables_local.php"); include_once($header); ?>
<div class="box light"><div class="content">
<?php
$loggedIn = !empty($_SESSION['initiated']);
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['confirm_logout'])) {
    try {
        SecurityService::verifyStateChangingRequest();
        $userId = isset($_SESSION['id']) ? (int)$_SESSION['id'] : null;
        $login = isset($_SESSION['login']) ? $_SESSION['login'] : '';
        if ($userId) GraczSessions()->revokeCurrent('logout');
        GraczAudit()->record('auth.logout', $userId, array('login'=>$login));
        Logout();
        SecurityService::destroySession();
        echo('<h1 class="positive">Wylogowałeś się poprawnie</h1><p>Sesja została natychmiast unieważniona.</p><a href="'.$directory['base'].'index.php">Strona główna</a>');
    } catch (Exception $e) {
        echo('<div class="negative">Nie udało się bezpiecznie zakończyć sesji.</div>');
    }
} elseif ($loggedIn) {
    echo('<h1>Wylogowanie</h1><p>Czy na pewno chcesz się wylogować?</p>');
    echo('<form method="post" action="">'.SecurityService::csrfInput().'<button type="submit" name="confirm_logout" value="1">Wyloguj mnie</button></form>');
} else {
    echo('<div class="uwaga">Nie jesteś obecnie zalogowany.</div>');
}
?>
</div></div>
<?php include_once($footer); ?>