<?php include("variables_local.php"); include_once($header); ?>
<?php
GraczRequirePermission('audit.read');
GraczRequireAdmin2fa();
$role = RbacService::currentRole($database_handle, $database_prefix);
GraczAudit()->record('admin.panel.opened', isset($_SESSION['id'])?$_SESSION['id']:null, array('role'=>$role));
?>
<div class="box light"><div class="content">
<h1>Bezpieczny panel administracyjny</h1>
<p>Zalogowano jako: <strong><?php echo htmlspecialchars(isset($_SESSION['login'])?$_SESSION['login']:'', ENT_QUOTES, 'UTF-8'); ?></strong> — rola: <strong><?php echo htmlspecialchars($role, ENT_QUOTES, 'UTF-8'); ?></strong>.</p>
<p>Każde wejście i operacja administracyjna powinny być rejestrowane w AuditService. Operacje zmieniające dane muszą używać POST + CSRF.</p>
<ul>
  <?php if (RbacService::can('moderation.review',$database_handle,$database_prefix)) { ?><li><a href="admin_reported_abuses.php">Moderacja i zgłoszenia nadużyć</a></li><?php } ?>
  <?php if (RbacService::can('content.manage',$database_handle,$database_prefix)) { ?><li><a href="admin_reported_bugs.php">Zgłoszone błędy</a></li><li><a href="advertisement_management.php">Reklamy</a></li><li><a href="code_paste_management.php">Kody śledzenia/reklamowe</a></li><li><a href="mailing.php">Mailing</a></li><?php } ?>
  <?php if (RbacService::can('audit.read',$database_handle,$database_prefix)) { ?><li><a href="daily.php">Dziennik zdarzeń</a></li><?php } ?>
  <li><a href="admin_2fa.php">Ponowna weryfikacja 2FA</a></li>
</ul>
<p><strong>Uwaga:</strong> stare operacje blokowania użytkowników wykonywane metodą GET zostały wyłączone przez centralną bramę bezpieczeństwa.</p>
</div></div>
<?php include_once($footer); ?>