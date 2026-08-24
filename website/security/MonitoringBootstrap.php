<?php
/** Register once; callback executes after the request when DB may already be connected. */
if (!defined('GRACZ_MONITORING_SHUTDOWN_REGISTERED')) {
    define('GRACZ_MONITORING_SHUTDOWN_REGISTERED', true);
    register_shutdown_function(function () {
        global $database_handle, $database_prefix;
        if (!($database_handle instanceof PDO)) return;
        $last = error_get_last();
        $fatalTypes = array(E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR,E_USER_ERROR,E_RECOVERABLE_ERROR);
        $fatal = is_array($last) && in_array(isset($last['type'])?$last['type']:0,$fatalTypes,true);
        $status = http_response_code();
        if (!$fatal && $status < 500) return;
        try {
            $audit = new AuditService($database_handle,$database_prefix);
            $meta = array('http_status'=>$status >= 500 ? $status : 500);
            if ($fatal) {
                $meta['error_type']=(int)$last['type'];
                $meta['file']=basename((string)$last['file']);
                $meta['line']=(int)$last['line'];
                // Never include the fatal error message; it can contain query values or secrets.
            }
            $audit->record('app.error.500',isset($_SESSION['id'])?$_SESSION['id']:null,$meta,'critical');
        } catch (Exception $e) {}
    });
}
