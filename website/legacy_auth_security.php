<?php

/**
 * Security bridge for legacy PHP authentication.
 * Supports existing SHA-1+pepper hashes and modern password_hash() values.
 * Legacy hashes are transparently upgraded after a successful login when the
 * database column can safely store a modern hash.
 */

function LegacyPasswordColumnLength()
{
    global $database_handle, $database_name, $database_prefix;

    $stmt = $database_handle->prepare(
        'SELECT CHARACTER_MAXIMUM_LENGTH AS max_len
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = :schema_name
            AND TABLE_NAME = :table_name
            AND COLUMN_NAME = :column_name
          LIMIT 1'
    );
    $stmt->execute(array(
        ':schema_name' => $database_name,
        ':table_name' => $database_prefix.'_users',
        ':column_name' => 'password'
    ));
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? intval($row['max_len']) : 0;
}

function LegacyPasswordColumnSupportsModernHash()
{
    return LegacyPasswordColumnLength() >= 255;
}

function HashModernPassword($password)
{
    if (defined('PASSWORD_ARGON2ID')) {
        return password_hash($password, PASSWORD_ARGON2ID);
    }
    return password_hash($password, PASSWORD_DEFAULT);
}

function VerifyLegacyOrModernPassword($storedHash, $plainPassword)
{
    global $seed_private;

    $storedHash = (string)$storedHash;
    $plainPassword = (string)$plainPassword;

    if ($storedHash === '') {
        return false;
    }

    // Legacy format: exactly 40 hexadecimal characters (SHA-1).
    if (preg_match('/^[a-f0-9]{40}$/i', $storedHash)) {
        return hash_equals(strtolower($storedHash), strtolower(sha1($seed_private.$plainPassword)));
    }

    return password_verify($plainPassword, $storedHash);
}

function UpgradeLegacyPasswordHashIfPossible($userId, $storedHash, $plainPassword)
{
    global $database_handle, $database_prefix;

    if (!preg_match('/^[a-f0-9]{40}$/i', (string)$storedHash)) {
        return false;
    }

    if (!LegacyPasswordColumnSupportsModernHash()) {
        error_log('Gracz.pl security: legacy password hash not upgraded because password column is shorter than 255 characters.');
        return false;
    }

    $newHash = HashModernPassword((string)$plainPassword);
    if ($newHash === false) {
        throw new RuntimeException('Nie udało się utworzyć bezpiecznego skrótu hasła.');
    }

    $stmt = $database_handle->prepare(
        'UPDATE '.$database_prefix.'_users
            SET password = :new_hash
          WHERE id = :id AND password = :old_hash
          LIMIT 1'
    );
    $stmt->bindValue(':new_hash', $newHash, PDO::PARAM_STR);
    $stmt->bindValue(':id', intval($userId), PDO::PARAM_INT);
    $stmt->bindValue(':old_hash', $storedHash, PDO::PARAM_STR);
    $stmt->execute();

    return $stmt->rowCount() === 1;
}

function SecureAuthorizeUser($login, $password, $rememberSession = false)
{
    global $database_handle, $database_prefix;

    $login = trim((string)$login);
    $password = (string)$password;

    if ($login === '' || $password === '') {
        return false;
    }

    $stmt = $database_handle->prepare(
        'SELECT id, email, password, active, blocked
           FROM '.$database_prefix.'_users
          WHERE (login = :login OR email = :login)
          LIMIT 1'
    );
    $stmt->bindValue(':login', $login, PDO::PARAM_STR);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // Deliberately use one generic failure path to avoid account enumeration.
    if (!$row || intval($row['active']) !== 1 || intval($row['blocked']) === 1) {
        return false;
    }

    if (!VerifyLegacyOrModernPassword($row['password'], $password)) {
        return false;
    }

    // Upgrade only after successful authentication.
    UpgradeLegacyPasswordHashIfPossible($row['id'], $row['password'], $password);

    // Reuse the legacy session-initialisation path only after password
    // verification has succeeded here. Passing the verified account e-mail
    // avoids ambiguous login matching in the legacy function.
    return AuthorizeUser($row['email'], null, $rememberSession ? true : false, true);
}
