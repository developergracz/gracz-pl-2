-- Run as the database owner/DBA. Replace database/user names for each environment.
-- The web application account must not have SUPER, FILE, PROCESS, CREATE USER, GRANT OPTION,
-- DROP DATABASE, or global privileges.

CREATE USER IF NOT EXISTS 'gracz_app'@'%' IDENTIFIED BY 'SET-A-RANDOM-PASSWORD-OUTSIDE-GIT';

GRANT SELECT, INSERT, UPDATE, DELETE ON gracz.prefix_users TO 'gracz_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON gracz.prefix_security_rate_limits TO 'gracz_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON gracz.prefix_security_sessions TO 'gracz_app'@'%';
GRANT SELECT, INSERT, UPDATE ON gracz.prefix_security_tokens TO 'gracz_app'@'%';
GRANT SELECT, INSERT, UPDATE ON gracz.prefix_newsletter_subscribers TO 'gracz_app'@'%';
GRANT SELECT, INSERT, UPDATE ON gracz.prefix_user_roles TO 'gracz_app'@'%';
GRANT SELECT, INSERT, UPDATE ON gracz.prefix_two_factor TO 'gracz_app'@'%';
GRANT SELECT, INSERT, UPDATE ON gracz.prefix_moderation_events TO 'gracz_app'@'%';

-- Audit log is append-only for the application: it can INSERT and read, but cannot UPDATE/DELETE.
GRANT SELECT, INSERT ON gracz.prefix_audit_log TO 'gracz_app'@'%';

-- Existing application tables should receive only the exact grants actually required.
-- Do NOT use GRANT ALL ON gracz.* for the web application account.
-- Maintenance/migrations/backups should use separate, narrowly-scoped accounts and credentials.

FLUSH PRIVILEGES;
