import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitFor(url, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastError || new Error("service did not start");
}

function makePayload(overrides = {}) {
  return {
    name: "Jan Kowalski",
    email: "jan@example.test",
    category: "Pytanie ogólne",
    subject: "Test formularza",
    message: "To jest poprawna wiadomość testowa formularza gracz.pl.",
    website: "",
    acknowledgement: true,
    page: "https://gracz.pl/",
    startedAt: Date.now() - 5000,
    ...overrides,
  };
}

function request(url, payload, key, extraHeaders = {}) {
  const octet = 10 + Array.from(key).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 200;
  return fetch(url, {
    method: "POST",
    headers: {
      origin: "https://gracz.pl",
      "content-type": "application/json",
      "x-idempotency-key": key,
      "x-forwarded-for": "198.51.100." + octet,
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  });
}

function premiumRequest(url, payload, ip = "203.0.113.210") {
  return fetch(url, {
    method: "POST",
    headers: {
      origin: "https://gracz.pl",
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(payload),
  });
}

test("contact API security regression suite", async (t) => {
  const providerPort = await getFreePort();
  const apiPort = await getFreePort();

  let providerCalls = 0;
  const deliveries = [];
  let delayMs = 0;

  const provider = createServer(async (req, res) => {
    providerCalls += 1;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    deliveries.push({
      headers: req.headers,
      body,
    });
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "mock-" + providerCalls }));
  });

  provider.listen(providerPort, "127.0.0.1");
  await once(provider, "listening");

  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(apiPort),
      HOST: "127.0.0.1",
      RESEND_API_KEY: "test-key",
      RESEND_ENDPOINT: "http://127.0.0.1:" + providerPort + "/emails",
      EMAIL_FROM: "Gracz.pl <kontakt@gracz.pl>",
      CONTACT_TO: "admin@gracz.pl",
      CONTACT_REPLY_SECRET: "test-" + "x".repeat(40),
      PREMIUM_REPLY_TEST_MEMORY_STORE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  t.after(async () => {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    await new Promise((resolve) => provider.close(resolve));
  });

  await waitFor("http://127.0.0.1:" + apiPort + "/health");
  const endpoint = "http://127.0.0.1:" + apiPort + "/contact";
  const replyContextEndpoint = "http://127.0.0.1:" + apiPort + "/reply-context";
  const replyEndpoint = "http://127.0.0.1:" + apiPort + "/reply";
  let premiumToken = "";

  await t.test("valid request sends premium admin mail with encrypted reply link", async () => {
    const key = "valid-request-key-0001";
    const response = await request(endpoint, makePayload(), key);
    assert.equal(response.status, 200, stderr);

    assert.equal(providerCalls, 1);
    assert.equal(deliveries[0].body.reply_to, "jan@example.test");
    assert.equal(deliveries[0].body.to[0], "admin@gracz.pl");
    assert.equal(deliveries[0].headers["idempotency-key"], "contact/" + key);
    assert.match(deliveries[0].body.html, /Odpowiedz przez gracz\.pl/);
    assert.match(deliveries[0].body.html, /gracz<span[^>]*>\.pl<\/span>/);
    assert.match(deliveries[0].body.html, /FULL MAX PREMIUM/);
    assert.match(deliveries[0].body.html, /NEWSLETTER GRACZ\.PL/);
    assert.match(deliveries[0].body.html, /Zapisz się do newslettera gracz\.pl/);

    const tokenMatch = deliveries[0].body.html.match(
      /https:\/\/gracz\.pl\/kontakt\/odpowiedz\/#token=([A-Za-z0-9._-]+)/
    );
    assert.ok(tokenMatch);
    premiumToken = tokenMatch[1];
    assert.ok(premiumToken.startsWith("v1."));
    assert.equal(premiumToken.includes("jan@example.test"), false);
  });

  await t.test("premium reply context is masked and tamper resistant", async () => {
    const contextResponse = await premiumRequest(
      replyContextEndpoint,
      { token: premiumToken },
      "203.0.113.211"
    );
    assert.equal(contextResponse.status, 200);
    const contextBody = await contextResponse.json();
    assert.equal(contextBody.ok, true);
    assert.equal(contextBody.context.recipient, "j***@example.test");
    assert.equal(contextBody.context.subject, "Test formularza");

    const last = premiumToken.slice(-1);
    const tampered = premiumToken.slice(0, -1) + (last === "A" ? "B" : "A");
    const tamperedResponse = await premiumRequest(
      replyContextEndpoint,
      { token: tampered },
      "203.0.113.212"
    );
    assert.equal(tamperedResponse.status, 400);
    const tamperedBody = await tamperedResponse.json();
    assert.equal(tamperedBody.error.code, "INVALID_REPLY_TOKEN");
  });

  await t.test("premium reply sends branded escaped HTML once with owner Reply-To", async () => {
    const before = providerCalls;
    const replyMessage = "Dziękujemy <script>alert('x')</script> za kontakt.";
    const response = await premiumRequest(
      replyEndpoint,
      { token: premiumToken, message: replyMessage },
      "203.0.113.213"
    );
    assert.equal(response.status, 200, stderr);
    assert.equal(providerCalls, before + 1);

    const delivery = deliveries.at(-1);
    assert.equal(delivery.body.to[0], "jan@example.test");
    assert.equal(delivery.body.reply_to, "admin@gracz.pl");
    assert.match(delivery.body.subject, /^Odp: gracz\.pl — Test formularza$/);
    assert.match(delivery.body.html, /ODPOWIEDŹ GRACZ\.PL/);
    assert.match(delivery.body.html, /FULL MAX PREMIUM/);
    assert.match(delivery.body.html, /NEWSLETTER GRACZ\.PL/);
    assert.match(delivery.body.html, /Zapisz się do newslettera gracz\.pl/);
    assert.equal(delivery.body.html.includes("<script>"), false);
    assert.ok(delivery.body.html.includes("&lt;script&gt;"));
    assert.ok(delivery.body.text.includes(replyMessage));
    assert.match(delivery.headers["idempotency-key"], /^contact-reply\/[a-f0-9]{40}$/);

    const countAfterSend = providerCalls;
    const replay = await premiumRequest(
      replyEndpoint,
      { token: premiumToken, message: "Druga próba" },
      "203.0.113.214"
    );
    assert.equal(replay.status, 409);
    const replayBody = await replay.json();
    assert.equal(replayBody.error.code, "REPLY_TOKEN_USED");
    assert.equal(providerCalls, countAfterSend);
  });

  await t.test("same key + same payload replays without a second provider call", async () => {
    const key = "replay-request-key-0002";
    const payload = makePayload({ subject: "Replay test" });

    const first = await request(endpoint, payload, key);
    assert.equal(first.status, 200);

    const countAfterFirst = providerCalls;
    const second = await request(endpoint, payload, key);
    assert.equal(second.status, 200);
    assert.equal(providerCalls, countAfterFirst);
  });

  await t.test("same key + changed payload is rejected", async () => {
    const key = "conflict-request-key-0003";
    const first = await request(
      endpoint,
      makePayload({ subject: "Original payload" }),
      key
    );
    assert.equal(first.status, 200);

    const countAfterFirst = providerCalls;
    const second = await request(
      endpoint,
      makePayload({ subject: "Changed payload" }),
      key
    );
    assert.equal(second.status, 409);
    assert.equal(providerCalls, countAfterFirst);
  });

  await t.test("concurrent same-key requests reach provider at most once", async () => {
    const key = "race-request-key-0004";
    const payload = makePayload({ subject: "Concurrent test" });

    delayMs = 250;
    const before = providerCalls;
    const [a, b] = await Promise.all([
      request(endpoint, payload, key),
      request(endpoint, payload, key),
    ]);
    delayMs = 0;

    assert.ok([200, 409].includes(a.status));
    assert.ok([200, 409].includes(b.status));
    assert.equal(providerCalls - before, 1);
  });

  await t.test("administrative mailbox cannot be used as visitor identity", async () => {
    const before = providerCalls;
    const response = await request(
      endpoint,
      makePayload({ email: "admin@gracz.pl" }),
      "admin-address-key-0005"
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "ADMIN_EMAIL_NOT_ALLOWED");
    assert.equal(providerCalls, before);
  });

  await t.test("non-string email is rejected instead of coerced", async () => {
    const response = await request(
      endpoint,
      makePayload({ email: ["jan@example.test"] }),
      "wrong-type-key-0006"
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "INVALID_FIELD_TYPE");
  });

  await t.test("fake JSON content type is rejected", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        origin: "https://gracz.pl",
        "content-type": "application/json-not-json",
        "x-idempotency-key": "bad-content-type-0007",
      },
      body: JSON.stringify(makePayload()),
    });
    assert.equal(response.status, 415);
  });

  await t.test("oversize JSON body is rejected before field validation", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        origin: "https://gracz.pl",
        "content-type": "application/json",
        "x-idempotency-key": "oversize-body-key-0008",
        "x-forwarded-for": "203.0.113.80",
      },
      body: JSON.stringify(makePayload({ message: "x".repeat(17000) })),
    });
    assert.equal(response.status, 413);
    const body = await response.json();
    assert.equal(body.error.code, "PAYLOAD_TOO_LARGE");
  });

  await t.test("spoofed trailing XFF values do not reset the Render client-IP rate limit", async () => {
    const fixedClient = "203.0.113.44";
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await request(
        endpoint,
        makePayload({ email: "admin@gracz.pl" }),
        "xff-rate-key-" + String(i).padStart(12, "0"),
        { "x-forwarded-for": fixedClient + ", 198.51.100." + (10 + i) }
      );
      statuses.push(response.status);
    }
    assert.equal(statuses[5], 429);
  });

  await t.test("spoofed CF-Connecting-IP does not bypass the XFF rate limit", async () => {
    const fixedClient = "203.0.113.45";
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await request(
        endpoint,
        makePayload({ email: "admin@gracz.pl" }),
        "cf-rate-key-" + String(i).padStart(12, "0"),
        {
          "x-forwarded-for": fixedClient,
          "cf-connecting-ip": "198.51.100." + (30 + i),
        }
      );
      statuses.push(response.status);
    }
    assert.equal(statuses[5], 429);
  });
});
