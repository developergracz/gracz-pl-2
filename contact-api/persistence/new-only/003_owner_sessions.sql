-- Dedicated OWNER session store. No legacy newsletter, contact, recipient,
-- subscriber, or migration 005 tables are modified. Apply once, atomically.
CREATE SCHEMA newsletter_owner;
REVOKE ALL ON SCHEMA newsletter_owner FROM PUBLIC;

CREATE TABLE newsletter_owner.guard (
  id integer PRIMARY KEY CHECK (id=1),
  failures integer NOT NULL DEFAULT 0 CHECK (failures BETWEEN 0 AND 4),
  locked_until timestamptz,
  last_totp_step bigint NOT NULL DEFAULT -1
);
INSERT INTO newsletter_owner.guard (id) VALUES (1);

CREATE TABLE newsletter_owner.sessions (
  token_hash char(64) PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  CHECK (expires_at>created_at AND idle_expires_at>created_at)
);
CREATE INDEX sessions_expiry ON newsletter_owner.sessions (expires_at);

CREATE TABLE newsletter_owner.audit (
  event_id uuid PRIMARY KEY,
  action varchar(32) NOT NULL CHECK(action IN
    ('login_ok','login_denied','session_read','subscriber_list',
     'subscriber_detail','logout')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER owner_audit_immutable
BEFORE UPDATE OR DELETE ON newsletter_owner.audit
FOR EACH ROW EXECUTE FUNCTION newsletter_new.reject_mutation();
CREATE TRIGGER owner_audit_no_truncate
BEFORE TRUNCATE ON newsletter_owner.audit
FOR EACH STATEMENT EXECUTE FUNCTION newsletter_new.reject_mutation();

-- Production runtime role only: USAGE schema, SELECT/INSERT/UPDATE on guard,
-- SELECT/INSERT/UPDATE/DELETE on sessions, SELECT/INSERT on audit.
-- No UPDATE/DELETE/TRUNCATE permission on audit. Credentials stay in Render
-- secret settings; no password, TOTP seed, cookie or PII are written into SQL.
