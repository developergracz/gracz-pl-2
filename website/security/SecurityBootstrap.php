<?php
require_once __DIR__.'/SecurityService.php';
require_once __DIR__.'/TokenService.php';
require_once __DIR__.'/RateLimitService.php';
require_once __DIR__.'/AuditService.php';
require_once __DIR__.'/TurnstileService.php';
require_once __DIR__.'/DataProtectionService.php';
require_once __DIR__.'/UploadSecurityService.php';
require_once __DIR__.'/ModerationService.php';
require_once __DIR__.'/TwoFactorService.php';
require_once __DIR__.'/RbacService.php';
require_once __DIR__.'/SecureMailService.php';
require_once __DIR__.'/NewsletterService.php';
require_once __DIR__.'/SessionService.php';
require_once __DIR__.'/PasswordResetService.php';
require_once __DIR__.'/AdminActionService.php';
require_once __DIR__.'/MonitoringBootstrap.php';

SecurityService::sendSecurityHeaders();
SecurityService::configureSessionCookie();

function GraczRateLimiter(){ global $database_handle,$database_prefix; return new RateLimitService($database_handle,$database_prefix); }
function GraczAudit(){ global $database_handle,$database_prefix; return new AuditService($database_handle,$database_prefix); }
function GraczNewsletter(){ global $database_handle,$database_prefix; if(!($database_handle instanceof PDO)) throw new RuntimeException('Database connection unavailable.'); return new NewsletterService($database_handle,$database_prefix); }
function GraczSessions(){ global $database_handle,$database_prefix; if(!($database_handle instanceof PDO)) throw new RuntimeException('Database connection unavailable.'); return new SessionService($database_handle,$database_prefix); }
function GraczPasswordReset(){ global $database_handle,$database_prefix,$seed_private; if(!($database_handle instanceof PDO)) throw new RuntimeException('Database connection unavailable.'); return new PasswordResetService($database_handle,$database_prefix,$seed_private); }
function GraczAdminActions(){ global $database_handle,$database_prefix; if(!($database_handle instanceof PDO)) throw new RuntimeException('Database connection unavailable.'); return new AdminActionService($database_handle,$database_prefix,GraczAudit()); }
function GraczRequireCsrf(){ return SecurityService::verifyStateChangingRequest(); }
function GraczRequirePermission($permission){ global $database_handle,$database_prefix; return RbacService::requirePermission($permission,$database_handle,$database_prefix); }
function GraczRequireAdmin2fa(){ global $database_handle,$database_prefix; return RbacService::requireAdmin2fa($database_handle,$database_prefix); }
