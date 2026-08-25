<?php
final class MonitoringService
{
    private $pdo;
    private $prefix;

    public function __construct(PDO $pdo, $prefix)
    {
        $this->pdo = $pdo;
        $this->prefix = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$prefix);
    }

    public function inspectLastMinutes($minutes = 10)
    {
        $minutes = max(1, min(1440, (int)$minutes));
        $table = $this->prefix.'_audit_log';
        $thresholds = array(
            'auth.login.failed' => 25,
            'account.registration.created' => 20,
            'auth.password_reset.requested' => 15,
            'newsletter.signup_requested' => 30,
            'admin.legacy_get_mutation.blocked' => 1
        );
        $alerts = array();
        foreach ($thresholds as $event => $threshold) {
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM {$table} WHERE event_type=:event AND created_at >= DATE_SUB(NOW(), INTERVAL {$minutes} MINUTE)");
            $stmt->execute(array(':event'=>$event));
            $count = (int)$stmt->fetchColumn();
            if ($count >= $threshold) $alerts[] = array('event'=>$event,'count'=>$count,'threshold'=>$threshold,'minutes'=>$minutes);
        }

        // Generic application errors recorded by the security audit layer.
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM {$table} WHERE severity='critical' AND created_at >= DATE_SUB(NOW(), INTERVAL {$minutes} MINUTE)");
        $stmt->execute();
        $critical = (int)$stmt->fetchColumn();
        if ($critical >= 1) $alerts[] = array('event'=>'critical_security_events','count'=>$critical,'threshold'=>1,'minutes'=>$minutes);
        return $alerts;
    }

    public function notify(array $alerts)
    {
        if (!$alerts) return true;
        $to = getenv('GRACZ_SECURITY_ALERT_EMAIL');
        if (!$to) return false;
        $lines = array('Gracz.pl — alert bezpieczeństwa', 'UTC: '.gmdate('c'), '');
        foreach ($alerts as $a) {
            $lines[] = sprintf('%s: %d zdarzeń w %d min (próg %d)', $a['event'], $a['count'], $a['minutes'], $a['threshold']);
        }
        return SecureMailService::send($to, '[Gracz.pl] Alert bezpieczeństwa', implode("\n", $lines));
    }
}
