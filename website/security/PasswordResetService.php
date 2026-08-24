<?php
final class PasswordResetService
{
    private $pdo;
    private $prefix;
    private $legacyPepper;

    public function __construct(PDO $pdo, $prefix, $legacyPepper)
    {
        $this->pdo = $pdo;
        $this->prefix = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$prefix);
        $this->legacyPepper = (string)$legacyPepper;
    }

    public function request($email)
    {
        $email = SecurityService::validateEmail($email);
        $users = $this->prefix.'_users';
        $stmt = $this->pdo->prepare("SELECT id,email FROM {$users} WHERE email=:email LIMIT 1");
        $stmt->execute(array(':email'=>$email));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null; // caller always returns a generic public response

        $issued = TokenService::generate();
        $tokens = $this->prefix.'_security_tokens';
        $subjectHash = hash('sha256', 'user:'.(int)$row['id']);
        $stmt = $this->pdo->prepare("INSERT INTO {$tokens} (purpose,subject_id,subject_hash,token_hash,created_at,expires_at) VALUES ('password_reset',:uid,:subject,:hash,NOW(),:expires)");
        $stmt->execute(array(':uid'=>(int)$row['id'], ':subject'=>$subjectHash, ':hash'=>$issued['hash'], ':expires'=>TokenService::expiresAt(3600)));
        return array('token'=>$issued['plain'], 'user_id'=>(int)$row['id'], 'email'=>$row['email']);
    }

    public function validateToken($plainToken)
    {
        $tokens = $this->prefix.'_security_tokens';
        $stmt = $this->pdo->prepare("SELECT subject_id FROM {$tokens} WHERE purpose='password_reset' AND token_hash=:hash AND used_at IS NULL AND expires_at>NOW() LIMIT 1");
        $stmt->execute(array(':hash'=>TokenService::hash($plainToken)));
        $uid = $stmt->fetchColumn();
        return $uid ? (int)$uid : false;
    }

    public function consumeAndSetPassword($plainToken, $newPassword)
    {
        $newPassword = SecurityService::validatePassword($newPassword);
        $tokens = $this->prefix.'_security_tokens';
        $users = $this->prefix.'_users';
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("SELECT id,subject_id FROM {$tokens} WHERE purpose='password_reset' AND token_hash=:hash AND used_at IS NULL AND expires_at>NOW() LIMIT 1 FOR UPDATE");
            $stmt->execute(array(':hash'=>TokenService::hash($plainToken)));
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                $this->pdo->rollBack();
                return false;
            }
            $uid = (int)$row['subject_id'];
            // Compatibility with the existing account table. Migrate legacy SHA-1 hashes separately to password_hash()/Argon2id.
            $legacyHash = sha1($this->legacyPepper.$newPassword);
            $stmt = $this->pdo->prepare("UPDATE {$users} SET password=:password WHERE id=:uid LIMIT 1");
            $stmt->execute(array(':password'=>$legacyHash, ':uid'=>$uid));
            $stmt = $this->pdo->prepare("UPDATE {$tokens} SET used_at=NOW() WHERE id=:id AND used_at IS NULL");
            $stmt->execute(array(':id'=>(int)$row['id']));
            // Invalidate all other outstanding reset links for the same account.
            $stmt = $this->pdo->prepare("UPDATE {$tokens} SET used_at=NOW() WHERE purpose='password_reset' AND subject_id=:uid AND used_at IS NULL");
            $stmt->execute(array(':uid'=>$uid));
            $this->pdo->commit();
            return $uid;
        } catch(Exception $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $e;
        }
    }
}
