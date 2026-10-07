import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

const TOKEN_VERSION = "n1";
const CONFIRM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UNSUBSCRIBE_TTL_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 12_000;
const PROVIDER_MAX_ATTEMPTS = 4;
const PROVIDER_RETRY_BASE_MS = 350;
const CONFIRMED_AT_KEY = "gracz_newsletter_confirmed_at";
const UNSUBSCRIBED_AT_KEY = "gracz_newsletter_unsubscribed_at";
const CONSENT_VERSION_KEY = "gracz_newsletter_consent_version";

export function createNewsletterManager({
  secret,
  resendApiKey,
  resendApiBase = "https://api.resend.com",
  emailEndpoint = "https://api.resend.com/emails",
  emailFrom,
  replyTo,
  baseUrl = "https://gracz.pl/newsletter/",
  segmentName = "gracz.pl Newsletter",
  topicName = "Newsletter gracz.pl",
  providerTimeoutMs = 10_000,
  consentStore = null,
  consentHashSecret = "",
}) {
  const normalizedSecret = String(secret || "").trim();
  const apiKey = String(resendApiKey || "").trim();
  const normalizedBase = String(resendApiBase || "").replace(/\/$/, "");
  const normalizedEmailEndpoint = String(emailEndpoint || "").trim();
  const normalizedBaseUrl = ensureHttpsPageUrl(baseUrl);
  const normalizedConsentHashSecret = String(consentHashSecret || "").trim();
  const consentStoreConfigured = Boolean(
    consentStore &&
      typeof consentStore.ensureContact === "function" &&
      typeof consentStore.getContact === "function" &&
      typeof consentStore.upsertContact === "function" &&
      typeof consentStore.appendConsentEvent === "function" &&
      typeof consentStore.getConsentEvent === "function"
  );
  const requestTimeoutMs =
    Number.isFinite(providerTimeoutMs) && providerTimeoutMs > 0
      ? Math.max(25, Math.min(Math.floor(providerTimeoutMs), 30_000))
      : 10_000;
  const enabled =
    normalizedSecret.length >= 32 &&
    normalizedConsentHashSecret.length >= 32 &&
    Boolean(apiKey && normalizedBaseUrl) &&
    consentStoreConfigured;
  const key = normalizedSecret.length >= 32
    ? createHash("sha256").update(normalizedSecret, "utf8").digest()
    : null;
  const consentHashKey = normalizedConsentHashSecret.length >= 32
    ? createHash("sha256")
        .update("newsletter-consent-subject:", "utf8")
        .update(normalizedConsentHashSecret, "utf8")
        .digest()
    : null;

  let resourcesPromise = null;

  if (normalizedSecret && normalizedSecret.length < 32) {
    throw new Error("NEWSLETTER_SECRET must contain at least 32 characters");
  }
  if (
    consentHashSecret &&
    normalizedConsentHashSecret.length < 32
  ) {
    throw new Error(
      "NEWSLETTER_CONSENT_HASH_SECRET must contain at least 32 characters"
    );
  }

  async function requestOptIn({ email, name = "", source = "newsletter_page" }) {
    requireEnabled();
    const cleanEmail = validateMailbox(email);
    const cleanName = cleanShort(name, 80);
    const currentConsent = await consentStore.getContact(
      consentSubjectHash(cleanEmail)
    );
    if (currentConsent?.provider_blocked_at) {
      const resources = await ensureResources();
      await recoverProviderOffObligation(cleanEmail, resources);
    }
    const issuedAt = Math.max(
      Date.now(),
      timestampMs(currentConsent?.confirmed_at) + 1,
      timestampMs(currentConsent?.unsubscribed_at) + 1
    );
    const tokenData = {
      v: 1,
      purpose: "confirm",
      jti: randomUUID(),
      iat: issuedAt,
      exp: issuedAt + CONFIRM_TTL_MS,
      email: cleanEmail,
      name: cleanName,
      source: cleanShort(source, 40) || "unknown",
      consentVersion: "newsletter-r1-2026-10-07",
    };
    const token = encrypt(tokenData);
    const confirmUrl = normalizedBaseUrl + "#confirm=" + token;

    await recordOptInRequested(tokenData);

    await sendEmail({
      to: cleanEmail,
      subject: "gracz.pl Newsletter — potwierdź zapis",
      text: buildConfirmText(confirmUrl),
      html: buildConfirmHtml(confirmUrl),
      idempotencyKey: "newsletter-confirm/" + hashShort(tokenData.jti),
      entityRef: "gracz-newsletter-confirm-" + hashShort(tokenData.jti),
    });

    return { state: "confirmation_sent" };
  }

  async function confirm(token) {
    requireEnabled();
    const data = decrypt(token, "confirm");
    const resources = await ensureResources();
    await recoverProviderOffObligation(data.email, resources);

    const emailHash = consentSubjectHash(data.email);
    const ledgerContact = await consentStore.getContact(emailHash);
    const existing = await getContact(data.email);
    const names = splitName(data.name);
    const providerConfirmedAt = contactPropertyNumber(existing, CONFIRMED_AT_KEY);
    const providerUnsubscribedAt = contactPropertyNumber(
      existing,
      UNSUBSCRIBED_AT_KEY
    );
    const ledgerConfirmedAt = timestampMs(ledgerContact?.confirmed_at);
    const ledgerUnsubscribedAt = timestampMs(ledgerContact?.unsubscribed_at);

    if (
      providerUnsubscribedAt >= data.iat ||
      (ledgerContact?.current_state === "unsubscribed" &&
        ledgerUnsubscribedAt >= data.iat)
    ) {
      staleConfirmation();
    }

    const providerState = existing
      ? await getContactProviderState(data.email, resources)
      : {
          inSegment: false,
          topicSubscription: "opt_out",
        };

    const providerActive =
      Boolean(existing) &&
      existing.unsubscribed !== true &&
      providerState.inSegment &&
      providerState.topicSubscription === "opt_in";

    // Cutover safety for R1-R3 subscribers that predate the durable consent
    // ledger. Their provider-side confirmed timestamp is the only durable
    // proof available until they complete a fresh R4 DOI flow.
    const legacyProviderConfirmed =
      providerConfirmedAt > 0 && ledgerConfirmedAt === 0;

    // Replaying an old DOI while the legacy provider subscription is still
    // active must be a no-op rather than creating a duplicate welcome or
    // manufacturing a new ledger confirmation from an old token.
    if (
      legacyProviderConfirmed &&
      providerActive &&
      data.iat <= providerConfirmedAt
    ) {
      return {
        state: "already_subscribed",
        recipient: maskEmail(data.email),
      };
    }

    // If that legacy subscriber later used Resend's hosted unsubscribe, the
    // provider becomes inactive even though no first-party ledger row exists.
    // An old DOI token must stay stale; only a freshly issued token whose iat
    // is newer than the provider confirmation may intentionally resubscribe.
    if (
      legacyProviderConfirmed &&
      !providerActive &&
      data.iat <= providerConfirmedAt
    ) {
      staleConfirmation();
    }

    // Hybrid rule: Resend owns the operational subscription state.
    // The first-party store is audit evidence, not a second delivery engine.
    if (providerActive && ledgerContact?.current_state === "subscribed") {
      // Repair only our provider-side audit timestamp after a partial previous
      // confirmation. Do not resend the welcome e-mail or duplicate consent.
      if (providerConfirmedAt < ledgerConfirmedAt) {
        await api("/contacts/" + encodeURIComponent(data.email), {
          method: "PATCH",
          body: {
            properties: {
              [CONFIRMED_AT_KEY]: ledgerConfirmedAt,
              [CONSENT_VERSION_KEY]:
                ledgerContact.consent_version || data.consentVersion,
            },
          },
          expected: [200],
        });

        // If an earlier confirmation committed durable consent and activated
        // the provider but the deterministic welcome delivery failed, the
        // missing provider timestamp keeps this replay on the repair path.
        // Resend idempotency makes this safe when the welcome already landed.
        await sendWelcomeEmail(data);

        return {
          state: providerConfirmedAt > 0 ? "resubscribed" : "subscribed",
          recipient: maskEmail(data.email),
        };
      }

      return {
        state: "already_subscribed",
        recipient: maskEmail(data.email),
      };
    }

    // If Resend says the contact is inactive while our audit trail contains a
    // previous confirmation, only a token issued after that confirmation may
    // reactivate marketing. This prevents replaying an old DOI link after a
    // provider-hosted unsubscribe.
    const lastFirstPartyStateAt = Math.max(
      ledgerConfirmedAt,
      ledgerUnsubscribedAt,
      providerConfirmedAt,
      providerUnsubscribedAt
    );
    if (
      !providerActive &&
      lastFirstPartyStateAt > 0 &&
      data.iat <= lastFirstPartyStateAt
    ) {
      staleConfirmation();
    }

    const wasPreviouslyConfirmed =
      ledgerConfirmedAt > 0 || providerConfirmedAt > 0;

    const consentVersionProperties = {
      [CONSENT_VERSION_KEY]: data.consentVersion,
    };
    let providerContactId = existing?.id || null;

    // Safety ordering: durable first-party consent evidence is committed
    // before any provider marketing activation. If this CAS loses to an
    // unsubscribe or persistence fails, Resend is never turned on.
    await recordConfirmedConsent(data, {
      wasPreviouslyConfirmed,
      providerContactId,
    });

    if (!existing) {
      const createdContact = await api("/contacts", {
        method: "POST",
        body: {
          email: data.email,
          first_name: names.firstName || undefined,
          last_name: names.lastName || undefined,
          unsubscribed: false,
          segments: [{ id: resources.segmentId }],
          topics: [{ id: resources.topicId, subscription: "opt_in" }],
          properties: consentVersionProperties,
        },
        expected: [201],
      });
      providerContactId = createdContact?.id || null;
    } else {
      await api("/contacts/" + encodeURIComponent(data.email), {
        method: "PATCH",
        body: {
          first_name: names.firstName || undefined,
          last_name: names.lastName || undefined,
          unsubscribed: false,
          properties: consentVersionProperties,
        },
        expected: [200],
      });

      if (!providerState.inSegment) {
        await api(
          "/contacts/" + encodeURIComponent(data.email) +
            "/segments/" + encodeURIComponent(resources.segmentId),
          { method: "POST", expected: [200, 201, 409] }
        );
      }

      if (providerState.topicSubscription !== "opt_in") {
        await api("/contacts/" + encodeURIComponent(data.email) + "/topics", {
          method: "PATCH",
          body: {
            topics: [{ id: resources.topicId, subscription: "opt_in" }],
          },
          expected: [200],
        });
      }
    }

    // A withdrawal may have committed while provider activation was in
    // flight. Re-read the durable consent state before any welcome is sent.
    // If marketing is no longer permitted, force the provider off using a
    // race-aware compensation routine that cannot clobber a newer valid DOI.
    const afterActivation = await consentStore.getContact(emailHash);
    if (afterActivation?.current_state !== "subscribed") {
      await forceProviderNewsletterOffSafely(data.email, resources);
      if (
        afterActivation?.current_state === "unsubscribed" &&
        timestampMs(afterActivation?.unsubscribed_at) >= data.iat
      ) {
        staleConfirmation();
      }
      consentConflict();
    }

    await sendWelcomeEmail(data);

    await api("/contacts/" + encodeURIComponent(data.email), {
      method: "PATCH",
      body: {
        properties: {
          [CONFIRMED_AT_KEY]: Date.now(),
          [CONSENT_VERSION_KEY]: data.consentVersion,
        },
      },
      expected: [200],
    });

    return {
      state: wasPreviouslyConfirmed ? "resubscribed" : "subscribed",
      recipient: maskEmail(data.email),
    };
  }

  async function unsubscribe(token) {
    requireEnabled();
    const data = decrypt(token, "unsubscribe");
    const resources = await ensureResources();
    await recoverProviderOffObligation(data.email, resources);
    const existing = await getContact(data.email);

    if (existing) {
      await api("/contacts/" + encodeURIComponent(data.email), {
        method: "PATCH",
        body: {
          properties: {
            [UNSUBSCRIBED_AT_KEY]: Date.now(),
          },
        },
        expected: [200],
      });

      await api("/contacts/" + encodeURIComponent(data.email) + "/topics", {
        method: "PATCH",
        body: {
          topics: [{ id: resources.topicId, subscription: "opt_out" }],
        },
        expected: [200],
      });

      await api(
        "/contacts/" + encodeURIComponent(data.email) +
          "/segments/" + encodeURIComponent(resources.segmentId),
        { method: "DELETE", expected: [200, 404] }
      );
    }

    await recordUnsubscribedConsent(data, {
      providerContactId: existing?.id || null,
    });

    return {
      state: "unsubscribed",
      recipient: maskEmail(data.email),
    };
  }

  function consentSubjectHash(email) {
    return createHmac("sha256", consentHashKey)
      .update(validateMailbox(email), "utf8")
      .digest("hex");
  }

  function deterministicConsentEventId(namespace, seed) {
    const bytes = createHash("sha256")
      .update("gracz-newsletter-consent:", "utf8")
      .update(String(namespace || ""), "utf8")
      .update(":", "utf8")
      .update(String(seed || ""), "utf8")
      .digest()
      .subarray(0, 16);

    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString("hex");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  async function recordOptInRequested(data) {
    const emailHash = consentSubjectHash(data.email);
    const eventId = deterministicConsentEventId("request", data.jti);

    await consentStore.ensureContact({
      emailHash,
      consentVersion: data.consentVersion,
    });

    const existing = await consentStore.getConsentEvent(eventId);
    if (existing) return existing;

    return consentStore.appendConsentEvent({
      eventId,
      emailHash,
      eventType: "opt_in_requested",
      consentVersion: data.consentVersion,
      source: data.source || "unknown",
      occurredAt: new Date(data.iat),
      correlationId: eventId,
      metadata: {
        tokenIssuedAt: data.iat,
      },
    });
  }

  async function recordConfirmedConsent(
    data,
    { wasPreviouslyConfirmed, providerContactId = null }
  ) {
    const emailHash = consentSubjectHash(data.email);
    const eventId = deterministicConsentEventId("confirm", data.jti);

    await consentStore.ensureContact({
      emailHash,
      consentVersion: data.consentVersion,
    });

    let current = await consentStore.getContact(emailHash);
    if (!current) consentConflict();

    if (
      current.current_state === "unsubscribed" &&
      timestampMs(current.unsubscribed_at) >= data.iat
    ) {
      staleConfirmation();
    }

    const existingEvent = await consentStore.getConsentEvent(eventId);
    const occurredAt = existingEvent?.occurred_at
      ? new Date(existingEvent.occurred_at)
      : new Date();
    const eventType =
      existingEvent?.event_type ||
      (wasPreviouslyConfirmed ? "resubscribe" : "opt_in_confirmed");

    if (!existingEvent) {
      await consentStore.appendConsentEvent({
        eventId,
        emailHash,
        eventType,
        consentVersion: data.consentVersion,
        source: data.source || "confirm_link",
        occurredAt,
        correlationId: eventId,
        providerRef: providerContactId,
        metadata: {
          tokenIssuedAt: data.iat,
        },
      });
    }

    const updated = await consentStore.upsertContact({
      emailHash,
      providerContactId,
      currentState: "subscribed",
      consentVersion: data.consentVersion,
      confirmedAt: occurredAt,
      expectedStateVersion: stateVersion(current),
    });

    if (updated) return updated;

    current = await consentStore.getContact(emailHash);
    if (
      current?.current_state === "unsubscribed" &&
      timestampMs(current?.unsubscribed_at) >= data.iat
    ) {
      staleConfirmation();
    }

    // Another fresh confirmation may have won the CAS race. Treat that as
    // the same successful logical outcome instead of compensating it away.
    if (
      current?.current_state === "subscribed" &&
      timestampMs(current?.confirmed_at) >= data.iat
    ) {
      return current;
    }

    consentConflict();
  }

  async function recordUnsubscribedConsent(
    data,
    { providerContactId = null } = {}
  ) {
    const emailHash = consentSubjectHash(data.email);
    const eventId = deterministicConsentEventId("unsubscribe", data.jti);

    await consentStore.ensureContact({
      emailHash,
    });

    const existingEvent = await consentStore.getConsentEvent(eventId);
    const occurredAt = existingEvent?.occurred_at
      ? new Date(existingEvent.occurred_at)
      : new Date();

    if (!existingEvent) {
      await consentStore.appendConsentEvent({
        eventId,
        emailHash,
        eventType: "unsubscribe",
        source: "newsletter_unsubscribe_link",
        occurredAt,
        correlationId: eventId,
        providerRef: providerContactId,
        metadata: {
          tokenIssuedAt: data.iat,
        },
      });
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await consentStore.getContact(emailHash);
      if (!current) consentConflict();

      if (
        current.current_state === "unsubscribed" &&
        timestampMs(current.unsubscribed_at) >= occurredAt.getTime()
      ) {
        return current;
      }

      if (
        current.current_state === "subscribed" &&
        timestampMs(current.confirmed_at) > occurredAt.getTime()
      ) {
        return current;
      }

      const updated = await consentStore.upsertContact({
        emailHash,
        providerContactId,
        currentState: "unsubscribed",
        unsubscribedAt: occurredAt,
        expectedStateVersion: stateVersion(current),
      });
      if (updated) return updated;
    }

    consentConflict();
  }

  async function sendWelcomeEmail(data) {
    const unsubscribeToken = deterministicUnsubscribeToken(data);
    const unsubscribeUrl = normalizedBaseUrl + "#unsubscribe=" + unsubscribeToken;

    return sendEmail({
      to: data.email,
      subject: "gracz.pl Newsletter — witamy!",
      text: buildWelcomeText(unsubscribeUrl),
      html: buildWelcomeHtml(unsubscribeUrl),
      idempotencyKey: "newsletter-welcome/" + hashShort(data.jti),
      entityRef: "gracz-newsletter-welcome-" + hashShort(data.jti),
    });
  }

  async function ensureProviderNewsletterOn(email, resources) {
    const encoded = encodeURIComponent(email);
    const current = await getContact(email);

    if (!current) {
      await api("/contacts", {
        method: "POST",
        body: {
          email,
          unsubscribed: false,
          segments: [{ id: resources.segmentId }],
          topics: [{ id: resources.topicId, subscription: "opt_in" }],
        },
        expected: [201],
      });
      return;
    }

    await api("/contacts/" + encoded, {
      method: "PATCH",
      body: { unsubscribed: false },
      expected: [200],
    });
    await api(
      "/contacts/" + encoded + "/segments/" + encodeURIComponent(resources.segmentId),
      { method: "POST", expected: [200, 201, 409] }
    );
    await api("/contacts/" + encoded + "/topics", {
      method: "PATCH",
      body: {
        topics: [{ id: resources.topicId, subscription: "opt_in" }],
      },
      expected: [200],
    });
  }

  async function forceProviderNewsletterOff(email, resources) {
    const encoded = encodeURIComponent(email);
    let firstError = null;

    try {
      await api("/contacts/" + encoded + "/topics", {
        method: "PATCH",
        body: {
          topics: [{ id: resources.topicId, subscription: "opt_out" }],
        },
        expected: [200, 404],
      });
    } catch (error) {
      firstError = error;
    }

    try {
      await api(
        "/contacts/" + encoded +
          "/segments/" + encodeURIComponent(resources.segmentId),
        { method: "DELETE", expected: [200, 404] }
      );
    } catch (error) {
      if (!firstError) firstError = error;
    }

    if (firstError) throw firstError;
  }

  async function markProviderOffRequired(email) {
    const emailHash = consentSubjectHash(email);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await consentStore.getContact(emailHash);
      if (!current || current.current_state === "subscribed") return current;

      const updated = await consentStore.upsertContact({
        emailHash,
        providerContactId: current.provider_contact_id || null,
        currentState: current.current_state,
        providerBlockedAt: new Date(),
        expectedStateVersion: stateVersion(current),
      });
      if (updated) return updated;
    }

    consentConflict();
  }

  async function clearProviderOffRequired(email) {
    const emailHash = consentSubjectHash(email);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await consentStore.getContact(emailHash);
      if (!current || !current.provider_blocked_at) return current;

      const updated = await consentStore.upsertContact({
        emailHash,
        providerContactId: current.provider_contact_id || null,
        currentState: current.current_state,
        clearProviderBlock: true,
        expectedStateVersion: stateVersion(current),
      });
      if (updated) return updated;
    }

    consentConflict();
  }

  async function forceProviderNewsletterOffSafely(email, resources) {
    const emailHash = consentSubjectHash(email);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const before = await consentStore.getContact(emailHash);

      // A newer successful DOI has already won. Never let an older
      // compensation disable that subscription.
      if (before?.current_state === "subscribed") {
        await ensureProviderNewsletterOn(email, resources);
        await clearProviderOffRequired(email);
        return { state: "kept_on" };
      }

      try {
        await forceProviderNewsletterOff(email, resources);
      } catch (error) {
        // Persist a recoverable obligation instead of silently dropping a
        // failed provider-off operation.
        await markProviderOffRequired(email);
        throw error;
      }

      const after = await consentStore.getContact(emailHash);
      if (after?.current_state === "subscribed") {
        // A newer confirmation committed while the provider-off writes were
        // in flight. Restore the provider to the newer durable state.
        await ensureProviderNewsletterOn(email, resources);
        await clearProviderOffRequired(email);
        return { state: "restored_newer_subscription" };
      }

      if (
        !after ||
        !before ||
        stateVersion(after) === stateVersion(before)
      ) {
        await clearProviderOffRequired(email);
        return { state: "off" };
      }

      // The durable state changed while we were compensating. Loop and settle
      // against the newest state before returning.
    }

    consentConflict();
  }

  async function recoverProviderOffObligation(email, resources) {
    const current = await consentStore.getContact(consentSubjectHash(email));
    if (!current?.provider_blocked_at) return;

    if (current.current_state === "subscribed") {
      await ensureProviderNewsletterOn(email, resources);
      await clearProviderOffRequired(email);
      return;
    }

    await forceProviderNewsletterOffSafely(email, resources);
  }

  function stateVersion(contact) {
    const version = Number(contact?.state_version);
    if (!Number.isInteger(version) || version < 0) {
      consentConflict();
    }
    return version;
  }

  function consentConflict() {
    const error = new Error(
      "Stan zgody newslettera zmienił się podczas operacji. Spróbuj ponownie."
    );
    error.code = "NEWSLETTER_CONSENT_CONFLICT";
    error.status = 409;
    throw error;
  }

  async function ensureResources() {
    if (!resourcesPromise) {
      resourcesPromise = (async () => {
        const [segmentId, topicId] = await Promise.all([
          ensureNamedResource({
            listPath: "/segments?limit=100",
            createPath: "/segments",
            name: segmentName,
            createBody: { name: segmentName },
          }),
          ensureNamedResource({
            listPath: "/topics?limit=100",
            createPath: "/topics",
            name: topicName,
            createBody: {
              name: topicName,
              default_subscription: "opt_out",
              description: "Dobrowolny newsletter gracz.pl: nowe gry, poradniki i rozwój serwisu.",
              visibility: "public",
            },
          }),
        ]);

        await ensureContactProperties([
          { key: CONFIRMED_AT_KEY, type: "number", fallbackValue: 0 },
          { key: UNSUBSCRIBED_AT_KEY, type: "number", fallbackValue: 0 },
          { key: CONSENT_VERSION_KEY, type: "string", fallbackValue: "none" },
        ]);

        return { segmentId, topicId };
      })().catch((error) => {
        resourcesPromise = null;
        throw error;
      });
    }
    return resourcesPromise;
  }

  async function ensureNamedResource({ listPath, createPath, name, createBody }) {
    const listed = await api(listPath, { method: "GET", expected: [200] });
    const found = Array.isArray(listed?.data)
      ? listed.data.find((item) => item?.name === name && item?.id)
      : null;
    if (found) return found.id;

    try {
      const created = await api(createPath, {
        method: "POST",
        body: createBody,
        expected: [201],
      });
      if (!created?.id) throw providerError("NEWSLETTER_RESOURCE_INVALID");
      return created.id;
    } catch (error) {
      if (error?.status !== 409) throw error;
      const retry = await api(listPath, { method: "GET", expected: [200] });
      const retryFound = Array.isArray(retry?.data)
        ? retry.data.find((item) => item?.name === name && item?.id)
        : null;
      if (!retryFound) throw error;
      return retryFound.id;
    }
  }

  async function ensureContactProperties(definitions) {
    const listed = await api("/contact-properties?limit=100", {
      method: "GET",
      expected: [200],
    });
    const existingKeys = new Set(
      Array.isArray(listed?.data)
        ? listed.data.filter((item) => item?.key).map((item) => item.key)
        : []
    );

    for (const definition of definitions) {
      if (existingKeys.has(definition.key)) continue;
      try {
        await api("/contact-properties", {
          method: "POST",
          body: {
            key: definition.key,
            type: definition.type,
            fallback_value: definition.fallbackValue,
          },
          expected: [201],
        });
        existingKeys.add(definition.key);
      } catch (error) {
        if (error?.status !== 409) throw error;
        existingKeys.add(definition.key);
      }
    }
  }

  async function getContact(email) {
    try {
      return await api("/contacts/" + encodeURIComponent(email), {
        method: "GET",
        expected: [200],
      });
    } catch (error) {
      if (error?.status === 404) return null;
      throw error;
    }
  }

  async function getContactProviderState(email, resources) {
    const encoded = encodeURIComponent(email);
    const [segmentsResult, topicsResult] = await Promise.all([
      api("/contacts/" + encoded + "/segments?limit=100", {
        method: "GET",
        expected: [200],
      }),
      api("/contacts/" + encoded + "/topics?limit=100", {
        method: "GET",
        expected: [200],
      }),
    ]);

    const inSegment =
      Array.isArray(segmentsResult?.data) &&
      segmentsResult.data.some((item) => item?.id === resources.segmentId);

    const topic =
      Array.isArray(topicsResult?.data)
        ? topicsResult.data.find((item) => item?.id === resources.topicId)
        : null;

    return {
      inSegment,
      topicSubscription:
        topic?.subscription === "opt_in" ? "opt_in" : "opt_out",
    };
  }

  async function sendEmail({ to, subject, text, html, idempotencyKey, entityRef }) {
    const payload = JSON.stringify({
      from: emailFrom,
      to: [to],
      reply_to: replyTo,
      subject,
      text,
      html,
      headers: {
        "X-Entity-Ref-ID": entityRef || idempotencyKey,
      },
    });
    const operation = "POST /emails";

    for (let attempt = 1; attempt <= PROVIDER_MAX_ATTEMPTS; attempt += 1) {
      let response;
      try {
        response = await fetch(normalizedEmailEndpoint, {
          method: "POST",
          headers: {
            authorization: "Bearer " + apiKey,
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "User-Agent": "gracz.pl-newsletter/1.0",
          },
          body: payload,
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch (cause) {
        if (attempt < PROVIDER_MAX_ATTEMPTS) {
          await sleep(networkRetryDelayMs(attempt));
          continue;
        }
        throw providerError("NEWSLETTER_MAIL_FAILED", 502, {
          operation,
          providerName: cleanProviderErrorName(cause?.name),
        });
      }

      const raw = await response.text().catch(() => "");
      if (response.ok) {
        try {
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      }

      if (isRetryableProviderStatus(response.status) && attempt < PROVIDER_MAX_ATTEMPTS) {
        await sleep(providerRetryDelayMs(response, attempt));
        continue;
      }

      throw providerError("NEWSLETTER_MAIL_FAILED", response.status, {
        operation,
        providerName: providerErrorName(raw),
        providerRequestId: providerRequestId(response),
      });
    }

    throw providerError("NEWSLETTER_MAIL_FAILED", 502, { operation });
  }

  async function api(path, { method, body, expected }) {
    const payload =
      body === undefined ? undefined : JSON.stringify(removeUndefined(body));
    const operation = providerOperation(method, path);

    for (let attempt = 1; attempt <= PROVIDER_MAX_ATTEMPTS; attempt += 1) {
      let response;
      try {
        response = await fetch(normalizedBase + path, {
          method,
          headers: {
            authorization: "Bearer " + apiKey,
            "content-type": "application/json",
            "User-Agent": "gracz.pl-newsletter/1.0",
          },
          body: payload,
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch (cause) {
        if (attempt < PROVIDER_MAX_ATTEMPTS) {
          await sleep(networkRetryDelayMs(attempt));
          continue;
        }
        throw providerError("NEWSLETTER_PROVIDER_FAILED", 502, {
          operation,
          providerName: cleanProviderErrorName(cause?.name),
        });
      }

      const raw = await response.text().catch(() => "");
      if (expected.includes(response.status)) {
        try {
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      }

      if (isRetryableProviderStatus(response.status) && attempt < PROVIDER_MAX_ATTEMPTS) {
        await sleep(providerRetryDelayMs(response, attempt));
        continue;
      }

      throw providerError("NEWSLETTER_PROVIDER_FAILED", response.status, {
        operation,
        providerName: providerErrorName(raw),
        providerRequestId: providerRequestId(response),
      });
    }

    throw providerError("NEWSLETTER_PROVIDER_FAILED", 502, { operation });
  }

  function encrypt(payload) {
    return encryptWithIv(payload, randomBytes(12));
  }

  function deterministicUnsubscribeToken(confirmData) {
    const payload = {
      v: 1,
      purpose: "unsubscribe",
      jti: "u-" + confirmData.jti,
      iat: confirmData.iat,
      exp: confirmData.iat + UNSUBSCRIBE_TTL_MS,
      email: confirmData.email,
    };
    const iv = createHmac("sha256", key)
      .update("newsletter-unsubscribe:" + confirmData.jti, "utf8")
      .digest()
      .subarray(0, 12);
    return encryptWithIv(payload, iv);
  }

  function encryptWithIv(payload, iv) {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      TOKEN_VERSION,
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  function decrypt(token, purpose) {
    requireEnabled();
    const value = String(token || "").trim();
    if (!value || value.length > MAX_TOKEN_LENGTH) invalidToken();

    const parts = value.split(".");
    if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) invalidToken();

    try {
      const iv = decodeCanonicalBase64Url(parts[1]);
      const tag = decodeCanonicalBase64Url(parts[2]);
      const ciphertext = decodeCanonicalBase64Url(parts[3]);
      if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 16) {
        invalidToken();
      }
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const parsed = JSON.parse(
        Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
      );
      validateTokenPayload(parsed, purpose);
      return parsed;
    } catch (error) {
      if (error?.code === "NEWSLETTER_TOKEN_EXPIRED") throw error;
      invalidToken();
    }
  }

  function requireEnabled() {
    if (!enabled) {
      const error = new Error("Newsletter jest chwilowo niedostępny.");
      error.code = "NEWSLETTER_NOT_CONFIGURED";
      error.status = 503;
      throw error;
    }
  }

  return {
    enabled,
    consentLedgerConfigured: consentStoreConfigured,
    requestOptIn,
    confirm,
    unsubscribe,
    baseUrl: normalizedBaseUrl,
  };
}

function decodeCanonicalBase64Url(value) {
  if (
    typeof value !== "string" ||
    !value ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    invalidToken();
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    invalidToken();
  }
  return decoded;
}

function validateTokenPayload(data, purpose) {
  if (!data || typeof data !== "object" || Array.isArray(data)) invalidToken();
  if (data.v !== 1 || data.purpose !== purpose) invalidToken();
  if (typeof data.jti !== "string" || data.jti.length < 8 || data.jti.length > 80) invalidToken();
  validateMailbox(data.email);
  if (!Number.isFinite(data.iat) || !Number.isFinite(data.exp)) invalidToken();
  if (data.iat > Date.now() + 60_000) invalidToken();
  if (purpose === "confirm" && data.exp - data.iat > CONFIRM_TTL_MS + 60_000) invalidToken();
  if (purpose === "unsubscribe" && data.exp - data.iat > UNSUBSCRIBE_TTL_MS + 60_000) invalidToken();
  if (data.exp <= Date.now()) {
    const error = new Error("Link newslettera wygasł.");
    error.code = "NEWSLETTER_TOKEN_EXPIRED";
    error.status = 410;
    throw error;
  }
}

function validateMailbox(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 254 || email.includes("\r") || email.includes("\n")) {
    invalidEmail();
  }
  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@")) invalidEmail();
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)
  ) {
    invalidEmail();
  }
  return local + "@" + domain.toLowerCase();
}

function contactPropertyValue(contact, key) {
  const raw = contact?.properties?.[key];
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    Object.prototype.hasOwnProperty.call(raw, "value")
  ) {
    return raw.value;
  }
  return raw;
}

function contactPropertyNumber(contact, key) {
  const value = Number(contactPropertyValue(contact, key) ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function timestampMs(value) {
  if (!value) return 0;
  const time = value instanceof Date
    ? value.getTime()
    : new Date(value).getTime();
  return Number.isFinite(time) && time > 0 ? time : 0;
}

function staleConfirmation() {
  const error = new Error(
    "Ten link nie może ponownie aktywować newslettera. Poproś o nowy link zapisu."
  );
  error.code = "NEWSLETTER_CONFIRMATION_STALE";
  error.status = 409;
  throw error;
}

function invalidEmail() {
  const error = new Error("Podaj prawidłowy adres e-mail.");
  error.code = "INVALID_EMAIL";
  error.status = 400;
  throw error;
}

function invalidToken() {
  const error = new Error("Link newslettera jest nieprawidłowy.");
  error.code = "INVALID_NEWSLETTER_TOKEN";
  error.status = 400;
  throw error;
}

function providerError(code, status = 502, details = {}) {
  const error = new Error("Usługa newslettera jest chwilowo niedostępna.");
  error.code = code;
  error.status = Number.isInteger(status) ? status : 502;
  if (error.status < 400) error.status = 502;
  error.providerOperation = cleanProviderOperation(details.operation);
  error.providerStatus = Number.isInteger(status) ? status : null;
  error.providerName = cleanProviderErrorName(details.providerName);
  error.providerRequestId = cleanProviderRequestId(details.providerRequestId);
  return error;
}

function providerOperation(method, path) {
  const verb = String(method || "").toUpperCase();
  const value = String(path || "");
  if (/^\/contacts\/[^/]+\/segments\/[^/?]+/.test(value)) {
    return verb + " /contacts/{contact}/segments/{segment}";
  }
  if (/^\/contacts\/[^/]+\/segments(?:\?|$)/.test(value)) {
    return verb + " /contacts/{contact}/segments";
  }
  if (/^\/contacts\/[^/]+\/topics(?:\?|$)/.test(value)) {
    return verb + " /contacts/{contact}/topics";
  }
  if (/^\/contacts\/[^/?]+/.test(value)) {
    return verb + " /contacts/{contact}";
  }
  if (/^\/contacts(?:\?|$)/.test(value)) return verb + " /contacts";
  if (/^\/segments(?:\?|$)/.test(value)) return verb + " /segments";
  if (/^\/topics(?:\?|$)/.test(value)) return verb + " /topics";
  if (/^\/contact-properties(?:\?|$)/.test(value)) {
    return verb + " /contact-properties";
  }
  return verb + " /provider";
}

function providerErrorName(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return cleanProviderErrorName(parsed?.name || parsed?.code);
  } catch {
    return "";
  }
}

function providerRequestId(response) {
  return cleanProviderRequestId(
    response?.headers?.get?.("x-request-id") ||
      response?.headers?.get?.("x-resend-request-id") ||
      response?.headers?.get?.("request-id")
  );
}

function cleanProviderOperation(value) {
  return String(value || "").replace(/[\r\n]/g, "").slice(0, 120);
}

function cleanProviderErrorName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 80);
}

function cleanProviderRequestId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 120);
}

