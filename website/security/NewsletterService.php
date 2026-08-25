<?php
final class NewsletterService
{
    private $pdo;
    private $prefix;

    public function __construct(PDO $pdo, $prefix)
    {
        $this->pdo = $pdo;
        $this->prefix = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$prefix);
    }

    public function subscribe($email)
    {
        $email = SecurityService::validateEmail($email);
        $emailHash = hash('sha256', $email);
        $cipher = DataProtectionService::encrypt($email, 'newsletter-email');
        $table = $this->prefix.'_newsletter_subscribers';
        $stmt = $this->pdo->prepare("INSERT INTO {$table} (email_hash,email_ciphertext,status,created_at,updated_at) VALUES (:h,:c,'pending',NOW(),NOW()) ON DUPLICATE KEY UPDATE email_ciphertext=VALUES(email_ciphertext), updated_at=NOW()");
        $stmt->execute(array(':h'=>$emailHash, ':c'=>$cipher));
        return $this->issueActionToken($emailHash, 'newsletter_check', 3600);
    }

    public function issueUnsubscribeToken($email)
    {
        $email = SecurityService::validateEmail($email);
        return $this->issueActionToken(hash('sha256', $email), 'newsletter_unsubscribe', 30*24*3600);
    }

    private function issueActionToken($subjectHash, $purpose, $ttl)
    {
        $issued = TokenService::generate();
        $table = $this->prefix.'_security_tokens';
        $stmt = $this->pdo->prepare("INSERT INTO {$table} (purpose,subject_hash,token_hash,created_at,expires_at) VALUES (:purpose,:subject,:token,NOW(),:expires)");
        $stmt->execute(array(
            ':purpose'=>$purpose,
            ':subject'=>$subjectHash,
            ':token'=>$issued['hash'],
            ':expires'=>TokenService::expiresAt($ttl)
        ));
        // Only the one-time plaintext token leaves this method. DB stores SHA-256 only.
        return $issued['plain'];
    }

    public function consume($plainToken, $purpose)
    {
        if (!in_array($purpose, array('newsletter_check','newsletter_unsubscribe'), true)) {
            throw new InvalidArgumentException('Invalid newsletter token purpose.');
        }
        $hash = TokenService::hash($plainToken);
        $tokenTable = $this->prefix.'_security_tokens';
        $subscriberTable = $this->prefix.'_newsletter_subscribers';

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("SELECT id,subject_hash FROM {$tokenTable} WHERE purpose=:purpose AND token_hash=:hash AND used_at IS NULL AND expires_at>NOW() LIMIT 1 FOR UPDATE");
            $stmt->execute(array(':purpose'=>$purpose, ':hash'=>$hash));
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                $this->pdo->rollBack();
                return false;
            }
            $stmt = $this->pdo->prepare("UPDATE {$tokenTable} SET used_at=NOW() WHERE id=:id AND used_at IS NULL");
            $stmt->execute(array(':id'=>(int)$row['id']));

            $newStatus = $purpose === 'newsletter_check' ? 'active' : 'unsubscribed';
            $stmt = $this->pdo->prepare("UPDATE {$subscriberTable} SET status=:status, updated_at=NOW() WHERE email_hash=:subject");
            $stmt->execute(array(':status'=>$newStatus, ':subject'=>$row['subject_hash']));
            $this->pdo->commit();
            return true;
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $e;
        }
    }
}
