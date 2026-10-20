// No credentials, environment reads or default transport. Not wired to production.
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
export function fault(code) {
  return Object.assign(new Error(code), { code });
}
export async function bounded(operation, ms = 2000, parent) {
  if (parent?.aborted) throw fault("timeout");
  const controller = new AbortController();
  let timer, abort;
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw fault("timeout");
        return operation(controller.signal);
      }),
      new Promise((_, reject) => {
        abort = () => {
          controller.abort();
          reject(fault("timeout"));
        };
        parent?.addEventListener("abort", abort, { once: true });
        timer = setTimeout(abort, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  }
}
export function createReadAdapter({
  transport,
  segmentId,
  topicId,
  readSuppression = async () => null,
  timeoutMs = 2000,
}) {
  if (
    typeof transport !== "function" ||
    !idPattern.test(segmentId) ||
    !idPattern.test(topicId)
  )
    throw fault("configuration");
  async function get(path, parent) {
    const response = await bounded(
      (signal) => transport(path, { method: "GET", signal, maxBytes: 65536 }),
      timeoutMs,
      parent,
    );
    if (response?.status === 429) throw fault("rate_limited");
    if (response?.status !== 200) throw fault("provider_unavailable");
    const body = response.body;
    if (!body || JSON.stringify(body).length > 65536)
      throw fault("invalid_provider_response");
    return body;
  }
  function page(body, limit) {
    if (
      !Array.isArray(body.data) ||
      body.data.length > limit ||
      typeof body.has_more !== "boolean"
    )
      throw fault("invalid_provider_response");
    return body;
  }
  return Object.freeze({
    async readPage({ after = null, limit = 10, signal } = {}) {
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 10 ||
        (after !== null && !idPattern.test(after))
      )
        throw fault("invalid_request");
      const result = page(
        await get(
          `/contacts?limit=${limit}${after ? "&after=" + encodeURIComponent(after) : ""}`,
          signal,
        ),
        limit,
      );
      const ids = new Set();
      const items = [];
      for (const c of result.data) {
        if (
          !idPattern.test(c?.id) ||
          ids.has(c.id) ||
          c.id === after ||
          typeof c.email !== "string" ||
          c.email.length > 254 ||
          !/^\S+@\S+\.\S+$/.test(c.email) ||
          typeof c.unsubscribed !== "boolean"
        )
          throw fault("invalid_provider_response");
        ids.add(c.id);
        const segments = page(
          await get(
            `/contacts/${encodeURIComponent(c.id)}/segments?limit=100`,
            signal,
          ),
          100,
        );
        const topics = page(
          await get(
            `/contacts/${encodeURIComponent(c.id)}/topics?limit=100`,
            signal,
          ),
          100,
        );
        for (const nested of [segments, topics]) {
          const unique = new Set();
          for (const entry of nested.data) {
            if (!idPattern.test(entry?.id) || unique.has(entry.id))
              throw fault("invalid_provider_response");
            unique.add(entry.id);
          }
        }
        const inSegment = segments.data.some((s) => s.id === segmentId)
          ? true
          : segments.has_more
            ? null
            : false;
        const topic =
          topics.data.find((t) => t.id === topicId)?.subscription ?? null;
        // No documented suppression proof is assumed from the contact payload.
        const suppressed = await bounded(
          (signal) => readSuppression(c.id, { signal }),
          timeoutMs,
          signal,
        );
        let state = "unknown";
        if (c.unsubscribed || topic === "opt_out") state = "unsubscribed";
        else if (suppressed === true) state = "suppressed";
        else if (inSegment === false) state = "outside_segment";
        else if (
          inSegment === true &&
          topic === "opt_in" &&
          suppressed === false
        )
          state = "active";
        items.push({
          id: c.id,
          email: c.email,
          state,
          globalUnsubscribed: c.unsubscribed,
          inSegment,
          topic: ["opt_in", "opt_out"].includes(topic) ? topic : null,
          suppressed: typeof suppressed === "boolean" ? suppressed : null,
        });
      }
      if (result.has_more && !items.length)
        throw fault("invalid_provider_response");
      return { items, after: result.has_more ? items.at(-1).id : null };
    },
  });
}