function cleanShort(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function splitName(value) {
  const parts = cleanShort(value, 80).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ").slice(0, 80),
  };
}

function ensureHttpsPageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function hashShort(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 40);
}

function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  return local && domain ? local.slice(0, 1) + "***@" + domain : "ukryty adres";
}

function isRetryableProviderStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

function providerRetryDelayMs(response, attempt) {
  const retryAfter = String(response?.headers?.get?.("retry-after") || "").trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.max(Math.ceil(seconds * 1000), 100), 5_000);
    }
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 100), 5_000);
    }
  }
  return Math.min(PROVIDER_RETRY_BASE_MS * 2 ** (attempt - 1), 3_000);
}

function networkRetryDelayMs(attempt) {
  return Math.min(PROVIDER_RETRY_BASE_MS * 2 ** (attempt - 1), 3_000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeUndefined(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [
        key,
        item && typeof item === "object" && !Array.isArray(item)
          ? removeUndefined(item)
          : item,
      ])
  );
}

function buildConfirmText(url) {
  return [
    "gracz.pl Newsletter — potwierdzenie zapisu",
    "",
    "Potwierdź swój zapis do Newslettera gracz.pl.",
    "Subskrypcja zostanie aktywowana dopiero po świadomym potwierdzeniu na stronie gracz.pl.",
    "",
    "Potwierdź zapis:",
    url,
    "",
    "Co otrzymasz:",
    "• informacje o nowych grach",
    "• poradniki i najważniejsze materiały",
    "• aktualizacje rozwoju gracz.pl",
    "",
    "Link jest ważny przez 30 dni.",
    "Jeśli nie inicjowałeś zapisu, zignoruj tę wiadomość.",
  ].join("\n");
}

