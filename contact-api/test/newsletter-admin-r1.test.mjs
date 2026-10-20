import test from "node:test";
import assert from "node:assert/strict";
import { createReadAdapter } from "../admin-r1/provider.mjs";
import { createReadService } from "../admin-r1/service.mjs";
import { denyAdmin } from "../admin-r1/deny.mjs";

const contact = (id = "a") => ({
  id,
  email: `${id}@example.test`,
  unsubscribed: false,
});
function fixture({ failure, more = false, suppression = false } = {}) {
  const calls = [];
  const adapter = createReadAdapter({
    segmentId: "newsletter",
    topicId: "news",
    readSuppression: async () => suppression,
    transport: async (path, options) => {
      calls.push({ path, options });
      if (failure)
        return { status: failure, body: { message: "secret@example.test" } };
      if (path.includes("/segments"))
        return {
          status: 200,
          body: { data: [{ id: "newsletter" }], has_more: false },
        };
      if (path.includes("/topics"))
        return {
          status: 200,
          body: {
            data: [{ id: "news", subscription: "opt_in" }],
            has_more: false,
          },
        };
      return {
        status: 200,
        body: {
          data: [contact(path.includes("after=") ? "b" : "a")],
          has_more: more,
        },
      };
    },
  });
  return { adapter, calls };
}
const serviceOf = (adapter, extra = {}) =>
  createReadService({
    adapter,
    audit: async () => {},
    subjectHash: () => "a".repeat(64),
    readConsent: async () => null,
    ...extra,
  });
test("active requires all provider evidence, suppression unknown stays unknown", async () => {
  const { adapter, calls } = fixture();
  const page = await adapter.readPage({ limit: 10 });
  assert.equal(page.items[0].state, "active");
  assert.equal(calls.length, 3);
  assert.ok(calls.every((x) => x.options.method === "GET"));
  assert.equal(
    (await fixture({ suppression: null }).adapter.readPage({ limit: 10 }))
      .items[0].state,
    "unknown",
  );
});
for (const status of [429, 500, 503])
  test(`provider ${status} is unavailable, never zero`, async () => {
    const result = await serviceOf(fixture({ failure: status }).adapter).list(
      {},
    );
    assert.equal(result.ok, false);
    assert.equal(result.counts, null);
    assert.equal(result.items, null);
    assert.ok(!JSON.stringify(result).includes("secret@example.test"));
  });
test("cursor is opaque, scoped to filters, expires; IDs and hashes stay server-side", async () => {
  let now = 0;
  const svc = serviceOf(fixture({ more: true }).adapter, { now: () => now });
  const first = await svc.list({ query: "example" });
  assert.equal(first.total, null);
  assert.ok(first.nextCursor);
  assert.notEqual(first.items[0].handle, "a");
  assert.ok(!JSON.stringify(first).includes('"id"'));
  assert.equal(
    (await svc.list({ cursor: first.nextCursor, query: "other" })).error,
    "invalid_cursor",
  );
  now = 1000;
  const second = await svc.list({ cursor: first.nextCursor, query: "example" });
  assert.equal(second.items[0].email, "b@example.test");
  now = 300001;
  assert.equal(
    (await svc.list({ cursor: first.nextCursor, query: "example" })).error,
    "invalid_cursor",
  );
  assert.equal((await svc.detail(first.items[0].handle)).error, "not_found");
});
test("consent is HMAC matched and projected, missing evidence is not fabricated", async () => {
  let subject;
  const svc = serviceOf(fixture().adapter, {
    readConsent: async (hash) => {
      subject = hash;
      return {
        state: "pending",
        events: [
          {
            type: "opt_in_requested",
            at: "2026-10-15T12:00:00Z",
            version: "r1",
            email: "leak@example.test",
            token: "secret",
          },
        ],
        raw: "secret",
      };
    },
  });
  const list = await svc.list({});
  const detail = await svc.detail(list.items[0].handle);
  assert.equal(subject, "a".repeat(64));
  assert.equal(detail.consent.state, "pending");
  assert.ok(!JSON.stringify(detail).includes("secret"));
  assert.ok(!JSON.stringify(detail).includes("leak"));
  assert.ok(detail.quality.includes("consent_conflict"));
});
test("denial ignores forged owner headers, cookies, methods and dependency arguments", () => {
  for (const method of ["GET", "POST", "OPTIONS", "DELETE"]) {
    let status, headers, body;
    denyAdmin(
      { method, headers: { cookie: "owner=true", "x-role": "OWNER" } },
      {
        writeHead: (s, h) => {
          status = s;
          headers = h;
        },
        end: (b) => {
          body = b;
        },
      },
    );
    assert.equal(status, 403);
    assert.equal(headers["Cache-Control"], "no-store");
    assert.equal(headers["Set-Cookie"], undefined);
    assert.ok(!body.includes("example.test"));
  }
});

