<?php include("variables_local.php"); include_once($header); ?>
<?php
GraczRequirePermission('moderation.review');
GraczRequireAdmin2fa();
$role = RbacService::currentRole($database_handle, $database_prefix);
GraczAudit()->record('moderator.panel.opened', isset($_SESSION['id'])?$_SESSION['id']:null, array('role'=>$role));
?>
<div class="box light"><div class="content">
<h1>Panel moderatora</h1>
<p>Ten panel nie daje dostępu do konfiguracji serwisu, bazy, mailingu ani zarządzania rolami.</p>
<ul>
  <li><a href="admin_reported_abuses.php">Zgłoszenia i moderacja</a></li>
  <li><a href="moderation_appeal.php">Podgląd własnych odwołań</a></li>
  <li><a href="admin_2fa.php">Ponowna weryfikacja 2FA</a></li>
</ul>
</div></div>
<?php include_once($footer); ?>