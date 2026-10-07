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
      const hash = assertHash(jtiHash, "jtiHash");
      return database.transaction(async (client) => {
        const result = await client.query(
          `INSERT INTO reply_tokens(
            jti_hash, request_id, expires_at, provider_idempotency_key
          ) VALUES ($1, $2, $3, $4)
          ON CONFLICT (jti_hash) DO NOTHING
          RETURNING jti_hash`,
          [
            hash,
            requestId,
            expiresAt,
            String(providerIdempotencyKey || "").slice(0, 200),
          ]
        );

        if (result.rowCount !== 1) return false;

        const parent = await client.query(
          `UPDATE contact_cases
           SET reply_status = 'available', updated_at = now()
           WHERE request_id = $1
           RETURNING request_id`,
          [requestId]
        );

        if (parent.rowCount !== 1) {
          throw new Error("Premium Reply token requires an existing contact case.");
        }

        return true;
      });
    },

    async claim(jtiHash, messageHash, { leaseMs = 30_000 } = {}) {
      const hash = assertHash(jtiHash, "jtiHash");
      const message = assertHash(messageHash, "messageHash");
      const normalizedLeaseMs = Math.max(
        5_000,
        Math.min(120_000, Number(leaseMs) || 30_000)
      );

      const claimed = await database.query(
        `UPDATE reply_tokens
         SET state = 'inflight',
             message_hash = COALESCE(message_hash, $2),
             claim_expires_at = now() + ($3::bigint * interval '1 millisecond'),
             last_error_code = NULL,
             updated_at = now()
         WHERE jti_hash = $1
           AND expires_at > now()
           AND (message_hash IS NULL OR message_hash = $2)
           AND (
             state = 'issued'
             OR (
               state = 'inflight'
               AND claim_expires_at IS NOT NULL
               AND claim_expires_at <= now()
               AND message_hash = $2
             )
           )
         RETURNING jti_hash, request_id, state, expires_at,
                   provider_idempotency_key, message_hash, claim_expires_at`,
        [hash, message, normalizedLeaseMs]
      );

      if (claimed.rowCount === 1) {
        return { claimed: true, token: claimed.rows[0], messageConflict: false };
      }

      await database.query(
        `UPDATE reply_tokens
         SET state = 'expired',
             claim_expires_at = NULL,
             updated_at = now()
         WHERE jti_hash = $1
           AND state <> 'used'
           AND expires_at <= now()`,
        [hash]
      );

      const current = await database.query(
        `SELECT jti_hash, request_id, state, expires_at,
                provider_idempotency_key, message_hash, claim_expires_at,
                provider_message_id, last_error_code, used_at
         FROM reply_tokens
         WHERE jti_hash = $1`,
        [hash]
      );

      const token = current.rows[0] || null;
      return {
        claimed: false,
        token,
        messageConflict: Boolean(
          token?.message_hash && token.message_hash !== message
        ),
      };
    },

    async markUsed(jtiHash, messageHash, providerMessageId = null) {
      const hash = assertHash(jtiHash, "jtiHash");
      const message = assertHash(messageHash, "messageHash");

      return database.transaction(async (client) => {
        const result = await client.query(
          `UPDATE reply_tokens
           SET state = 'used',
               used_at = now(),
               claim_expires_at = NULL,
               provider_message_id = $3,
               last_error_code = NULL,
               updated_at = now()
           WHERE jti_hash = $1
             AND state = 'inflight'
             AND message_hash = $2
           RETURNING request_id`,
          [
            hash,
            message,
            String(providerMessageId || "").slice(0, 200) || null,
          ]
        );

        if (result.rowCount !== 1) return false;

        await client.query(
          `UPDATE contact_cases
           SET reply_status = 'sent', updated_at = now()
           WHERE request_id = $1`,
          [result.rows[0].request_id]
        );

        return true;
      });
    },

    async release(jtiHash, messageHash, errorCode = null) {
      const result = await database.query(
        `UPDATE reply_tokens
         SET state = CASE WHEN expires_at > now() THEN 'issued' ELSE 'expired' END,
             claim_expires_at = NULL,
             last_error_code = $3,
             updated_at = now()
         WHERE jti_hash = $1
           AND state = 'inflight'
           AND message_hash = $2
         RETURNING state`,
        [
          assertHash(jtiHash, "jtiHash"),
          assertHash(messageHash, "messageHash"),
          String(errorCode || "").slice(0, 120) || null,
        ]
      );
      return result.rows[0]?.state || null;
    },

    async get(jtiHash) {
      const result = await database.query(
        `SELECT jti_hash, request_id, state, expires_at,
                provider_idempotency_key, message_hash, claim_expires_at,
                provider_message_id, last_error_code, used_at
         FROM reply_tokens
         WHERE jti_hash = $1`,
        [assertHash(jtiHash, "jtiHash")]
      );
      return result.rows[0] || null;
    },
  };

  const idempotency = {
    async get({ scope, keyHash }) {
      const normalizedScope = String(scope || "").trim().slice(0, 80);
      if (!normalizedScope) throw new TypeError("scope is required");

      const result = await database.query(
        `SELECT scope, key_hash, fingerprint, state, response_status,
                response_body, expires_at, created_at, updated_at
         FROM idempotency_keys
         WHERE scope = $1 AND key_hash = $2`,
        [normalizedScope, assertHash(keyHash, "keyHash")]
      );

      return result.rows[0] || null;
    },

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
        WHERE idempotency_keys.state = 'done'
          AND idempotency_keys.expires_at <= now()
        RETURNING scope, key_hash, fingerprint, state, response_status,
                  response_body, expires_at, created_at, updated_at`,
        [normalizedScope, key, fp, expiresAt]
      );

      if (inserted.rowCount === 1) {
        return { reserved: true, record: inserted.rows[0] };
      }

      const existing = await database.query(
        `SELECT scope, key_hash, fingerprint, state, response_status,
                response_body, expires_at, created_at, updated_at
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
    async ensureContact({
      emailHash,
      consentVersion = null,
    }) {
      const result = await database.query(
        `INSERT INTO newsletter_contacts(
          email_hash, current_state, consent_version
        ) VALUES ($1, 'pending', $2)
        ON CONFLICT (email_hash) DO UPDATE
        SET consent_version = COALESCE(
              EXCLUDED.consent_version,
              newsletter_contacts.consent_version
            ),
            updated_at = now()
        RETURNING email_hash, provider_contact_id, current_state,
                  consent_version, confirmed_at, unsubscribed_at,
                  provider_blocked_at, state_version`,
        [
          assertHash(emailHash, "emailHash"),
          consentVersion ? String(consentVersion).slice(0, 120) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async getContact(emailHash) {
      const result = await database.query(
        `SELECT email_hash, provider_contact_id, current_state,
                consent_version, confirmed_at, unsubscribed_at,
                provider_blocked_at, state_version,
                created_at, updated_at
         FROM newsletter_contacts
         WHERE email_hash = $1`,
        [assertHash(emailHash, "emailHash")]
      );
      return result.rows[0] || null;
    },

    async upsertContact({
      emailHash,
      providerContactId = null,
      currentState,
      consentVersion = null,
      confirmedAt = null,
      unsubscribedAt = null,
      providerBlockedAt = null,
      clearProviderBlock = false,
      expectedStateVersion = null,
    }) {
      let expectedVersion = null;
      if (expectedStateVersion !== null && expectedStateVersion !== undefined) {
        expectedVersion = Number(expectedStateVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
          throw new TypeError("expectedStateVersion must be a non-negative integer");
        }
      }

      const result = await database.query(
        `INSERT INTO newsletter_contacts(
          email_hash, provider_contact_id, current_state, consent_version,
          confirmed_at, unsubscribed_at, provider_blocked_at, state_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
        ON CONFLICT (email_hash) DO UPDATE
        SET provider_contact_id = COALESCE(
              EXCLUDED.provider_contact_id,
              newsletter_contacts.provider_contact_id
            ),
            current_state = EXCLUDED.current_state,
            consent_version = COALESCE(
              EXCLUDED.consent_version,
              newsletter_contacts.consent_version
            ),
            confirmed_at = COALESCE(
              EXCLUDED.confirmed_at,
              newsletter_contacts.confirmed_at
            ),
            unsubscribed_at = COALESCE(
              EXCLUDED.unsubscribed_at,
              newsletter_contacts.unsubscribed_at
            ),
            provider_blocked_at = CASE
              WHEN $8::boolean THEN NULL
              WHEN EXCLUDED.provider_blocked_at IS NOT NULL THEN
                CASE
                  WHEN newsletter_contacts.provider_blocked_at IS NULL
                    THEN EXCLUDED.provider_blocked_at
                  ELSE GREATEST(
                    newsletter_contacts.provider_blocked_at,
                    EXCLUDED.provider_blocked_at
                  )
                END
              ELSE newsletter_contacts.provider_blocked_at
            END,
            state_version = newsletter_contacts.state_version + 1,
            updated_at = now()
        WHERE $9::bigint IS NULL
           OR newsletter_contacts.state_version = $9
        RETURNING email_hash, provider_contact_id, current_state,
                  consent_version, confirmed_at, unsubscribed_at,
                  provider_blocked_at, state_version`,
        [
          assertHash(emailHash, "emailHash"),
          providerContactId ? String(providerContactId).slice(0, 200) : null,
          String(currentState || "").trim(),
          consentVersion ? String(consentVersion).slice(0, 120) : null,
          confirmedAt,
          unsubscribedAt,
          providerBlockedAt,
          Boolean(clearProviderBlock),
          expectedVersion,
        ]
      );
      return result.rows[0] || null;
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
        ON CONFLICT (event_id) DO NOTHING
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

      if (result.rowCount === 1) {
        return { inserted: true, eventId: result.rows[0].event_id };
      }

      const existing = await database.query(
        `SELECT event_id, email_hash, event_type, consent_version, source,
                occurred_at, correlation_id, provider_ref, metadata
         FROM newsletter_consent_events
         WHERE event_id = $1`,
        [eventId]
      );

      return {
        inserted: false,
        eventId,
        event: existing.rows[0] || null,
      };
    },

    async getConsentEvent(eventId) {
      const result = await database.query(
        `SELECT event_id, email_hash, event_type, consent_version, source,
                occurred_at, correlation_id, provider_ref, metadata
         FROM newsletter_consent_events
         WHERE event_id = $1`,
        [eventId]
      );
      return result.rows[0] || null;
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
