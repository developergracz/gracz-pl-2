import { importNewsletterHistory, markNewsletterWriterStarted } from "./newsletter-cutover.mjs";
export function createNewsletterOptInStore(database) {
  let readinessProbe=null;
  return {
    checkOptInAvailable() {
      // Coalesce concurrent probes, never cache a success across later requests.
      // One catalog round trip replaces three queries; DDL changes are visible next probe.
      if (readinessProbe) return readinessProbe;
      readinessProbe = (async () => {
        const result=await database.queryBounded(`SELECT c.relname,
          (SELECT json_agg(json_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)))
           FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
           WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
          (SELECT json_agg(json_build_object('kind',k.contype,'definition',pg_get_constraintdef(k.oid),'valid',k.convalidated,'deferred',k.condeferrable))
           FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints
          FROM pg_class c WHERE c.oid IN (to_regclass('newsletter_opt_in_requests'),to_regclass('idempotency_keys'))`);
        const normalize=value=>value.replace(/::(?:character varying|text)(\[\])?/g,'').replace(/[()\s]/g,'');
        const requireTable=(name,columns,checks)=>{
          const row=result.rows.find(row=>row.relname===name);
          if(!row)throw new Error('Newsletter schema unavailable');
          for(const [name,type,required] of columns) {
            const column=row.columns.find(column=>column.name===name);
            if(!column||column.type!==type||(required&&!column.required))throw new Error('Newsletter critical column mismatch');
          }
          const definitions=(row.constraints||[]).filter(c=>c.valid&&!c.deferred).map(c=>normalize(c.definition));
          if(!checks.every(check=>definitions.includes(normalize(check))))throw new Error('Newsletter critical constraint mismatch');
          return row;
        };
        const row=requireTable('newsletter_opt_in_requests',[
          ['email_hash','character(64)',true],['request_id','uuid',true],['state','character varying(16)',true],
          ['issued_at','timestamp with time zone',true],['expires_at','timestamp with time zone',true],['sent_at','timestamp with time zone',false]
        ],["PRIMARY KEY (email_hash)","UNIQUE (request_id)","CHECK (email_hash ~ '^[0-9a-f]{64}$')",
          "CHECK (state = ANY (ARRAY['pre_send','inflight','unknown','sent','legacy_pending']))",
          "CHECK (expires_at > issued_at)","CHECK ((state = 'sent') = (sent_at IS NOT NULL))"]);
        if(!row.columns.find(c=>c.name==='state').default?.startsWith("'pre_send'::"))throw new Error('Newsletter schema does not support pre_send');
        requireTable('idempotency_keys',[
          ['scope','character varying(80)',true],['key_hash','character(64)',true],['fingerprint','character(64)',true],
          ['state','character varying(16)',true],['response_body','jsonb',false],['response_status','smallint',false],
          ['created_at','timestamp with time zone',true],['updated_at','timestamp with time zone',true],['expires_at','timestamp with time zone',true]
        ],['PRIMARY KEY (scope,key_hash)',"CHECK (key_hash ~ '^[0-9a-f]{64}$')","CHECK (fingerprint ~ '^[0-9a-f]{64}$')",
          "CHECK (state = ANY (ARRAY['inflight','done']))",
          "CHECK ((state = 'inflight' AND response_status IS NULL) OR (state = 'done' AND response_status IS NOT NULL))"]);
        return true;
      })().finally(()=>{readinessProbe=null;});
      return readinessProbe;
    },
    importHistoricalOptIns(options) { return importNewsletterHistory(database,options); },
    async claimOptInRequest({ emailHash, requestId, issuedAt, expiresAt, supersededBefore }) {
      return database.transaction(async client => {
      await markNewsletterWriterStarted(client);
      const result = await client.query(
        `INSERT INTO newsletter_opt_in_requests(email_hash, request_id, issued_at, expires_at)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz)
         ON CONFLICT (email_hash) DO UPDATE
         SET request_id = EXCLUDED.request_id, state = 'pre_send',
             issued_at = EXCLUDED.issued_at, expires_at = EXCLUDED.expires_at, sent_at = NULL
         WHERE newsletter_opt_in_requests.request_id <> EXCLUDED.request_id
           AND newsletter_opt_in_requests.issued_at < EXCLUDED.issued_at
           AND ((newsletter_opt_in_requests.state IN ('sent', 'legacy_pending')
                 AND (newsletter_opt_in_requests.expires_at <= now()
                      OR newsletter_opt_in_requests.issued_at <= $5::timestamptz))
                OR (newsletter_opt_in_requests.state = 'pre_send'
                    AND newsletter_opt_in_requests.issued_at < now() - interval '60 seconds'))
         RETURNING state`,
        [emailHash, requestId, issuedAt, expiresAt, supersededBefore]
      );
      if (result.rowCount) return { claimed: true, state: 'pre_send' };
      const current = await client.query(
        `SELECT state, (state IN ('pre_send', 'inflight') AND issued_at > now() - interval '5 minutes') AS in_progress
         FROM newsletter_opt_in_requests WHERE email_hash = $1`, [emailHash]
      );
      return { claimed: false, state: current.rows[0]?.state || 'unknown', inProgress: current.rows[0]?.in_progress === true };
      });
    },
    async markOptInSending({ emailHash, requestId, admissionDispatch = null }) {
      const mark = async client => {
        if (admissionDispatch) {
          if (admissionDispatch.scope !== 'newsletter-public-optin' || admissionDispatch.emailHash !== emailHash) throw new Error('Invalid admission binding');
          const publicResult = await client.query(
            `UPDATE idempotency_keys SET response_body = '{"phase":"external_effect"}'::jsonb, updated_at = now()
             WHERE scope = 'newsletter-public-optin' AND key_hash = $1 AND fingerprint = $2 AND state = 'inflight'
               AND response_body->>'phase' IN ('pre_effect','external_effect') RETURNING state`,
            [emailHash, admissionDispatch.requestId]);
          if (publicResult.rowCount !== 1) throw fenced;
        }
        const result = await client.query(
          `UPDATE newsletter_opt_in_requests SET state = 'inflight'
           WHERE email_hash = $1 AND request_id = $2 AND state = 'pre_send' RETURNING request_id`, [emailHash, requestId]);
        if (result.rowCount !== 1) throw fenced;
        return true;
      };
      const fenced = new Error('Newsletter sending claim lost');
      try {
        // The provider call happens only AFTER this transaction commits. A failure
        // between markers rolls BOTH back; a lost commit ACK remains uncertain.
        return admissionDispatch ? await database.transaction(mark) : await mark(database);
      } catch (error) { if (error === fenced) return false; throw error; }
    },
    async releaseOptInBeforeSend({ emailHash, requestId }) {
      const result = await database.query(
        `DELETE FROM newsletter_opt_in_requests
         WHERE email_hash = $1 AND request_id = $2 AND state = 'pre_send' RETURNING request_id`, [emailHash, requestId]);
      return result.rowCount === 1;
    },
    async reconcileOptInFromConsent({ emailHash, requestId, eventId }) {
      const result = await database.query(
        `UPDATE newsletter_opt_in_requests r SET state = 'sent', sent_at = e.occurred_at
         FROM newsletter_consent_events e, newsletter_contacts c
         WHERE r.email_hash = $1 AND r.request_id = $2 AND r.state IN ('inflight', 'unknown')
           AND e.event_id = $3 AND e.email_hash = r.email_hash
           AND e.event_type IN ('opt_in_confirmed', 'resubscribe')
           AND e.metadata->'tokenIssuedAt' = to_jsonb((extract(epoch FROM r.issued_at) * 1000)::bigint)
           AND e.occurred_at >= r.issued_at
           AND c.email_hash = e.email_hash AND c.current_state = 'subscribed'
           AND c.provider_blocked_at IS NULL AND c.confirmed_at >= e.occurred_at
         RETURNING r.request_id`, [emailHash, requestId, eventId]);
      return result.rowCount === 1;
    },
    async markOptInUnknown({ emailHash, requestId }) {
      await database.query(
        `UPDATE newsletter_opt_in_requests SET state = 'unknown'
         WHERE email_hash = $1 AND request_id = $2 AND state = 'inflight'`,
        [emailHash, requestId]
      );
    },
    async markOptInSent({ emailHash, requestId }) {
      const result = await database.query(
        `UPDATE newsletter_opt_in_requests SET state = 'sent', sent_at = now()
         WHERE email_hash = $1 AND request_id = $2 AND state = 'inflight' RETURNING request_id`,
        [emailHash, requestId]
      );
      return result.rowCount === 1;
    },
  };
}