function buildConfirmHtml(url) {
  return premiumEmailShell({
    preheader:
      "Potwierdź zapis do Newslettera gracz.pl — bezpieczny double opt-in.",
    eyebrow: "NEWSLETTER · FULL MAX PREMIUM · DOUBLE OPT-IN",
    statusLabel: "WYMAGA POTWIERDZENIA",
    title: "Potwierdź swój zapis",
    lead:
      "Jeszcze jeden krok. Potwierdź adres e-mail, aby aktywować Newsletter gracz.pl.",
    buttonText: "Potwierdź zapis",
    buttonUrl: url,
    featureTitle: "Po potwierdzeniu otrzymasz",
    features: [
      ["01", "Nowe gry", "Premiery, nowe tryby i rozwój modułów gracz.pl."],
      ["02", "Poradniki", "Najciekawsze materiały, zasady i treści Academy."],
      ["03", "Rozwój serwisu", "Najważniejsze aktualizacje i nowe funkcje."],
    ],
    noticeTitle: "Bezpieczny double opt-in",
    noticeBody:
      "Samo otrzymanie tej wiadomości nie aktywuje subskrypcji. Zapis nastąpi dopiero po kliknięciu przycisku i potwierdzeniu na stronie gracz.pl.",
    footerHtml:
      'Link jest ważny przez 30 dni. Jeśli nie inicjowałeś zapisu, zignoruj tę wiadomość.<br><a href="https://gracz.pl/polityka-prywatnosci/#newsletter" style="color:#89ddd6;text-decoration:none">Polityka prywatności</a> · ' + brandHomeLinkHtml(),
  });
}

