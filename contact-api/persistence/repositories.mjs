function assertHash(value, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new TypeError(field + " must be a lowercase SHA-256 hex digest");
  }
  return normalized;
}

function assertDatabase(database) {
  if (!database?.enabled || typeof database.query !== "function") {
    const error = new Error("Durable persistence is not configured.");
    error.code = "PERSISTENCE_NOT_CONFIGURED";
    throw error;
  }
}

export function createPersistenceRepositories(database) {
  assertDatabase(database);

  const contactCases = {
    async create({
      requestId,
      senderHash,
      category,
      subject,
      sourcePath = "",
    }) {
      const result = await database.query(
        `INSERT INTO contact_cases(
          request_id, sender_hash, category, subject, source_path
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (request_id) DO NOTHING
        RETURNING request_id`,
        [
          requestId,
          assertHash(senderHash, "senderHash"),
          String(category || "").slice(0, 80),
          String(subject || "").slice(0, 180),
          String(sourcePath || "").slice(0, 500),
        ]
      );
      return result.rowCount === 1;
    },

    async markDelivered(requestId, providerMessageId) {
      const result = await database.query(
        `UPDATE contact_cases
         SET delivery_status = 'sent',
             provider_message_id = $2,
             last_error_code = NULL,
             updated_at = now()
         WHERE request_id = $1
         RETURNING request_id`,
        [requestId, String(providerMessageId || "").slice(0, 200) || null]
      );
      return result.rowCount === 1;
    },

    async markDeliveryFailed(requestId, errorCode) {
      const result = await database.query(
        `UPDATE contact_cases
         SET delivery_status = 'failed',
             last_error_code = $2,
             updated_at = now()
         WHERE request_id = $1
         RETURNING request_id`,
        [requestId, String(errorCode || "MAIL_DELIVERY_FAILED").slice(0, 120)]
      );
      return result.rowCount === 1;
    },
  };

  const replyTokens = {
    async issue({
      jtiHash,
      requestId,
      expiresAt,
      providerIdempotencyKey,
    }) {
      const result = await database.query(
        `INSERT INTO reply_tokens(
          jti_hash, request_id, expires_at, provider_idempotency_key
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (jti_hash) DO NOTHING
        RETURNING jti_hash`,
        [
          assertHash(jtiHash, "jtiHash"),
          requestId,
          expiresAt,
          String(providerIdempotencyKey || "").slice(0, 200),
        ]
      );
      return result.rowCount === 1;
    },

    async claim(jtiHash) {
      const hash = assertHash(jtiHash, "jtiHash");
      const claimed = await database.query(
        `UPDATE reply_tokens
         SET state = 'inflight', updated_at = now()
         WHERE jti_hash = $1
           AND state = 'issued'
           AND expires_at > now()
         RETURNING jti_hash, request_id, state, expires_at,
                   provider_idempotency_key`,
        [hash]
      );

      if (claimed.rowCount === 1) {
        return { claimed: true, token: claimed.rows[0] };
      }

      await database.query(
        `UPDATE reply_tokens
         SET state = 'expired', updated_at = now()
         WHERE jti_hash = $1
           AND state = 'issued'
           AND expires_at <= now()`,
        [hash]
      );

      const current = await database.query(
        `SELECT jti_hash, request_id, state, expires_at,
                provider_idempotency_key, used_at
         FROM reply_tokens
         WHERE jti_hash = $1`,
        [hash]
      );

      return {
        claimed: false,
        token: current.rows[0] || null,
      };
    },

    async markUsed(jtiHash) {
      const result = await database.query(
        `UPDATE reply_tokens
         SET state = 'used', used_at = now(), updated_at = now()
         WHERE jti_hash = $1 AND state = 'inflight'
         RETURNING jti_hash`,
        [assertHash(jtiHash, "jtiHash")]
      );
      return result.rowCount === 1;
    },

    async release(jtiHash) {
      const result = await database.query(
        `UPDATE reply_tokens
         SET state = CASE WHEN expires_at > now() THEN 'issued' ELSE 'expired' END,
             updated_at = now()
         WHERE jti_hash = $1 AND state = 'inflight'
         RETURNING state`,
        [assertHash(jtiHash, "jtiHash")]
      );
      return result.rows[0]?.state || null;
    },
  };

  const idempotency = {
    async reserve({
      scope,
      keyHash,
      fingerprint,
      expiresAt,
    }) {
      const normalizedScope = String(scope || "").trim().slice(0, 80);
      if (!normalizedScope) throw new TypeError("scope is required");
      const key = assertHash(keyHash, "keyHash");
      const fp = assertHash(fingerprint, "fingerprint");

      const inserted = await database.query(
        `INSERT INTO idempotency_keys(
          scope, key_hash, fingerprint, state, expires_at
        ) VALUES ($1, $2, $3, 'inflight', $4)
        ON CONFLICT (scope, key_hash) DO UPDATE
        SET fingerprint = EXCLUDED.fingerprint,
            state = 'inflight',
            response_status = NULL,
            response_body = NULL,
            expires_at = EXCLUDED.expires_at,
            updated_at = now()
        WHERE idempotency_keys.expires_at <= now()
        RETURNING scope, key_hash, fingerprint, state, response_status,
                  response_body, expires_at`,
        [normalizedScope, key, fp, expiresAt]
      );

      if (inserted.rowCount === 1) {
        return { reserved: true, record: inserted.rows[0] };
      }

      const existing = await database.query(
        `SELECT scope, key_hash, fingerprint, state, response_status,
                response_body, expires_at
         FROM idempotency_keys
         WHERE scope = $1 AND key_hash = $2`,
        [normalizedScope, key]
      );

      return {
        reserved: false,
        record: existing.rows[0] || null,
      };
    },

    async complete({
      scope,
      keyHash,
      fingerprint,
      status,
      body,
    }) {
      const result = await database.query(
        `UPDATE idempotency_keys
         SET state = 'done',
             response_status = $4,
             response_body = $5::jsonb,
             updated_at = now()
         WHERE scope = $1
           AND key_hash = $2
           AND fingerprint = $3
           AND state = 'inflight'
         RETURNING scope, key_hash`,
        [
          String(scope || "").trim().slice(0, 80),
          assertHash(keyHash, "keyHash"),
          assertHash(fingerprint, "fingerprint"),
          Number(status),
          JSON.stringify(body ?? null),
        ]
      );
      return result.rowCount === 1;
    },

    async release({ scope, keyHash, fingerprint }) {
      const result = await database.query(
        `DELETE FROM idempotency_keys
         WHERE scope = $1
           AND key_hash = $2
           AND fingerprint = $3
           AND state = 'inflight'`,
        [
          String(scope || "").trim().slice(0, 80),
          assertHash(keyHash, "keyHash"),
          assertHash(fingerprint, "fingerprint"),
        ]
      );
      return result.rowCount === 1;
    },
  };

  const newsletter = {
    async upsertContact({
      emailHash,
      providerContactId = null,
      currentState,
      consentVersion = null,
      confirmedAt = null,
      unsubscribedAt = null,
    }) {
      const result = await database.query(
        `INSERT INTO newsletter_contacts(
          email_hash, provider_contact_id, current_state, consent_version,
          confirmed_at, unsubscribed_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email_hash) DO UPDATE
        SET provider_contact_id = COALESCE(EXCLUDED.provider_contact_id, newsletter_contacts.provider_contact_id),
            current_state = EXCLUDED.current_state,
            consent_version = COALESCE(EXCLUDED.consent_version, newsletter_contacts.consent_version),
            confirmed_at = COALESCE(EXCLUDED.confirmed_at, newsletter_contacts.confirmed_at),
            unsubscribed_at = COALESCE(EXCLUDED.unsubscribed_at, newsletter_contacts.unsubscribed_at),
            updated_at = now()
        RETURNING email_hash, current_state, consent_version,
                  confirmed_at, unsubscribed_at`,
        [
          assertHash(emailHash, "emailHash"),
          providerContactId ? String(providerContactId).slice(0, 200) : null,
          String(currentState || "").trim(),
          consentVersion ? String(consentVersion).slice(0, 120) : null,
          confirmedAt,
          unsubscribedAt,
        ]
      );
      return result.rows[0];
    },

    async appendConsentEvent({
      eventId,
      emailHash,
      eventType,
      consentVersion = null,
      source,
      occurredAt = new Date(),
      correlationId = null,
      providerRef = null,
      metadata = {},
    }) {
      const result = await database.query(
        `INSERT INTO newsletter_consent_events(
          event_id, email_hash, event_type, consent_version, source,
          occurred_at, correlation_id, provider_ref, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        RETURNING event_id`,
        [
          eventId,
          assertHash(emailHash, "emailHash"),
          String(eventType || "").trim(),
          consentVersion ? String(consentVersion).slice(0, 120) : null,
          String(source || "").slice(0, 120),
          occurredAt,
          correlationId ? String(correlationId).slice(0, 200) : null,
          providerRef ? String(providerRef).slice(0, 200) : null,
          JSON.stringify(metadata || {}),
        ]
      );
      return result.rows[0]?.event_id || null;
    },

    async listConsentEvents(emailHash) {
      const result = await database.query(
        `SELECT event_id, event_type, consent_version, source, occurred_at,
                correlation_id, provider_ref, metadata
         FROM newsletter_consent_events
         WHERE email_hash = $1
         ORDER BY occurred_at ASC, event_id ASC`,
        [assertHash(emailHash, "emailHash")]
      );
      return result.rows;
    },
  };

  return Object.freeze({
    contactCases,
    replyTokens,
    idempotency,
    newsletter,
  });
}
