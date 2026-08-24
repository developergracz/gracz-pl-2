<?php
// CLI only. Run on staging first and take a verified encrypted backup before production.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__).'/website';
$actual_path = $root.'/';
require_once $root.'/variables_global.php';
require_once $root.'/security/DataProtectionService.php';
require_once $root.'/library_main.php';
DatabaseConnect();
if (!($database_handle instanceof PDO)) throw new RuntimeException('PDO connection required.');

$table = $database_prefix.'_conversation';
$batch = max(10, min(1000, (int)(getenv('MIGRATION_BATCH_SIZE') ?: 200)));
$lastId = (int)(getenv('MIGRATION_START_ID') ?: 0);
$total = 0;

while (true) {
    $stmt = $database_handle->prepare("SELECT id,id_user_sender,id_user_recipient,message_text FROM {$table} WHERE id>:id ORDER BY id ASC LIMIT {$batch}");
    $stmt->execute(array(':id'=>$lastId));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) break;

    $database_handle->beginTransaction();
    try {
        foreach ($rows as $row) {
            $lastId = (int)$row['id'];
            $text = (string)$row['message_text'];
            if (strpos($text,'v1.') === 0) continue;
            $aad = 'pm:'.(int)$row['id_user_sender'].':'.(int)$row['id_user_recipient'];
            $cipher = DataProtectionService::encrypt($text,$aad);
            $u = $database_handle->prepare("UPDATE {$table} SET message_text=:cipher WHERE id=:id AND message_text=:old");
            $u->execute(array(':cipher'=>$cipher,':id'=>$lastId,':old'=>$text));
            $total += $u->rowCount();
        }
        $database_handle->commit();
        fwrite(STDOUT,"Encrypted through message id {$lastId}; total {$total}\n");
    } catch(Exception $e) {
        if ($database_handle->inTransaction()) $database_handle->rollBack();
        throw $e;
    }
}

fwrite(STDOUT,"Migration complete. Encrypted {$total} legacy messages.\n");
