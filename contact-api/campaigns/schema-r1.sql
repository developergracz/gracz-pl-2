-- Campaigns R1 schema CANDIDATE. NOT wired to automatic production migrations.
-- Apply only in an approved release after backup and verified consent safeguards.
CREATE SCHEMA newsletter_campaigns;
REVOKE ALL ON SCHEMA newsletter_campaigns FROM PUBLIC;

CREATE TABLE newsletter_campaigns.campaigns (
  id uuid PRIMARY KEY,
  subject varchar(160) NOT NULL CHECK (length(subject) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (length(body) BETWEEN 10 AND 20000),
  audience varchar(40) NOT NULL
    CHECK (audience = 'confirmed_active_new_only'),
  state varchar(16) NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','approved','sending','completed','paused')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  CHECK ((state = 'draft' AND approved_at IS NULL) OR
         (state <> 'draft' AND approved_at IS NOT NULL))
);

CREATE TABLE newsletter_campaigns.dispatches (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES newsletter_campaigns.campaigns(id),
  -- An irreversible pseudonymous recipient reference, never a clear address.
  email_tag char(64) NOT NULL CHECK (email_tag ~ '^[0-9a-f]{64}$'),
  state varchar(16) NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved','inflight','uncertain','accepted','suppressed')),
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (campaign_id,email_tag),
  UNIQUE (campaign_id,id),
  CHECK ((state='reserved' AND attempted_at IS NULL) OR
         (state IN ('inflight','uncertain','accepted') AND attempted_at IS NOT NULL) OR
         state='suppressed')
);
CREATE INDEX dispatches_by_campaign_state
  ON newsletter_campaigns.dispatches(campaign_id,state);
-- The application must use durable compare-and-set transitions.
-- Unknown send effects are permanently held for operator reconciliation.
-- No automatic timeout-based release or retry after an external attempt.

-- Immutable dispatch event history, with no personal addresses.
CREATE TABLE newsletter_campaigns.dispatch_events (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL,
  dispatch_id uuid NOT NULL,
  event_type varchar(24) NOT NULL CHECK (
    event_type IN ('reserved','suppressed','attempted','accepted','uncertain')
  ),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (campaign_id,dispatch_id)
    REFERENCES newsletter_campaigns.dispatches(campaign_id,id)
);
CREATE INDEX campaign_dispatch_events ON newsletter_campaigns.dispatch_events
  (campaign_id,dispatch_id,recorded_at);

CREATE FUNCTION newsletter_campaigns.deny_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'campaign event log is append-only';
END $$;
CREATE TRIGGER dispatch_events_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON newsletter_campaigns.dispatch_events
FOR EACH STATEMENT EXECUTE FUNCTION newsletter_campaigns.deny_event_mutation();
REVOKE UPDATE,DELETE,TRUNCATE ON newsletter_campaigns.dispatch_events FROM PUBLIC;

-- Atomic, idempotent reservation, conditional on current recorded DOI and no
-- withdrawal. Reservation does NOT authorize sending: the sender must recheck
-- permission immediately before each external effect.
CREATE FUNCTION newsletter_campaigns.reserve_confirmed(
  p_campaign uuid, p_dispatch uuid, p_event uuid, p_email_tag char(64)
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE inserted_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM newsletter_campaigns.campaigns c
    WHERE c.id=p_campaign AND c.state='approved'
  ) THEN RETURN false; END IF;
  INSERT INTO newsletter_campaigns.dispatches(id,campaign_id,email_tag)
  SELECT p_dispatch,p_campaign,s.email_tag
  FROM newsletter_new.subscribers s
  WHERE s.email_tag=p_email_tag AND s.state='active'
    AND s.confirmed_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM newsletter_new.consent_events e
      WHERE e.email_tag=s.email_tag AND e.event_type='opt_in_confirmed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM newsletter_new.revocations r
      WHERE r.email_tag=s.email_tag
    )
  ON CONFLICT (campaign_id,email_tag) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN RETURN false; END IF;
  INSERT INTO newsletter_campaigns.dispatch_events
    (id,campaign_id,dispatch_id,event_type)
    VALUES(p_event,p_campaign,inserted_id,'reserved');
  RETURN true;
END $$;
-- IMPORTANT: revoke EXECUTE by default until the approved operator-specific
-- role grant; never expose via an unauthenticated or public route.
REVOKE ALL ON FUNCTION newsletter_campaigns.reserve_confirmed(uuid,uuid,uuid,char(64))
  FROM PUBLIC;
