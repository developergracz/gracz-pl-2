-- Gracz.pl security hardening (MySQL/MariaDB)
-- Uruchomić najpierw na stagingu. Przed produkcją wykonać backup i test odtworzenia.

CREATE TABLE IF NOT EXISTS gracz_security_rate_limits (
  bucket VARCHAR(80) NOT NULL,
  identifier_hash CHAR(64) NOT NULL,
  window_start DATETIME NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  blocked_until DATETIME NULL,
  PRIMARY KEY (bucket, identifier_hash),
  INDEX idx_blocked_until (blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gracz_audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id BIGINT NULL,
  actor_role VARCHAR(32) NULL,
  event_type VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(191) NULL,
  ip_hash CHAR(64) NOT NULL,
  metadata_json TEXT NULL,
  prev_hash CHAR(64) NULL,
  entry_hash CHAR(64) NOT NULL,
  INDEX idx_created_at (created_at),
  INDEX idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Hashowane tokeny jednorazowe: newsletter / reset / aktywacja.
-- Pola plaintext powinny zostać usunięte dopiero po migracji danych i wdrożeniu kodu korzystającego z *_token_hash.
CREATE TABLE IF NOT EXISTS gracz_secure_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_type VARCHAR(40) NOT NULL,
  subject_id VARCHAR(191) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_token_hash (token_hash),
  INDEX idx_subject_purpose (subject_type, subject_id, purpose),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Role aplikacyjne. Nie przyznajemy praw SQL przez tę tabelę; służy ona wyłącznie RBAC aplikacji.
CREATE TABLE IF NOT EXISTS gracz_user_roles (
  user_id BIGINT NOT NULL,
  role ENUM('player','moderator','administrator','owner') NOT NULL DEFAULT 'player',
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by BIGINT NULL,
  PRIMARY KEY (user_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MFA dla kont uprzywilejowanych. Sekret TOTP MUSI być szyfrowany kluczem z ENV przed zapisem.
CREATE TABLE IF NOT EXISTS gracz_mfa_credentials (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  credential_type ENUM('totp','webauthn') NOT NULL,
  secret_encrypted TEXT NULL,
  credential_json TEXT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  INDEX idx_user_enabled (user_id, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Przykład konta aplikacyjnego DB z minimalnymi prawami należy utworzyć osobno przez administratora MySQL.
-- NIE zapisuj hasła DB w tym pliku ani w repozytorium.
