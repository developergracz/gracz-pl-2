<?php
/** Wysokopoziomowe usługi bezpieczeństwa Gracz.pl. Wymaga security_core.php i aktywnego PDO. */

function SecurityCurrentRole()
{
    global $database_handle, $database_prefix;
    if (!empty($_SESSION['security_role'])) return $_SESSION['security_role'];
    if (empty($_SESSION['id'])) return 'guest';

    $role = 'player';
    try {
        $stmt = $database_handle->prepare('SELECT role FROM '.$database_prefix.'_user_roles WHERE user_id=:id LIMIT 1');
        $stmt->execute(array(':id'=>intval($_SESSION['id'])));
        $dbRole = $stmt->fetchColumn();
        if (in_array($dbRole, array('player','moderator','administrator','owner'), true)) $role = $dbRole;
    } catch (Exception $e) {
        // Kompatybilność podczas wdrożenia migracji: stare ADMINISTRATOR=100 mapujemy na administratora.
        if (isset($_SESSION['account_type']) && defined('ADMINISTRATOR') && intval($_SESSION['account_type']) >= ADMINISTRATOR) $role = 'administrator';
    }

    $ownerId = intval(SecurityEnv('OWNER_USER_ID', 0));
    if ($ownerId > 0 && intval($_SESSION['id']) === $ownerId) $role = 'owner';
    $_SESSION['security_role'] = $role;
    return $role;
}

function SecurityRoleLevel($role)
{
    $levels = array('guest'=>0,'player'=>10,'moderator'=>20,'administrator'=>30,'owner'=>40);
    return isset($levels[$role]) ? $levels[$role] : 0;
}

function SecurityRequireRole($minimumRole)
{
    $current = SecurityCurrentRole();
    if (SecurityRoleLevel($current) < SecurityRoleLevel($minimumRole)) {
        AuditLog('authorization.denied', 'role', $minimumRole, array('current_role'=>$current));
        http_response_code(403);
        exit('Brak uprawnień do tej części serwisu.');
    }
    return true;
}

function SecurityRequirePrivilegedMfa()
{
    $role = SecurityCurrentRole();
    if (SecurityRoleLevel($role) < SecurityRoleLevel('moderator')) return true;
    // Włącz po skonfigurowaniu TOTP/WebAuthn dla wszystkich kont uprzywilejowanych.
    if (SecurityEnv('PRIVILEGED_MFA_REQUIRED', '0') === '1' && empty($_SESSION['mfa_verified_at'])) {
        AuditLog('mfa.required', 'user', isset($_SESSION['id']) ? $_SESSION['id'] : null);
        http_response_code(403);
        exit('To konto wymaga dodatkowego uwierzytelnienia 2FA.');
    }
    return true;
}

function TokenServiceIssue($subjectType, $subjectId, $purpose, $ttlSeconds = 3600)
{
    global $database_handle, $database_prefix;
    $plain = bin2hex(random_bytes(32));
    $hash = hash('sha256', $plain);
    $stmt = $database_handle->prepare('INSERT INTO '.$database_prefix.'_secure_tokens (subject_type,subject_id,purpose,token_hash,expires_at) VALUES (:st,:sid,:purpose,:hash,:expires)');
    $stmt->execute(array(
        ':st'=>substr($subjectType,0,40), ':sid'=>substr((string)$subjectId,0,191), ':purpose'=>substr($purpose,0,50),
        ':hash'=>$hash, ':expires'=>date('Y-m-d H:i:s', time()+max(60,intval($ttlSeconds)))
    ));
    return $plain; // jedyny moment, gdy token jawny opuszcza usługę – wyłącznie do linku wysyłanego użytkownikowi
}

function TokenServiceConsume($plainToken, $purpose)
{
    global $database_handle, $database_prefix;
    $hash = hash('sha256', (string)$plainToken);
    $database_handle->beginTransaction();
    try {
        $stmt = $database_handle->prepare('SELECT id,subject_type,subject_id FROM '.$database_prefix.'_secure_tokens WHERE token_hash=:hash AND purpose=:purpose AND used_at IS NULL AND expires_at>NOW() LIMIT 1 FOR UPDATE');
        $stmt->execute(array(':hash'=>$hash, ':purpose'=>$purpose));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            $database_handle->rollBack();
            return false;
        }
        $up = $database_handle->prepare('UPDATE '.$database_prefix.'_secure_tokens SET used_at=NOW() WHERE id=:id AND used_at IS NULL');
        $up->execute(array(':id'=>$row['id']));
        $database_handle->commit();
        return array('subject_type'=>$row['subject_type'],'subject_id'=>$row['subject_id']);
    } catch (Exception $e) {
        if ($database_handle->inTransaction()) $database_handle->rollBack();
        throw $e;
    }
}

function SecureEncrypt($plaintext, $context = '')
{
    $keyB64 = SecurityEnv('DATA_ENCRYPTION_KEY', '');
    if ($keyB64 === '') throw new RuntimeException('Brak DATA_ENCRYPTION_KEY.');
    $key = base64_decode($keyB64, true);
    if ($key === false || strlen($key) !== 32) throw new RuntimeException('DATA_ENCRYPTION_KEY musi być 32-bajtowym kluczem base64.');
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt((string)$plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, (string)$context, 16);
    if ($cipher === false) throw new RuntimeException('Błąd szyfrowania danych.');
    return base64_encode($iv.$tag.$cipher);
}

function SecureDecrypt($payload, $context = '')
{
    $key = base64_decode(SecurityEnv('DATA_ENCRYPTION_KEY', ''), true);
    $raw = base64_decode((string)$payload, true);
    if ($key === false || strlen($key)!==32 || $raw === false || strlen($raw)<29) throw new RuntimeException('Nieprawidłowe dane szyfrowane.');
    $iv = substr($raw,0,12); $tag = substr($raw,12,16); $cipher = substr($raw,28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, (string)$context);
    if ($plain === false) throw new RuntimeException('Nie udało się odszyfrować danych.');
    return $plain;
}

function SecureUploadValidate(array $file, array $allowedMime = array('image/png','image/jpeg','image/webp','text/plain','application/json'), $maxBytes = 5242880)
{
    if (!isset($file['error']) || is_array($file['error']) || $file['error'] !== UPLOAD_ERR_OK) throw new RuntimeException('Błąd przesyłania pliku.');
    if (!isset($file['size']) || intval($file['size']) <= 0 || intval($file['size']) > $maxBytes) throw new RuntimeException('Nieprawidłowy rozmiar pliku.');
    if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) throw new RuntimeException('Nieprawidłowe źródło pliku.');
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $allowedMime, true)) throw new RuntimeException('Ten typ pliku nie jest dozwolony.');

    $extensions = array('image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp','text/plain'=>'txt','application/json'=>'json');
    $name = bin2hex(random_bytes(24)).'.'.$extensions[$mime];
    return array('mime'=>$mime,'safe_name'=>$name,'size'=>intval($file['size']));
}

function SecurityNormalizePlainMessage($message, $maxLength = 4000)
{
    $message = trim((string)$message);
    $message = strip_tags($message);
    $message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $message);
    if ($message === '') throw new RuntimeException('Wiadomość nie może być pusta.');
    if (mb_strlen($message,'UTF-8') > $maxLength) throw new RuntimeException('Wiadomość jest zbyt długa.');
    return $message;
}
