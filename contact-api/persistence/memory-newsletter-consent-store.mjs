function clone(value) {
  return value == null ? value : structuredClone(value);
}

export function createMemoryNewsletterConsentStore() {
  const contacts = new Map();
  const events = new Map();

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
  }) {
    const existing = contacts.get(emailHash) || {
      email_hash: emailHash,
      provider_contact_id: null,
      current_state: "pending",
      consent_version: null,
      confirmed_at: null,
      unsubscribed_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (providerContactId) existing.provider_contact_id = providerContactId;
    existing.current_state = currentState;
    if (consentVersion) existing.consent_version = consentVersion;
    if (confirmedAt) existing.confirmed_at = new Date(confirmedAt);
    if (unsubscribedAt) existing.unsubscribed_at = new Date(unsubscribedAt);
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

  return Object.freeze({
    ensureContact,
    getContact,
    upsertContact,
    appendConsentEvent,
    getConsentEvent,
    listConsentEvents,
  });
}
