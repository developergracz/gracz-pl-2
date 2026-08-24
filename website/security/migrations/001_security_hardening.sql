-- Gracz.pl security hardening schema (MySQL/MariaDB)
-- Apply on staging first, then production after backup/restore verification.

CREATE TABLE IF NOT EXISTS prefix_security_rate_limits (
  bucket VARCHAR(80) NOT NULL,
  identity_hash CHAR(64) NOT NULL,
  window_start DATETIME NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (bucket, identity_hash, window_start),
  KEY idx_security_rate_limits_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prefix_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(100) NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  actor_user_id BIGINT NULL,
  ip_hash CHAR(64) NOT NULL,
  user_agent_hash CHAR(64) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_audit_event_created (event_type, created_at),
  KEY idx_audit_actor_created (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- No UPDATE/DELETE privileges should be granted to the application DB user on prefix_audit_log.
-- Use a separate maintenance/owner account for retention operations.

CREATE TABLE IF NOT EXISTS prefix_user_roles (
  user_id BIGINT NOT NULL,
  role ENUM('player','moderator','administrator','owner') NOT NULL DEFAULT 'player',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_user_roles_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prefix_two_factor (
  user_id BIGINT NOT NULL,
  method ENUM('totp','webauthn') NOT NULL,
  secret_ciphertext TEXT NULL,
  credential_json JSON NULL,
  recovery_codes_hash TEXT NULL,
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prefix_security_sessions (
  session_hash CHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  revoke_reason VARCHAR(80) NULL,
  ip_hash CHAR(64) NULL,
  user_agent_hash CHAR(64) NULL,
  PRIMARY KEY (session_hash),
  KEY idx_security_sessions_user (user_id, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prefix_security_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purpose ENUM('newsletter_check','newsletter_unsubscribe','password_reset','email_change','account_activation') NOT NULL,
  subject_id BIGINT NULL,
  subject_hash CHAR(64) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_security_token_hash (token_hash),
  KEY idx_security_tokens_subject (purpose, subject_hash, expires_at),
  KEY idx_security_tokens_subject_id (purpose, subject_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prefix_moderation_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NULL,
  content_type ENUM('nickname','chat','message','upload') NOT NULL,
  content_hash CHAR(64) NOT NULL,
  decision ENUM('allow','flag','block') NOT NULL,
  reason_code VARCHAR(80) NULL,
  appealed_at DATETIME NULL,
  appeal_status ENUM('pending','upheld','reversed') NULL,
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_moderation_review (decision, appeal_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cleanup can be run from a low-privilege scheduled maintenance user:
-- DELETE FROM prefix_security_rate_limits WHERE updated_at < NOW() - INTERVAL 2 DAY;
-- DELETE FROM prefix_security_tokens WHERE expires_at < NOW() - INTERVAL 30 DAY;
