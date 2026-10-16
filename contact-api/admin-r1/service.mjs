import { randomBytes } from "node:crypto";
import { bounded, fault } from "./provider.mjs";
const states = [
  "all",
  "active",
  "unsubscribed",
  "suppressed",
  "outside_segment",
  "unknown",
];
const errors = new Set([
  "timeout",
  "rate_limited",
  "provider_unavailable",
  "invalid_provider_response",
  "invalid_request",
  "invalid_cursor",
  "pagination_limit",
  "busy",
]);
const token = () => randomBytes(24).toString("base64url");
// Per future OWNER session instance; never share this cache between principals.
export function createReadService({
  adapter,
  subjectHash,
  readConsent,
  audit,
  now = Date.now,
}) {
  if (typeof audit !== "function") throw fault("configuration");
  const cursors = new Map(),
    handles = new Map();
  let busy = false,
    lastRead = -Infinity;
  const ttl = 300000;
  const lifetime = new AbortController();
  const active = () => !lifetime.signal.aborted;
  function put(map, value) {
    for (const [key, v] of map) if (v.expires <= now()) map.delete(key);
    while (map.size >= 200) map.delete(map.keys().next().value);
    const key = token();
    map.set(key, { ...value, expires: now() + ttl });
    return key;
  }
  function unavailable(error) {
    return {
      ok: false,
      error: errors.has(error?.code) ? error.code : "provider_unavailable",
      items: null,
      counts: null,
      total: null,
      nextCursor: null,
    };
  }
  return Object.freeze({
    async list({ cursor = null, query = "", state = "all" } = {}) {
      let acquired = false;
      try {
        if (!active()) throw fault("invalid_request");
        if (
          typeof query !== "string" ||
          query.length > 80 ||
          !states.includes(state)
        )
          throw fault("invalid_request");
        query = query.trim().toLowerCase();
        const scope = JSON.stringify([query, state]);
        let after = null,
          seen = [];
        if (cursor !== null) {
          const saved = cursors.get(cursor);
          if (!saved || saved.expires <= now() || saved.scope !== scope)
            throw fault("invalid_cursor");
          after = saved.after;
          seen = saved.seen;
        }
        if (busy) throw fault("busy");
        // A fixed request budget prevents sequential refresh storms in this instance.
        if (now() - lastRead < 1000) throw fault("rate_limited");
        busy = true;
        acquired = true;
        lastRead = now();
        await bounded(
          () => audit({ action: "newsletter.list", requestId: token() }),
          2000,
          lifetime.signal,
        );
        const page = await bounded(
          (signal) => adapter.readPage({ after, limit: 10, signal }),
          25000,
          lifetime.signal,
        );
        if (!active()) throw fault("invalid_request");
        if (page.items.some((item) => seen.includes(item.id)))
          throw fault("invalid_provider_response");
        if (seen.length + page.items.length > 1000)
          throw fault("pagination_limit");
        seen = [...seen, ...page.items.map((item) => item.id)];
        const counts = {
          active: 0,
          unsubscribed: 0,
          suppressed: 0,
          outside_segment: 0,
          unknown: 0,
        };
        for (const item of page.items) counts[item.state]++;
        const items = page.items
          .filter(
            (c) =>
              (state === "all" || c.state === state) &&
              c.email.toLowerCase().includes(query),
          )
          .map((c) => {
            const handle = put(handles, { contact: c });
            return { handle, email: c.email, state: c.state };
          });
        return {
          ok: true,
          items,
          counts,
          countScope: "provider_page",
          total: !after && !page.after ? page.items.length : null,
          pending: null,
          nextCursor: page.after
            ? put(cursors, { after: page.after, scope, seen })
            : null,
          fetchedAt: new Date(now()).toISOString(),
          quality: [
            "bounded_page_search",
            ...(counts.unknown ? ["incomplete_provider_evidence"] : []),
          ],
          provider: "available",
        };
      } catch (error) {
        return unavailable(error);
      } finally {
        if (acquired) busy = false;
      }
    },
    async detail(handle) {
      const saved = handles.get(handle);
      if (!active() || !saved || saved.expires <= now())
        return { ok: false, error: "not_found" };
      try {
        await bounded(
          () => audit({ action: "newsletter.detail", requestId: token() }),
          2000,
          lifetime.signal,
        );
      } catch {
        return { ok: false, error: "audit_unavailable" };
      }
      if (!active() || saved.expires <= now())
        return { ok: false, error: "not_found" };
      const c = saved.contact;
      let consent = null;
      const quality = [];
      try {
        const hash = subjectHash(c.email.trim().toLowerCase());
        if (!/^[a-f0-9]{64}$/.test(hash)) throw fault("consent_unavailable");
        const raw = await bounded(
          (signal) => readConsent(hash, { signal, limit: 20 }),
          2000,
          lifetime.signal,
        );
        if (raw)
          consent = {
            state: ["pending", "subscribed", "unsubscribed"].includes(raw.state)
              ? raw.state
              : "unknown",
            events: (Array.isArray(raw.events) ? raw.events : [])
              .slice(0, 20)
              .map((e) => ({
                type: [
                  "opt_in_requested",
                  "opt_in_confirmed",
                  "unsubscribed",
                ].includes(e.type)
                  ? e.type
                  : "unknown",
                at:
                  typeof e.at === "string" &&
                  /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(e.at)
                    ? e.at
                    : null,
              })),
          };
        if (!raw) quality.push("consent_missing");
        if (consent && c.state === "active" && consent.state !== "subscribed")
          quality.push("consent_conflict");
      } catch {
        quality.push("consent_unavailable");
      }
      if (!active() || saved.expires <= now())
        return { ok: false, error: "not_found" };
      return {
        ok: true,
        email: c.email,
        state: c.state,
        observedAt: new Date(saved.expires - ttl).toISOString(),
        globalUnsubscribed: c.globalUnsubscribed,
        inSegment: c.inSegment,
        topic: c.topic,
        suppressed: c.suppressed,
        consent,
        quality,
      };
    },
    clear() {
      lifetime.abort();
      cursors.clear();
      handles.clear();
    },
  });
}
