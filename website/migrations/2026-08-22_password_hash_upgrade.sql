-- Gracz.pl legacy password migration
-- Required before all accounts can be transparently upgraded from legacy SHA-1
-- to password_hash() (Argon2id where available, otherwise PHP default).
--
-- Run once against the legacy MySQL database during a maintenance window.

ALTER TABLE prefix_users
  MODIFY COLUMN password VARCHAR(255) NULL;

-- Optional verification after migration:
-- SELECT CHARACTER_MAXIMUM_LENGTH
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'prefix_users'
--   AND COLUMN_NAME = 'password';
