CREATE TABLE IF NOT EXISTS gracz_audit_log(
  event_id UUID PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id VARCHAR(128),
  event_type VARCHAR(96) NOT NULL,
  outcome VARCHAR(24) NOT NULL,
  target_type VARCHAR(64),
  target_id VARCHAR(128),
  source_hash CHAR(64),
  user_agent_hash CHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS gracz_audit_log_time_idx ON gracz_audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS gracz_audit_log_actor_idx ON gracz_audit_log(actor_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS gracz_audit_log_type_idx ON gracz_audit_log(event_type,occurred_at DESC);

CREATE OR REPLACE FUNCTION gracz_audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'gracz_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gracz_audit_log_block_mutation ON gracz_audit_log;
CREATE TRIGGER gracz_audit_log_block_mutation BEFORE UPDATE OR DELETE ON gracz_audit_log FOR EACH ROW EXECUTE FUNCTION gracz_audit_log_immutable();
REVOKE UPDATE, DELETE, TRUNCATE ON gracz_audit_log FROM PUBLIC;
