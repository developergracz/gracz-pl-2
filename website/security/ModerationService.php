<?php
final class ModerationService
{
    private static $blockedSchemes = array('javascript:', 'data:', 'vbscript:');

    public static function nickname($nickname)
    {
        $nickname = SecurityService::validateLogin($nickname);
        $normalized = mb_strtolower($nickname, 'UTF-8');
        $blocked = self::blockedTerms();
        foreach ($blocked as $term) {
            if ($term !== '' && mb_strpos($normalized, $term, 0, 'UTF-8') !== false) {
                return array('decision' => 'flag', 'value' => $nickname, 'reason' => 'nickname_term');
            }
        }
        return array('decision' => 'allow', 'value' => $nickname, 'reason' => null);
    }

    public static function message($message, $maxLength = 4000)
    {
        $message = trim((string)$message);
        if ($message === '' || mb_strlen($message, 'UTF-8') > $maxLength) {
            throw new InvalidArgumentException('Wiadomość jest pusta lub zbyt długa.');
        }

        // The legacy chat is treated as plain text. This prevents stored XSS/HTML injection.
        $plain = strip_tags($message);
        $plain = preg_replace('/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/u', '', $plain);

        $lower = mb_strtolower($plain, 'UTF-8');
        foreach (self::$blockedSchemes as $scheme) {
            if (strpos($lower, $scheme) !== false) {
                throw new InvalidArgumentException('Wiadomość zawiera niedozwolony link.');
            }
        }

        $linkCount = preg_match_all('~https?://~i', $plain, $m);
        if ($linkCount > 5) {
            throw new InvalidArgumentException('Wiadomość zawiera zbyt wiele linków.');
        }

        $decision = 'allow';
        $reason = null;
        foreach (self::blockedTerms() as $term) {
            if ($term !== '' && mb_strpos($lower, $term, 0, 'UTF-8') !== false) {
                $decision = 'flag';
                $reason = 'content_term';
                break;
            }
        }
        return array('decision' => $decision, 'value' => $plain, 'reason' => $reason, 'hash' => hash('sha256', $plain));
    }

    public static function recordDecision($pdo, $prefix, $userId, $contentType, array $result)
    {
        if (!($pdo instanceof PDO)) return false;
        try {
            $table = preg_replace('/[^a-zA-Z0-9_]/', '', $prefix).'_moderation_events';
            $stmt = $pdo->prepare("INSERT INTO {$table} (user_id, content_type, content_hash, decision, reason_code, created_at) VALUES (:uid,:type,:hash,:decision,:reason,NOW())");
            return $stmt->execute(array(
                ':uid' => $userId === null ? null : (int)$userId,
                ':type' => $contentType,
                ':hash' => isset($result['hash']) ? $result['hash'] : hash('sha256', isset($result['value']) ? $result['value'] : ''),
                ':decision' => $result['decision'],
                ':reason' => isset($result['reason']) ? $result['reason'] : null
            ));
        } catch (Exception $e) {
            return false;
        }
    }

    private static function blockedTerms()
    {
        $raw = getenv('GRACZ_MODERATION_TERMS');
        if (!$raw) return array();
        return array_values(array_filter(array_map(function ($v) {
            return mb_strtolower(trim($v), 'UTF-8');
        }, explode(',', $raw))));
    }
}
