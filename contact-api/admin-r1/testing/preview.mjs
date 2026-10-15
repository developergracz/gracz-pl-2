// Test-only preview: fixed synthetic provider, loopback bind, no live configuration.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createHash, createHmac } from "node:crypto";
import { createReadAdapter } from "../provider.mjs";
import { createReadService } from "../service.mjs";
import { denyAdmin, privateHeaders } from "../deny.mjs";
export function createPreview({ failure = null } = {}) {
  const contacts = Array.from({ length: 23 }, (_, i) => ({
    id: `fixture-${i}`,
    email: `gracz${String(i + 1).padStart(2, "0")}@example.test`,
    unsubscribed: i % 5 === 1,
  }));
  const key = createHash("sha256")
    .update("newsletter-consent-subject:synthetic-fixture-only")
    .digest();
  const adapter = createReadAdapter({
    segmentId: "newsletter",
    topicId: "news",
    readSuppression: async (id) =>
      Number(id.split("-")[1]) % 5 === 3 ? null : false,
    timeoutMs: 40,
    transport: async (path) => {
      if (failure === "timeout") return new Promise(() => {});
      if (failure) return { status: Number(failure), body: {} };
      const url = new URL(path, "https://fixture.invalid");
      if (url.pathname.endsWith("/segments"))
        return {
          status: 200,
          body: { has_more: false, data: [{ id: "newsletter" }] },
        };
      if (url.pathname.endsWith("/topics"))
        return {
          status: 200,
          body: {
            has_more: false,
            data: [{ id: "news", subscription: "opt_in" }],
          },
        };
      const after = url.searchParams.get("after");
      const start = after ? contacts.findIndex((c) => c.id === after) + 1 : 0;
      const data = contacts.slice(start, start + 10);
      return {
        status: 200,
        body: { data, has_more: start + 10 < contacts.length },
      };
    },
  });
  const audit = [];
  const service = createReadService({
    adapter,
    audit: async (event) => {
      audit.push(event);
      if (audit.length > 100) audit.shift();
    },
    subjectHash: (email) =>
      createHmac("sha256", key).update(email).digest("hex"),
    readConsent: async () => ({
      state: "subscribed",
      events: [{ type: "opt_in_confirmed", at: "2026-10-15T12:00:00Z" }],
    }),
  });
  const assets = new Map([
    ["/", ["index.html", "text/html"]],
    ["/admin.css", ["admin.css", "text/css"]],
    ["/admin.js", ["admin.js", "text/javascript"]],
  ]);
  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        ...privateHeaders,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(body));
    };
    const expected = `127.0.0.1:${req.socket.localPort}`;
    if (
      req.headers.host !== expected ||
      (req.headers.origin && req.headers.origin !== `http://${expected}`) ||
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return denyAdmin(req, res);
    if (req.url.startsWith("/internal/") || req.url.startsWith("/admin/"))
      return denyAdmin(req, res);
    try {
      const asset = assets.get(req.url);
      if (req.method === "GET" && asset) {
        res.writeHead(200, {
          ...privateHeaders,
          "Content-Type": asset[1] + "; charset=utf-8",
        });
        res.end(await readFile(new URL("../ui/" + asset[0], import.meta.url)));
        return;
      }
      if (
        req.method !== "POST" ||
        !["/fixture/list", "/fixture/detail"].includes(req.url)
      )
        return denyAdmin(req, res);
      if (req.headers["content-type"] !== "application/json")
        return send(400, { ok: false });
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 1024) return send(413, { ok: false });
      }
      const input = JSON.parse(body);
      send(
        200,
        req.url === "/fixture/list"
          ? await service.list(input)
          : await service.detail(input.handle),
      );
    } catch {
      send(400, { ok: false, error: "invalid_request" });
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createPreview();
  server.listen(4179, "127.0.0.1");
}
