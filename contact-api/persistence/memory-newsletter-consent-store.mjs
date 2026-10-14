function clone(value) {
  return value == null ? value : structuredClone(value);
}

export function createMemoryNewsletterConsentStore({ clock = () => new Date() } = {}) {
  const contacts = new Map();
  const events = new Map();
  const requests = new Map();

  async function ensureContact({ emailHash, consentVersion = null }) {
    const existing = contacts.get(emailHash);
    if (existing) {
      if (consentVersion) existing.consent_version = consentVersion;
      existing.updated_at = new Date();
      return clone(existing);
    }

    const record = {
      email_hash: emailHash,
      provider_contact_id: null,
      current_state: "pending",
      consent_version: consentVersion,
      confirmed_at: null,
      unsubscribed_at: null,
      provider_blocked_at: null,
      state_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    contacts.set(emailHash, record);
    return clone(record);
  }

  async function getContact(emailHash) {
    return clone(contacts.get(emailHash) || null);
  }

  async function upsertContact({
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
    const existing = contacts.get(emailHash) || {
      email_hash: emailHash,
      provider_contact_id: null,
      current_state: "pending",
      consent_version: null,
      confirmed_at: null,
      unsubscribed_at: null,
      provider_blocked_at: null,
      state_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (
      expectedStateVersion !== null &&
      expectedStateVersion !== undefined &&
      existing.state_version !== Number(expectedStateVersion)
    ) {
      return null;
    }

    const existed = contacts.has(emailHash);
    if (providerContactId) existing.provider_contact_id = providerContactId;
    existing.current_state = currentState;
    if (consentVersion) existing.consent_version = consentVersion;
    if (confirmedAt) existing.confirmed_at = new Date(confirmedAt);
    if (unsubscribedAt) existing.unsubscribed_at = new Date(unsubscribedAt);
    if (clearProviderBlock) {
      existing.provider_blocked_at = null;
    } else if (providerBlockedAt) {
      const next = new Date(providerBlockedAt);
      const current = existing.provider_blocked_at
        ? new Date(existing.provider_blocked_at)
        : null;
      if (!current || next.getTime() > current.getTime()) {
        existing.provider_blocked_at = next;
      }
    }
    if (existed) existing.state_version += 1;
    existing.updated_at = new Date();

    contacts.set(emailHash, existing);
    return clone(existing);
  }

  async function appendConsentEvent(event) {
    if (events.has(event.eventId)) {
      return {
        inserted: false,
        eventId: event.eventId,
        event: clone(events.get(event.eventId)),
      };
    }

    const record = {
      event_id: event.eventId,
      email_hash: event.emailHash,
      event_type: event.eventType,
      consent_version: event.consentVersion || null,
      source: event.source,
      occurred_at: new Date(event.occurredAt || Date.now()),
      correlation_id: event.correlationId || null,
      provider_ref: event.providerRef || null,
      metadata: clone(event.metadata || {}),
    };
    events.set(event.eventId, record);

    return {
      inserted: true,
      eventId: event.eventId,
      event: clone(record),
    };
  }

  async function getConsentEvent(eventId) {
    return clone(events.get(eventId) || null);
  }

  async function listConsentEvents(emailHash) {
    return [...events.values()]
      .filter((event) => event.email_hash === emailHash)
      .sort((a, b) => {
        const delta =
          new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
        return delta || String(a.event_id).localeCompare(String(b.event_id));
      })
      .map(clone);
  }

  async function claimOptInRequest({ emailHash, requestId, issuedAt, expiresAt, supersededBefore }) {
    const previous = requests.get(emailHash);
    const now = clock();
    const replaceable = previous && previous.requestId !== requestId && previous.issuedAt < issuedAt && (
      (['sent', 'legacy_pending'].includes(previous.state) &&
       (previous.expiresAt <= now || previous.issuedAt <= supersededBefore)) ||
      (previous.state === 'pre_send' && previous.issuedAt.getTime() < now.getTime() - 60000));
    if (previous && !replaceable) {
      return { claimed: false, state: previous.state, inProgress: ['pre_send', 'inflight'].includes(previous.state) && previous.issuedAt.getTime() > now.getTime() - 5 * 60 * 1000 };
    }
    requests.set(emailHash, { requestId, issuedAt: new Date(issuedAt), expiresAt: new Date(expiresAt), state: 'pre_send', sentAt: null });
    return { claimed: true, state: 'pre_send' };
  }

  async function markOptInSending({ emailHash, requestId }) {
    const row = requests.get(emailHash);
    if (!row || row.requestId !== requestId || row.state !== 'pre_send') return false;
    row.state = 'inflight';
    return true;
  }

  async function releaseOptInBeforeSend({ emailHash, requestId }) {
    const row = requests.get(emailHash);
    if (!row || row.requestId !== requestId || row.state !== 'pre_send') return false;
    return requests.delete(emailHash);
  }

  async function reconcileOptInFromConsent({ emailHash, requestId, eventId }) {
    const row = requests.get(emailHash);
    const event = events.get(eventId), contact = contacts.get(emailHash);
    if (!row || row.requestId !== requestId || !['inflight', 'unknown'].includes(row.state) ||
        !event || event.email_hash !== emailHash || !['opt_in_confirmed', 'resubscribe'].includes(event.event_type) ||
        event.metadata.tokenIssuedAt !== row.issuedAt.getTime() || event.occurred_at < row.issuedAt ||
        contact?.current_state !== 'subscribed' || contact.provider_blocked_at ||
        !contact.confirmed_at || contact.confirmed_at < event.occurred_at) return false;
    row.state = 'sent'; row.sentAt = new Date(event.occurred_at);
    return true;
  }

  async function getOptInRequest(emailHash) { return clone(requests.get(emailHash) || null); }

  async function importHistoricalOptIns() {
    let count = 0;
    const ordered = [...events.values()].filter(event => event.event_type === 'opt_in_requested' &&
      event.occurred_at.getTime() + 30 * 86400000 > clock().getTime())
      .sort((a, b) => b.occurred_at - a.occurred_at || b.event_id.localeCompare(a.event_id));
    for (const event of ordered) {
      if (requests.has(event.email_hash) || [...requests.values()].some(row => row.requestId === event.event_id)) continue;
      requests.set(event.email_hash, { requestId: event.event_id, state: 'legacy_pending',
        issuedAt: new Date(event.occurred_at), expiresAt: new Date(event.occurred_at.getTime() + 30 * 86400000), sentAt: null });
      count++;
    }
    return count;
  }

  async function markOptInUnknown({ emailHash, requestId }) {
    const current = requests.get(emailHash);
    if (current?.requestId === requestId && current.state === "inflight") current.state = "unknown";
  }

  async function markOptInSent({ emailHash, requestId }) {
    const current = requests.get(emailHash);
    if (!current || current.requestId !== requestId || current.state !== "inflight") return false;
    current.state = "sent";
    current.sentAt = clock();
    return true;
  }

  return Object.freeze({
    checkOptInAvailable: async () => true,
    markOptInSending,
    releaseOptInBeforeSend,
    reconcileOptInFromConsent,
    importHistoricalOptIns,
    getOptInRequest,
    claimOptInRequest,
    markOptInSent,
    markOptInUnknown,
    ensureContact,
    getContact,
    upsertContact,
    appendConsentEvent,
    getConsentEvent,
    listConsentEvents,
  });
}
