<?php
require_once __DIR__.'/SecurityService.php';
require_once __DIR__.'/TokenService.php';
require_once __DIR__.'/RateLimitService.php';
require_once __DIR__.'/AuditService.php';
require_once __DIR__.'/TurnstileService.php';

SecurityService::sendSecurityHeaders();
SecurityService::configureSessionCookie();

/**
 * Return shared security services after the legacy PDO connection exists.
 */
function GraczRateLimiter()
{
    global $database_handle, $database_prefix;
    return new RateLimitService($database_handle, $database_prefix);
}

function GraczAudit()
{
    global $database_handle, $database_prefix;
    return new AuditService($database_handle, $database_prefix);
}

function GraczRequireCsrf()
{
    return SecurityService::verifyStateChangingRequest();
}
