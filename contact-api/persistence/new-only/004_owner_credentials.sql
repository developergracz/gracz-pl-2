-- M5: only OWNER account settings. Existing Render credentials remain the
-- bootstrap source until OWNER explicitly changes the password or nickname.
-- Never copy an environment password verifier into logs or migration output.
CREATE TABLE newsletter_owner.credentials (
  id integer PRIMARY KEY CHECK (id=1),
  username varchar(32) NOT NULL
    CHECK (username ~ '^[A-Za-z][A-Za-z0-9._-]{2,31}$'),
  password_verifier text NOT NULL
    CHECK (password_verifier ~ '^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON newsletter_owner.credentials FROM PUBLIC;
ALTER TABLE newsletter_owner.audit DROP CONSTRAINT audit_action_check;
ALTER TABLE newsletter_owner.audit ADD CONSTRAINT audit_action_check
  CHECK (action IN ('login_ok','login_denied','session_read',
                   'subscriber_list','subscriber_detail','logout','credentials_changed'));
-- API role: SELECT, INSERT and UPDATE credentials; never DELETE/TRUNCATE.
-- Existing single OWNER guard and sessions stay in place; no newsletter data touched.
