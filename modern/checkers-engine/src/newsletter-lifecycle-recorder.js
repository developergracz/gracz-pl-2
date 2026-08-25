import pg from "pg";
const { Pool } = pg;

export class NewsletterLifecycleRecorder {
  constructor(databaseUrl = null) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false }, max: 2 }) : null;
  }

  async captureSubscribe(emailNormalized, sourceCode = "homepage") {
    if (!this.pool) return;
    const subscriber = await this.#subscriberByEmail(emailNormalized);
    if (!subscriber) return;
    await this.#ensureSource(subscriber.id, sourceCode);
    await this.#recordConsent(subscriber, "granted", sourceCode, subscriber.consented_at);
    await this.#recordEvent(subscriber.id, "subscribe.requested", sourceCode, new Date());
    if (subscriber.confirmation_sent_at) await this.#recordEvent(subscriber.id, "subscribe.confirmation_sent", sourceCode, subscriber.confirmation_sent_at, true);
  }

  async captureResend(emailNormalized, sourceCode = "homepage") {
    if (!this.pool) return;
    const subscriber = await this.#subscriberByEmail(emailNormalized);
    if (!subscriber) return;
    await this.#ensureSource(subscriber.id, sourceCode);
    await this.#recordEvent(subscriber.id, "subscribe.resend_requested", sourceCode, new Date());
    if (subscriber.confirmation_sent_at) await this.#recordEvent(subscriber.id, "subscribe.confirmation_sent", sourceCode, subscriber.confirmation_sent_at, true);
  }

  async findConfirmationContext(tokenHash) {
    if (!this.pool || !tokenHash) return null;
    const { rows } = await this.pool.query(
      `SELECT id,consent_version FROM gracz_newsletter_subscribers WHERE confirmation_token_hash=$1 AND status='pending_confirmation' LIMIT 1`,
      [tokenHash],
    );
    return rows[0] || null;
  }

  async captureConfirmed(subscriberId, sourceCode = "homepage") {
    if (!this.pool || !subscriberId) return;
    const subscriber = await this.#subscriberById(subscriberId);
    if (!subscriber?.confirmed_at) return;
    await this.#ensureSource(subscriber.id, sourceCode);
    await this.#recordConsent(subscriber, "confirmed", sourceCode, subscriber.confirmed_at);
    await this.#recordEvent(subscriber.id, "subscribe.confirmed", sourceCode, subscriber.confirmed_at, true);
  }

  async findUnsubscribeContext(tokenHash) {
    if (!this.pool || !tokenHash) return null;
    const { rows } = await this.pool.query(
      `SELECT id,consent_version FROM gracz_newsletter_subscribers WHERE unsubscribe_token_hash=$1 AND status='subscribed' LIMIT 1`,
      [tokenHash],
    );
    return rows[0] || null;
  }

  async captureUnsubscribed(subscriberId, sourceCode = "homepage") {
    if (!this.pool || !subscriberId) return;
    const subscriber = await this.#subscriberById(subscriberId);
    if (!subscriber?.unsubscribed_at) return;
    await this.#ensureSource(subscriber.id, sourceCode);
    await this.#recordConsent(subscriber, "revoked", sourceCode, subscriber.unsubscribed_at);
    await this.#recordEvent(subscriber.id, "subscribe.unsubscribed", sourceCode, subscriber.unsubscribed_at, true);
  }

  async #subscriberByEmail(emailNormalized) {
    const { rows } = await this.pool.query(
      `SELECT id,consent_version,consented_at,confirmation_sent_at,confirmed_at,unsubscribed_at FROM gracz_newsletter_subscribers WHERE email_normalized=$1 LIMIT 1`,
      [String(emailNormalized || "").toLowerCase()],
    );
    return rows[0] || null;
  }

  async #subscriberById(id) {
    const { rows } = await this.pool.query(
      `SELECT id,consent_version,consented_at,confirmation_sent_at,confirmed_at,unsubscribed_at FROM gracz_newsletter_subscribers WHERE id=$1 LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  async #sourceId(sourceCode) {
    const code = String(sourceCode || "homepage").trim().toLowerCase();
    const { rows } = await this.pool.query(`SELECT id FROM newsletter_sources WHERE code=$1 AND active=TRUE LIMIT 1`, [code]);
    return rows[0]?.id || null;
  }

  async #ensureSource(subscriberId, sourceCode) {
    const sourceId = await this.#sourceId(sourceCode);
    if (!sourceId) return null;
    await this.pool.query(
      `INSERT INTO newsletter_subscriber_sources(subscriber_id,source_id) VALUES($1,$2) ON CONFLICT(subscriber_id,source_id) DO NOTHING`,
      [subscriberId, sourceId],
    );
    return sourceId;
  }

  async #recordConsent(subscriber, action, sourceCode, occurredAt) {
    if (!occurredAt || !subscriber?.consent_version) return;
    await this.pool.query(
      `INSERT INTO newsletter_consent_history(subscriber_id,consent_type,consent_version,action,source,occurred_at,metadata)
       SELECT $1,'marketing_newsletter',$2,$3,$4,$5,'{}'::jsonb
       WHERE NOT EXISTS(
         SELECT 1 FROM newsletter_consent_history
         WHERE subscriber_id=$1 AND consent_type='marketing_newsletter' AND consent_version=$2 AND action=$3 AND occurred_at=$5
       )`,
      [subscriber.id, subscriber.consent_version, action, String(sourceCode || "homepage").toLowerCase(), occurredAt],
    );
  }

  async #recordEvent(subscriberId, eventType, sourceCode, occurredAt, dedupe = false) {
    const sourceId = await this.#sourceId(sourceCode);
    if (dedupe) {
      await this.pool.query(
        `INSERT INTO newsletter_events(subscriber_id,event_type,source_id,occurred_at,metadata)
         SELECT $1,$2,$3,$4,'{}'::jsonb
         WHERE NOT EXISTS(
           SELECT 1 FROM newsletter_events WHERE subscriber_id=$1 AND event_type=$2 AND occurred_at=$4
         )`,
        [subscriberId, eventType, sourceId, occurredAt],
      );
      return;
    }
    await this.pool.query(
      `INSERT INTO newsletter_events(subscriber_id,event_type,source_id,occurred_at,metadata) VALUES($1,$2,$3,$4,'{}'::jsonb)`,
      [subscriberId, eventType, sourceId, occurredAt],
    );
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}