function buildWelcomeText(unsubscribeUrl) {
  return [
    "Witaj w Newsletterze gracz.pl",
    "",
    "Twój zapis został potwierdzony metodą double opt-in.",
    "Newsletter jest aktywny.",
    "",
    "Będziemy wysyłać informacje o nowych grach, poradnikach i najważniejszych aktualizacjach gracz.pl.",
    "",
    "Wypisz się:",
    unsubscribeUrl,
  ].join("\n");
}

function buildWelcomeHtml(unsubscribeUrl) {
  return premiumEmailShell({
    preheader:
      "Newsletter gracz.pl jest aktywny — witamy w wersji FULL MAX PREMIUM.",
    eyebrow: "NEWSLETTER · FULL MAX PREMIUM",
    statusLabel: "SUBSKRYPCJA AKTYWNA",
    title: "Witaj w Newsletterze gracz.pl",
    lead:
      "Zapis został potwierdzony. Od teraz najważniejsze informacje o nowych grach, poradnikach i rozwoju serwisu mogą trafiać bezpośrednio do Ciebie.",
    buttonText: "Przejdź do gracz.pl",
    buttonUrl: "https://gracz.pl/",
    featureTitle: "Twój Newsletter gracz.pl",
    features: [
      ["01", "Nowe gry", "Premiery, testy i rozwój nowych modułów."],
      ["02", "Poradniki", "Materiały pomagające lepiej poznać gry i zasady."],
      ["03", "Aktualizacje", "Najważniejsze zmiany i nowe funkcje serwisu."],
    ],
    noticeTitle: "Pełna kontrola po Twojej stronie",
    noticeBody:
      "Newsletter jest dobrowolny. Możesz wycofać zgodę w dowolnym momencie, bez wpływu na pozostałe funkcje gracz.pl.",
    footerHtml:
      'Nie chcesz już otrzymywać Newslettera? <a href="' +
      escapeHtml(unsubscribeUrl) +
      '" style="color:#89ddd6;text-decoration:none;font-weight:700">Wypisz się</a>.<br><a href="https://gracz.pl/polityka-prywatnosci/#newsletter" style="color:#89ddd6;text-decoration:none">Polityka prywatności</a> · ' + brandHomeLinkHtml(),
  });
}

