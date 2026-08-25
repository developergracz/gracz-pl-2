<?php include("variables_local.php"); include_once($header); ?>
<div class="box light"><div class="content">
<h1>Odwołanie od moderacji</h1>
<?php
try {
    if (empty($_SESSION['initiated']) || empty($_SESSION['id'])) throw new RuntimeException('Musisz być zalogowany.');
    $uid = (int)$_SESSION['id'];
    $table = $database_prefix.'_moderation_events';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['event_id'])) {
        SecurityService::verifyStateChangingRequest();
        GraczRateLimiter()->enforce('moderation-appeal-user', (string)$uid, 5, 86400);
        $eventId = max(1, (int)$_POST['event_id']);
        $stmt = $database_handle->prepare("UPDATE {$table} SET appealed_at=NOW(), appeal_status='pending' WHERE id=:id AND user_id=:uid AND decision IN ('flag','block') AND appealed_at IS NULL");
        $stmt->execute(array(':id'=>$eventId, ':uid'=>$uid));
        if ($stmt->rowCount() !== 1) throw new RuntimeException('Nie można złożyć odwołania dla tego zdarzenia.');
        GraczAudit()->record('moderation.appeal.submitted', $uid, array('moderation_event_id'=>$eventId));
        echo '<div class="positive">Odwołanie zostało zapisane do ręcznego rozpatrzenia.</div>';
    }

    $stmt = $database_handle->prepare("SELECT id,content_type,decision,reason_code,appealed_at,appeal_status,created_at FROM {$table} WHERE user_id=:uid AND decision IN ('flag','block') ORDER BY created_at DESC LIMIT 50");
    $stmt->execute(array(':uid'=>$uid));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) {
        echo '<p>Brak decyzji moderacyjnych wymagających odwołania.</p>';
    } else {
        echo '<table><thead><tr><th>Data</th><th>Typ</th><th>Decyzja</th><th>Powód</th><th>Odwołanie</th></tr></thead><tbody>';
        foreach ($rows as $row) {
            echo '<tr><td>'.htmlspecialchars($row['created_at'],ENT_QUOTES,'UTF-8').'</td><td>'.htmlspecialchars($row['content_type'],ENT_QUOTES,'UTF-8').'</td><td>'.htmlspecialchars($row['decision'],ENT_QUOTES,'UTF-8').'</td><td>'.htmlspecialchars((string)$row['reason_code'],ENT_QUOTES,'UTF-8').'</td><td>';
            if ($row['appealed_at']) {
                echo htmlspecialchars($row['appeal_status'] ?: 'pending',ENT_QUOTES,'UTF-8');
            } else {
                echo '<form method="post">'.SecurityService::csrfInput().'<input type="hidden" name="event_id" value="'.(int)$row['id'].'"><button type="submit">Odwołaj się</button></form>';
            }
            echo '</td></tr>';
        }
        echo '</tbody></table>';
    }
} catch(Exception $e) {
    echo '<div class="negative">'.htmlspecialchars($e->getMessage(),ENT_QUOTES,'UTF-8').'</div>';
}
?>
</div></div>
<?php include_once($footer); ?>