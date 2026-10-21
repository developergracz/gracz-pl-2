-- Campaigns R1 schema CANDIDATE. NOT wired to automatic production migrations.
-- Apply only in an approved release after backup and verified consent safeguards.
-- Also extends the existing draft-only schema; apply ONCE in one transaction.
CREATE SCHEMA IF NOT EXISTS newsletter_campaigns;
REVOKE ALL ON SCHEMA newsletter_campaigns FROM PUBLIC;

CREATE TABLE IF NOT EXISTS newsletter_campaigns.campaigns (
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
CREATE OR REPLACE FUNCTION newsletter_campaigns.reserve_confirmed(
  p_campaign uuid, p_dispatch uuid, p_event uuid, p_email_tag char(64)
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE inserted_id uuid;
BEGIN
  -- Lock order matches verified withdrawal: subscriber row first.
  PERFORM 1 FROM newsletter_new.subscribers
    WHERE email_tag=p_email_tag FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM newsletter_campaigns.campaigns c
    WHERE c.id=p_campaign AND c.state='approved'
  ) THEN RETURN false; END IF;
  INSERT INTO newsletter_campaigns.dispatches(id,campaign_id,email_tag)
  SELECT p_dispatch,p_campaign,s.email_tag
  FROM newsletter_new.subscribers s
  WHERE s.email_tag=p_email_tag AND s.state='active'
    AND s.confirmed_at IS NOT NULL
    AND s.delivery_state='sent'
    AND s.consent_version='newsletter-new-only-2026-10-20'
    AND EXISTS (
      SELECT 1 FROM newsletter_new.consent_events e
      WHERE e.email_tag=s.email_tag AND e.event_type='opt_in_confirmed'
        AND e.challenge_id=s.challenge_id AND e.consent_version=s.consent_version
        AND e.source=s.source
    )
    AND NOT EXISTS (
      SELECT 1 FROM newsletter_new.revocations r
      WHERE r.email_tag=s.email_tag AND r.recorded_at>=s.requested_at
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

-- The only state transition allowed before an external send. Lock the same
-- subscriber row as verified withdrawal, then reserve an irrevocable attempt.
-- Caller must commit BEFORE invoking Resend; a crash after commit must not
-- cause a retry. 'inflight' is treated as uncertain until reconciled.
CREATE OR REPLACE FUNCTION newsletter_campaigns.claim_delivery(
  p_campaign uuid, p_dispatch uuid, p_event uuid
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_tag char(64);
BEGIN
  SELECT d.email_tag INTO v_tag
    FROM newsletter_campaigns.dispatches d
    WHERE d.id=p_dispatch AND d.campaign_id=p_campaign;
  IF v_tag IS NULL THEN RETURN false; END IF;

  -- This lock serializes consent withdrawal with the last eligibility read.
  PERFORM 1 FROM newsletter_new.subscribers s
    WHERE s.email_tag=v_tag FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM newsletter_campaigns.campaigns c
    WHERE c.id=p_campaign AND c.state IN ('approved','sending')
  ) AND EXISTS (
    SELECT 1 FROM newsletter_new.subscribers s
    WHERE s.email_tag=v_tag AND s.state='active'
      AND s.confirmed_at IS NOT NULL
    AND s.delivery_state='sent'
    AND s.consent_version='newsletter-new-only-2026-10-20'
      AND EXISTS (
        SELECT 1 FROM newsletter_new.consent_events e
        WHERE e.email_tag=s.email_tag AND e.event_type='opt_in_confirmed'
        AND e.challenge_id=s.challenge_id AND e.consent_version=s.consent_version
        AND e.source=s.source
      )
      AND NOT EXISTS (
        SELECT 1 FROM newsletter_new.revocations r
        WHERE r.email_tag=s.email_tag AND r.recorded_at>=s.requested_at
      )
  ) THEN
    UPDATE newsletter_campaigns.dispatches
      SET state='inflight', attempted_at=clock_timestamp(),
          updated_at=clock_timestamp()
      WHERE id=p_dispatch AND campaign_id=p_campaign AND state='reserved';
    IF NOT FOUND THEN RETURN false; END IF;
    INSERT INTO newsletter_campaigns.dispatch_events
      (id,campaign_id,dispatch_id,event_type)
      VALUES (p_event,p_campaign,p_dispatch,'attempted');
    RETURN true;
  END IF;

  UPDATE newsletter_campaigns.dispatches
    SET state='suppressed', updated_at=clock_timestamp()
    WHERE id=p_dispatch AND campaign_id=p_campaign AND state='reserved';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO newsletter_campaigns.dispatch_events
    (id,campaign_id,dispatch_id,event_type)
    VALUES(p_event,p_campaign,p_dispatch,'suppressed');
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION newsletter_campaigns.claim_delivery(uuid,uuid,uuid)
  FROM PUBLIC;

-- Result recording is monotonic: it never makes a recipient sendable again.
-- An HTTP timeout, ambiguous provider response or process crash is uncertain,
-- not a reason to retry; only a verified provider acceptance becomes accepted.
CREATE FUNCTION newsletter_campaigns.record_delivery_result(
  p_campaign uuid, p_dispatch uuid, p_event uuid, p_accepted boolean
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_state varchar(16);
BEGIN
  v_state := CASE WHEN p_accepted THEN 'accepted' ELSE 'uncertain' END;
  UPDATE newsletter_campaigns.dispatches
  SET state=v_state,updated_at=clock_timestamp()
  WHERE id=p_dispatch AND campaign_id=p_campaign AND state='inflight';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO newsletter_campaigns.dispatch_events
    (id,campaign_id,dispatch_id,event_type)
    VALUES (p_event,p_campaign,p_dispatch,v_state);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION newsletter_campaigns.record_delivery_result(uuid,uuid,uuid,boolean)
  FROM PUBLIC;

-- Approval freezes the exact content, including against direct SQL edits.
CREATE FUNCTION newsletter_campaigns.protect_approved_content()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.approved_at IS NOT NULL AND
     (NEW.subject,NEW.body,NEW.audience,NEW.approved_at) IS DISTINCT FROM
     (OLD.subject,OLD.body,OLD.audience,OLD.approved_at) THEN
    RAISE EXCEPTION 'campaign_approved_content_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER campaigns_approved_content_immutable
BEFORE UPDATE ON newsletter_campaigns.campaigns
FOR EACH ROW EXECUTE FUNCTION newsletter_campaigns.protect_approved_content();
REVOKE ALL ON TABLE newsletter_campaigns.dispatches,newsletter_campaigns.dispatch_events FROM PUBLIC;
