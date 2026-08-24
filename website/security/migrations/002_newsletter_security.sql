CREATE TABLE IF NOT EXISTS prefix_newsletter_subscribers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email_hash CHAR(64) NOT NULL,
  email_ciphertext TEXT NOT NULL,
  status ENUM('pending','active','unsubscribed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_newsletter_email_hash (email_hash),
  KEY idx_newsletter_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
