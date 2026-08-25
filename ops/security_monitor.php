<?php
// Run from CLI every 5-10 minutes. Do not expose through the web server.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__).'/website';
$actual_path = $root.'/';
require_once $root.'/variables_global.php';
require_once $root.'/security/SecurityBootstrap.php';
require_once $root.'/security/MonitoringService.php';
require_once $root.'/library_main.php';
DatabaseConnect();
$monitor = new MonitoringService($database_handle, $database_prefix);
$alerts = $monitor->inspectLastMinutes((int)(getenv('GRACZ_SECURITY_MONITOR_WINDOW') ?: 10));
if ($alerts) {
    $monitor->notify($alerts);
    GraczAudit()->record('security.monitor.alert', null, array('alerts'=>$alerts), 'critical');
    fwrite(STDOUT, json_encode($alerts, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL);
    exit(2);
}
fwrite(STDOUT, "Security monitor: OK\n");
