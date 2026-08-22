<?php include("variables_local.php"); include_once($header); ?>
<?php
function bug_e($v) { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < ADMINISTRATOR) {
  http_response_code(403);
  echo('<div class="negative">Brak uprawnień administratora.</div>');
  include_once($footer); exit();
}
$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_bug_report'])) {
  try {
    if (!isset($_POST['token']) || !hash_equals((string)$_SESSION['token'], (string)$_POST['token']))
      throw new Exception('Nieprawidłowy token bezpieczeństwa.');
    $id = intval($_POST['delete_bug_report']);
    if ($id <= 0) throw new Exception('Nieprawidłowy identyfikator zgłoszenia.');
    $stmt = $database_handle->prepare('DELETE FROM '.$database_prefix.'_bug_notifications WHERE id = :id LIMIT 1');
    $stmt->execute(array(':id'=>$id));
    $message = '<div class="positive">Zgłoszenie zostało usunięte.</div>';
  } catch (Exception $e) {
    $message = '<div class="negative">'.bug_e($e->getMessage()).'</div>';
  }
}
$stmt = $database_handle->prepare('SELECT id, id_user, description, address, browser, request_data, date_add FROM '.$database_prefix.'_bug_notifications ORDER BY id DESC LIMIT 500');
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<div class="box light"><div class="content">
<h1>Zgłoszone błędy</h1><?php echo $message; ?>
<?php if (!$rows): ?><div class="information">Brak zgłoszeń.</div><?php else: ?>
<table><thead><tr><th>Usuń</th><th>Adres</th><th>Dane żądania</th><th>Przeglądarka</th><th>#ID</th><th>Opis</th><th>Data</th></tr></thead><tbody>
<?php foreach ($rows as $row):
  $address = (string)$row['address'];
  $safeHref = '#';
  $parts = @parse_url($address);
  if (is_array($parts) && isset($parts['scheme']) && in_array(strtolower($parts['scheme']), array('http','https'), true)) $safeHref = $address;
?>
<tr>
<td><form method="post" action=""><input type="hidden" name="token" value="<?php echo bug_e($_SESSION['token']); ?>"/><input type="hidden" name="delete_bug_report" value="<?php echo intval($row['id']); ?>"/><button type="submit" onclick="return confirm('Czy na pewno usunąć to zgłoszenie?');">Usuń</button></form></td>
<td><?php echo bug_e($address); ?></td>
<td><details><summary>Pokaż</summary><pre><?php echo bug_e($row['request_data']); ?></pre></details></td>
<td><?php echo bug_e($row['browser']); ?></td><td><?php echo intval($row['id']); ?></td>
<td><a target="_blank" rel="noopener noreferrer" href="<?php echo bug_e($safeHref); ?>"><?php echo bug_e($row['description']); ?></a></td>
<td><?php echo bug_e($row['date_add']); ?></td>
</tr><?php endforeach; ?>
</tbody></table><?php endif; ?>
</div></div>
<?php include_once($footer); ?>