test("timeout terminates a stalled provider and sanitizes errors", async () => {
  const adapter = createReadAdapter({
    segmentId: "s",
    topicId: "t",
    timeoutMs: 10,
    transport: async () => new Promise(() => {}),
  });
  const result = await serviceOf(adapter).list({});
  assert.equal(result.error, "timeout");
  assert.equal(result.counts, null);
});
test("malformed, duplicate and non-progressing provider pages fail closed", async () => {
  for (const body of [
    { data: [], has_more: true },
    { data: [contact(), contact()], has_more: false },
    { data: [contact()], has_more: "false" },
  ]) {
    const adapter = createReadAdapter({
      segmentId: "s",
      topicId: "t",
      transport: async () => ({ status: 200, body }),
    });
    assert.equal(
      (await serviceOf(adapter).list({})).error,
      "invalid_provider_response",
    );
  }
});
test("bounded page filtering never claims global search or empty global count", async () => {
  const { adapter, calls } = fixture({ more: true });
  const result = await serviceOf(adapter).list({ query: "no-match" });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, null);
  assert.equal(result.countScope, "provider_page");
  assert.ok(result.nextCursor);
  assert.equal(calls.length, 3);
});
test("refresh rate limit and clear invalidate detail handles", async () => {
  const svc = serviceOf(fixture().adapter);
  const page = await svc.list({});
  assert.equal((await svc.list({})).error, "rate_limited");
  svc.clear();
  assert.equal((await svc.detail(page.items[0].handle)).error, "not_found");
});
test("concurrent rejection cannot release another request lock", async () => {
  let release;
  let calls = 0;
  let now = 0;
  const adapter = {
    readPage: async () => {
      calls++;
      await new Promise((resolve) => {
        release = resolve;
      });
      return { items: [], after: null };
    },
  };
  const svc = serviceOf(adapter, { now: () => now });
  const pending = svc.list({});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await svc.list({})).error, "busy");
  now = 2000;
  assert.equal((await svc.list({})).error, "busy");
  assert.equal(calls, 1);
  release();
  await pending;
});
test("HTTP integration: private routes deny, synthetic preview rejects foreign origins", async (t) => {
  const { createPreview } = await import("../admin-r1/testing/preview.mjs");
  const server = createPreview();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of [
    "/internal/admin/newsletter",
    "/internal/admin/newsletter/summary",
    "/internal/admin/newsletter/subscribers/anything",
    "/admin/login",
    "/admin/export",
  ]) {
    const response = await fetch(base + path, {
      headers: { cookie: "owner=true", "x-role": "OWNER" },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  const foreign = await fetch(base + "/fixture/list", {
    method: "POST",
    headers: {
      origin: "https://evil.test",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(foreign.status, 403);
  const response = await fetch(base + "/fixture/list", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 10);
  assert.equal(body.total, null);
});
test("audit records contain only fixed metadata; failed audit prevents provider read", async () => {
  const events = [];
  const { adapter } = fixture();
  const svc = serviceOf(adapter, {
    audit: async (event) => events.push(event),
  });
  const page = await svc.list({ query: "a@example.test" });
  await svc.detail(page.items[0].handle);
  assert.equal(events.length, 2);
  assert.deepEqual(Object.keys(events[0]).sort(), ["action", "requestId"]);
  assert.ok(!JSON.stringify(events).includes("example.test"));
  const f = fixture();
  const failed = serviceOf(f.adapter, {
    audit: async () => {
      throw new Error("secret");
    },
  });
  assert.equal((await failed.list({})).ok, false);
  assert.equal(f.calls.length, 0);
});
test("contradictory topic records cannot prove active", async () => {
  const adapter = createReadAdapter({
    segmentId: "s",
    topicId: "t",
    readSuppression: async () => false,
    transport: async (path) => ({
      status: 200,
      body: path.includes("/topics")
        ? {
            data: [
              { id: "t", subscription: "opt_in" },
              { id: "t", subscription: "opt_out" },
            ],
            has_more: false,
          }
        : path.includes("/segments")
          ? { data: [{ id: "s" }], has_more: false }
          : { data: [contact()], has_more: false },
    }),
  });
  assert.equal(
    (await serviceOf(adapter).list({})).error,
    "invalid_provider_response",
  );
});
test("multi-page cursor cycles are rejected", async () => {
  let now = 0;
  let index = 0;
  const svc = serviceOf(
    {
      readPage: async () => {
        const id = ["a", "b", "a"][index++];
        return { items: [{ ...contact(id), state: "active" }], after: id };
      },
    },
    { now: () => now },
  );
  const first = await svc.list({});
  now = 1000;
  const second = await svc.list({ cursor: first.nextCursor });
  now = 2000;
  assert.equal(
    (await svc.list({ cursor: second.nextCursor })).error,
    "invalid_provider_response",
  );
});
test("parent cancellation stops subsequent provider requests", async () => {
  const controller = new AbortController();
  let calls = 0;
  const adapter = createReadAdapter({
    segmentId: "s",
    topicId: "t",
    transport: async () => {
      calls++;
      controller.abort();
      return { status: 200, body: { data: [contact()], has_more: false } };
    },
  });
  await assert.rejects(
    () => adapter.readPage({ signal: controller.signal }),
    (e) => e.code === "timeout",
  );
  assert.equal(calls, 1);
});
for (const variant of ["global", "topic", "segment", "suppressed", "partial"])
  test(`provider ${variant} cannot be active`, async () => {
    const adapter = createReadAdapter({
      segmentId: "s",
      topicId: "t",
      readSuppression: async () => variant === "suppressed",
      transport: async (path) => ({
        status: 200,
        body: path.includes("/topics")
          ? {
              data: [
                {
                  id: "t",
                  subscription: variant === "topic" ? "opt_out" : "opt_in",
                },
              ],
              has_more: false,
            }
          : path.includes("/segments")
            ? {
                data:
                  variant === "segment" || variant === "partial"
                    ? []
                    : [{ id: "s" }],
                has_more: variant === "partial",
              }
            : {
                data: [{ ...contact(), unsubscribed: variant === "global" }],
                has_more: false,
              },
      }),
    });
    const result = await serviceOf(adapter).list({});
    assert.equal(result.ok, true);
    assert.notEqual(result.items[0].state, "active");
  });
test("missing and unavailable consent remain explicit without losing provider observation", async () => {
  for (const readConsent of [
    async () => null,
    async () => {
      throw new Error("private-message");
    },
  ]) {
    const svc = serviceOf(fixture().adapter, { readConsent });
    const list = await svc.list({});
    const detail = await svc.detail(list.items[0].handle);
    assert.equal(detail.state, "active");
    assert.equal(detail.consent, null);
    assert.equal(detail.quality.length, 1);
    assert.ok(!JSON.stringify(detail).includes("private-message"));
  }
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test("clear cancels an inflight list and permanently invalidates the service", async () => {
  const started = deferred(),
    result = deferred();
  let signal;
  const svc = serviceOf({
    readPage: async (options) => {
      signal = options.signal;
      started.resolve();
      return result.promise;
    },
  });
  const pending = svc.list({});
  await started.promise;
  svc.clear();
  result.resolve({ items: [{ ...contact(), state: "active" }], after: null });
  const response = await pending;
  assert.equal(response.ok, false);
  assert.equal(response.items, null);
  assert.equal(signal.aborted, true);
  assert.equal((await svc.list({})).ok, false);
});
test("clear during consent read prevents late detail disclosure", async () => {
  const started = deferred(),
    result = deferred();
  const svc = serviceOf(fixture().adapter, {
    readConsent: async () => {
      started.resolve();
      return result.promise;
    },
  });
  const page = await svc.list({});
  const pending = svc.detail(page.items[0].handle);
  await started.promise;
  svc.clear();
  result.resolve({ state: "subscribed", events: [] });
  const detail = await pending;
  assert.equal(detail.ok, false);
  assert.equal(detail.email, undefined);
});
test("detail expiry is rechecked after asynchronous evidence lookup", async () => {
  let now = 0;
  const svc = serviceOf(fixture().adapter, {
    now: () => now,
    readConsent: async () => {
      now = 300001;
      return { state: "subscribed", events: [] };
    },
  });
  const page = await svc.list({});
  assert.equal((await svc.detail(page.items[0].handle)).ok, false);
});

test("new-only private reader resolves active, pending and revoked evidence without legacy Resend",async()=>{
  const {createNewOnlyAdminReader}=await import("../admin-r1/new-only-reader.mjs");
  const {createCipheriv,createHmac}=await import("node:crypto");
  const encryptionKey=Buffer.alloc(32,0x21);
  const subjectKey=Buffer.alloc(32,0x32);
  const mailboxTag=email=>createHmac("sha256",subjectKey)
    .update("gracz-new-only:email\n"+email).digest("hex");
  const record=(email,state,revoked=false)=>{
    const emailTag=mailboxTag(email),nonce=Buffer.alloc(12,0x09);
    const cipher=createCipheriv("aes-256-gcm",encryptionKey,nonce);
    cipher.setAAD(Buffer.from("gracz-newsletter-new:"+emailTag));
    const ciphertext=Buffer.concat([cipher.update(email,"utf8"),cipher.final()]);
    return {email_tag:emailTag,ciphertext,nonce,auth_tag:cipher.getAuthTag(),
      state,revoked,source:"newsletter_page",
      requested_at:new Date("2026-10-20T01:00:00Z"),
      confirmed_at:state==="active"?new Date("2026-10-20T01:04:00Z"):null};
  };
  const records=[
    record("alpha@example.test","active"),
    record("beta@example.test","pending"),
    record("gamma@example.test","active",true),
  ].sort((a,b)=>b.email_tag.localeCompare(a.email_tag));
  const calls=[];
  const database={async queryBounded(sql,params,opts){
    calls.push({sql,opts});
    if(sql.includes("s.ciphertext")){
      const after=params[0];
      return {rows:records.filter(x=>after===null||x.email_tag<after).slice(0,params[1])};
    }
    if(sql.includes("SELECT s.state,s.confirmed_at")){
      return {rows:records.filter(x=>x.email_tag===params[0]).map(x=>({
        state:x.state,revoked:x.revoked,confirmed_at:x.confirmed_at
      }))};
    }
    if(sql.includes("UNION ALL")){
      const r=records.find(x=>x.email_tag===params[0]);
      return {rows:r?.revoked?[{type:"unsubscribed",at:new Date("2026-10-20T02:00:00Z")}]:
        r?.state==="active"?[{type:"opt_in_confirmed",at:new Date("2026-10-20T01:04:00Z")}]:[]};
    }
    throw Error("unexpected database query");
  }};
  const reader=createNewOnlyAdminReader({database,encryptionKey,subjectKey});
  const page=await reader.adapter.readPage({limit:2});
  assert.equal(page.items.length,2);
  assert.ok(page.after);
  assert.deepEqual(new Set([...page.items,(await reader.adapter.readPage({after:page.after})).items[0]]
    .map(x=>x.state)),new Set(["active","pending","unsubscribed"]));
  assert.ok(!JSON.stringify(page).includes("ciphertext"));
  assert.ok(calls.every(x=>x.opts.timeoutMs===2000));
  const revoked=await reader.readConsent(mailboxTag("gamma@example.test"));
  assert.equal(revoked.state,"unsubscribed");
  assert.equal(revoked.events[0].type,"unsubscribed");
  const service=createReadService({...reader,audit:async()=>{}});
  const snapshot=await service.list({});
  assert.equal(snapshot.ok,true);
  assert.equal(snapshot.counts.pending,1);
  assert.equal(snapshot.counts.unsubscribed,1);
  assert.equal(snapshot.counts.active,1);
  const detail=await service.detail(snapshot.items.find(x=>x.state==="active").handle);
  assert.equal(detail.consent.state,"subscribed");
  assert.equal(detail.requestedAt,"2026-10-20T01:00:00.000Z");
  assert.equal(detail.confirmedAt,"2026-10-20T01:04:00.000Z");
  assert.equal(detail.source,"newsletter_page");
  // Tampered encryption must fail closed and reveal no raw provider / query errors.
  const tamper=records[0];
  const old=Buffer.from(tamper.auth_tag);
  tamper.auth_tag=Buffer.from(old);tamper.auth_tag[0]^=1;
  await assert.rejects(reader.adapter.readPage({limit:2}),{code:"invalid_provider_response"});
});
test("new-only private reader rejects missing keys, invalid cursors, and is never routed",async()=>{
  const {createNewOnlyAdminReader}=await import("../admin-r1/new-only-reader.mjs");
  assert.throws(()=>createNewOnlyAdminReader({database:{queryBounded:async()=>({rows:[]})}}),
    {code:"configuration"});
  const source=createNewOnlyAdminReader({database:{queryBounded:async()=>({rows:[]})},
    encryptionKey:Buffer.alloc(32,1),subjectKey:Buffer.alloc(32,2)});
  await assert.rejects(source.adapter.readPage({after:"../../old-newsletter"}),{code:"invalid_request"});
  await assert.rejects(source.readConsent("not-a-subject"),{code:"invalid_request"});
});
