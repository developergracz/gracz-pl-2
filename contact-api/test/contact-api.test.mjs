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
  return fetch(url, {
    method: "POST",
    headers: {
      origin: "https://gracz.pl",
      "content-type": "application/json",
      "x-idempotency-key": key,
      ...extraHeaders,
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

  await t.test("valid request sends once and sets Reply-To plus provider idempotency", async () => {
    const key = "valid-request-key-0001";
    const response = await request(endpoint, makePayload(), key);
    assert.equal(response.status, 200, stderr);

    assert.equal(providerCalls, 1);
    assert.equal(deliveries[0].body.reply_to, "jan@example.test");
    assert.equal(deliveries[0].body.to[0], "admin@gracz.pl");
    assert.equal(deliveries[0].headers["idempotency-key"], "contact/" + key);
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

  await t.test("spoofed left XFF values do not reset the rightmost-IP rate limit", async () => {
    const fixedRightmost = "203.0.113.44";
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await request(
        endpoint,
        makePayload({ email: "admin@gracz.pl" }),
        "xff-rate-key-" + String(i).padStart(12, "0"),
        { "x-forwarded-for": "198.51.100." + (10 + i) + ", " + fixedRightmost }
      );
      statuses.push(response.status);
    }
    assert.equal(statuses[5], 429);
  });
});
