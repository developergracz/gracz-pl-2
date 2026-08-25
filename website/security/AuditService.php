<?php
final class AuditService
{
    private $pdo;
    private $prefix;

    public function __construct($pdo = null, $prefix = 'prefix')
    {
        $this->pdo = $pdo instanceof PDO ? $pdo : null;
        $this->prefix = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $prefix);
    }

    public function record($event, $actorId = null, array $metadata = array(), $severity = 'info')
    {
        $event = substr(preg_replace('/[^a-zA-Z0-9_.:-]/', '_', (string) $event), 0, 100);
        $severity = in_array($severity, array('info', 'warning', 'critical'), true) ? $severity : 'info';
        $safeMetadata = SecurityService::redact($metadata);
        $ipHash = hash('sha256', SecurityService::clientIp().'|'.self::auditPepper());
        $uaHash = hash('sha256', (isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '').'|'.self::auditPepper());

        if ($this->pdo) {
            try {
                $table = $this->prefix.'_audit_log';
                $sql = "INSERT INTO {$table} (event_type, severity, actor_user_id, ip_hash, user_agent_hash, metadata_json, created_at)
                        VALUES (:event_type, :severity, :actor_user_id, :ip_hash, :user_agent_hash, :metadata_json, NOW())";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute(array(
                    ':event_type' => $event,
                    ':severity' => $severity,
                    ':actor_user_id' => $actorId === null ? null : (int) $actorId,
                    ':ip_hash' => $ipHash,
                    ':user_agent_hash' => $uaHash,
                    ':metadata_json' => json_encode($safeMetadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ));
                return true;
            } catch (Exception $e) {
                // Fall back to append-only file log.
            }
        }

        $line = json_encode(array(
            'ts' => gmdate('c'),
            'event' => $event,
            'severity' => $severity,
            'actor' => $actorId === null ? null : (int) $actorId,
            'ip_hash' => $ipHash,
            'ua_hash' => $uaHash,
            'metadata' => $safeMetadata
        ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n";
        $path = getenv('GRACZ_AUDIT_LOG_PATH');
        if (!$path) {
            $path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'gracz-security-audit.jsonl';
        }
        return @file_put_contents($path, $line, FILE_APPEND | LOCK_EX) !== false;
    }

    private static function auditPepper()
    {
        $pepper = getenv('GRACZ_AUDIT_PEPPER');
        if (!$pepper) {
            $pepper = getenv('GRACZ_APP_KEY');
        }
        return $pepper ? $pepper : 'configure-GRACZ_AUDIT_PEPPER';
    }
}
