ALTER TABLE newsletter_contacts
  ADD COLUMN state_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN provider_blocked_at timestamptz;

CREATE INDEX newsletter_contacts_provider_blocked_idx
  ON newsletter_contacts (provider_blocked_at)
  WHERE provider_blocked_at IS NOT NULL;