function premiumEmailShell({
  preheader,
  eyebrow,
  statusLabel,
  title,
  lead,
  buttonText,
  buttonUrl,
  featureTitle,
  features,
  noticeTitle,
  noticeBody,
  footerHtml,
}) {
  const featureCells = features
    .map(
      ([number, featureName, featureBody]) =>
        '<td width="33.33%" valign="top" style="padding:7px">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#0d2e28;border:1px solid #1d544b;border-radius:14px">' +
        '<tr><td style="padding:18px 16px">' +
        '<div style="font-size:11px;line-height:1;color:#67d8cf;font-weight:800;letter-spacing:.08em">' +
        escapeHtml(number) +
        '</div>' +
        '<div style="padding-top:8px;font-size:15px;line-height:1.25;color:#ffffff;font-weight:800">' +
        escapeHtml(featureName) +
        '</div>' +
        '<div style="padding-top:7px;font-size:12px;line-height:1.55;color:#9db8b1">' +
        brandifyEmailText(featureBody) +
        '</div></td></tr></table></td>'
    )
    .join("");

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#eaf1f0;font-family:Arial,Helvetica,sans-serif;color:#17342f">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#eaf1f0;border-collapse:collapse">
<tr><td align="center" style="padding:34px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:700px;border-collapse:separate;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 55px rgba(7,26,23,.14)">

<tr><td style="background:#061a16;padding:30px 34px 27px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr>
<td valign="middle">
<div style="font-size:34px;line-height:1;font-weight:900;letter-spacing:-1.6px;color:#ffffff">gracz<span style="color:#ef4555">.pl</span></div>
<div style="padding-top:8px;font-size:10px;line-height:1.4;color:#83a79f;font-weight:700;letter-spacing:.16em">${escapeHtml(eyebrow)}</div>
</td>
<td align="right" valign="middle">
<span style="display:inline-block;padding:8px 11px;border:1px solid #2d6e63;border-radius:999px;background:#0c342d;color:#87e9df;font-size:9px;line-height:1;font-weight:800;letter-spacing:.08em">${escapeHtml(statusLabel)}</span>
</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:38px 38px 22px">
<div style="font-size:12px;line-height:1.3;color:#159f94;font-weight:800;letter-spacing:.08em">${brandLogoHtml({ compact: true })}<span style="padding-left:6px">NEWSLETTER</span></div>
<h1 style="margin:9px 0 13px;font-size:30px;line-height:1.15;color:#0b3b34;font-weight:900;letter-spacing:-.7px">${brandifyEmailText(title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.75;color:#4e6862">${brandifyEmailText(lead)}</p>
</td></tr>

<tr><td align="center" style="padding:7px 38px 31px">
<table role="presentation" cellspacing="0" cellpadding="0">
<tr><td align="center" bgcolor="#56c8c1" style="border-radius:999px">
<a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:15px 30px;color:#052d27;text-decoration:none;font-size:14px;line-height:1;font-weight:900">${escapeHtml(buttonText)}</a>
</td></tr>
</table>
<div style="padding-top:11px;font-size:10px;line-height:1.5;color:#879b96">Przycisk prowadzi wyłącznie do bezpiecznej strony ${brandLogoHtml({ compact: true })}.</div>
</td></tr>

<tr><td style="padding:0 31px 7px">
<div style="padding:0 7px 9px;font-size:11px;color:#54736c;font-weight:800;letter-spacing:.06em;text-transform:uppercase">${brandifyEmailText(featureTitle)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#071f1a;border-radius:18px;padding:7px">
<tr>${featureCells}</tr>
</table>
</td></tr>

<tr><td style="padding:22px 38px 34px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e9f8f6;border:1px solid #c9ece8;border-radius:15px">
<tr><td style="padding:18px 19px">
<div style="font-size:12px;line-height:1.3;color:#0b4d45;font-weight:900">${escapeHtml(noticeTitle)}</div>
<div style="padding-top:6px;font-size:12px;line-height:1.65;color:#56706a">${brandifyEmailText(noticeBody)}</div>
</td></tr>
</table>
</td></tr>

<tr><td style="background:#061a16;padding:23px 34px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr>
<td style="font-size:10px;line-height:1.7;color:#8aa49e">${footerHtml}</td>
<td align="right" valign="bottom" style="font-size:10px;line-height:1.5;color:#55726b;white-space:nowrap">© 2026 ${brandLogoHtml({ compact: true, onDark: true })}</td>
</tr>
</table>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function brandLogoHtml({ compact = false, onDark = false } = {}) {
  const fontSize = compact ? "11px" : "13px";
  const padding = onDark ? "0" : compact ? "2px 5px" : "3px 7px";
  const background = onDark ? "transparent" : "#071f1a";
  const radius = onDark ? "0" : "5px";
  return (
    '<span style="display:inline-block;vertical-align:baseline;background:' +
    background +
    ';border-radius:' +
    radius +
    ';padding:' +
    padding +
    ';font-size:' +
    fontSize +
    ';line-height:1;font-weight:900;letter-spacing:-.25px;white-space:nowrap">' +
    '<span style="color:#ffffff">gracz</span><span style="color:#ef4555">.pl</span></span>'
  );
}

function brandifyEmailText(value) {
  return escapeHtml(value).replace(/gracz\.pl/gi, brandLogoHtml({ compact: true }));
}

function brandHomeLinkHtml() {
  return (
    '<a href="https://gracz.pl/" style="text-decoration:none">' +
    brandLogoHtml({ compact: true, onDark: true }) +
    "</a>"
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
