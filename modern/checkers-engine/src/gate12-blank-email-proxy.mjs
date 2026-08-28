import { createServer, request as httpRequest, get as httpGet } from "node:http";
import pg from "pg";

const { Pool } = pg;
const DRILLDOWN_PATH = "/__g12b_20260829_77070c02e822ae430907a2fa9e154550536eb4f332045c0b";
const publicPort = Number(process.env.PORT || 10000);
const internalPort = publicPort < 65535 ? publicPort + 1 : publicPort - 1;
const publicHost = process.env.HOST || "0.0.0.0";

process.env.PORT = String(internalPort);
process.env.HOST = "127.0.0.1";

await import("./main.js");
await waitForInternalHealth();

const proxyServer = createServer(async (request, response) => {
  if (request.method === "GET" && new URL(request.url, "http://localhost").pathname === DRILLDOWN_PATH) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      response.writeHead(200);
      response.end(JSON.stringify(await collectBlankEmailCandidate()));
    } catch (error) {
      response.writeHead(500);
      response.end(JSON.stringify({
        test: "gate12-blank-email-drilldown-v1",
        readOnly: false,
        status: "ERROR",
        errorCode: String(error?.code || "GATE12_DRILLDOWN_ERROR").slice(0, 80),
      }));
    }
    return;
  }

  const upstream = httpRequest({
    host: "127.0.0.1",
    port: internalPort,
    method: request.method,
    path: request.url,
    headers: request.headers,
  }, upstreamResponse => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    if (!response.writableEnded) response.end(JSON.stringify({ error: { code: "UPSTREAM_UNAVAILABLE" } }));
  });
  request.pipe(upstream);
});

proxyServer.listen(publicPort, publicHost, () => {
  console.log("[preflight.gate12] temporary blank-email read-only drilldown active");
});

async function waitForInternalHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ok = await new Promise(resolve => {
      const req = httpGet({ host: "127.0.0.1", port: internalPort, path: "/health", timeout: 500 }, res => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Internal application did not become ready.");
}

async function collectBlankEmailCandidate() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) throw Object.assign(new Error("DATABASE_URL missing"), { code: "DATABASE_URL_MISSING" });
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  let begun = false;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    begun = true;
    const meta = (await client.query(`SELECT now() AS captured_at, current_database() AS database_name`)).rows[0];
    const rows = (await client.query(`
      WITH quarantine(user_id) AS (
        VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
      )
      SELECT
        a.user_id,
        a.created_at,
        a.contact_verified,
        a.verification_channel,
        a.account_role,
        a.mfa_required,
        a.password_hash_version,
        (SELECT COUNT(*) FROM public.gracz_auth_sessions s WHERE s.user_id=a.user_id) AS session_rows,
        (SELECT COUNT(*) FROM public.gracz_auth_sessions s WHERE s.user_id=a.user_id AND s.revoked_at IS NULL AND s.expires_at>NOW()) AS active_session_rows,
        (SELECT COUNT(*) FROM public.gracz_messages m WHERE m.sender_id=a.user_id) AS private_messages_sent,
        (SELECT COUNT(*) FROM public.gracz_messages m WHERE m.recipient_id=a.user_id) AS private_messages_received,
        (SELECT COUNT(*) FROM public.gracz_audit_log x WHERE x.actor_id=a.user_id OR x.target_id=a.user_id) AS audit_rows,
        (SELECT COUNT(*) FROM public.gracz_password_reset_tokens r WHERE r.user_id=a.user_id) AS reset_rows,
        (SELECT COUNT(*) FROM public.gracz_registration_codes r WHERE r.user_id=a.user_id) AS registration_rows,
        (SELECT COUNT(*) FROM public.gracz_roles r WHERE r.user_id=a.user_id) AS role_rows,
        (SELECT COUNT(*) FROM public.gracz_mfa m WHERE m.user_id=a.user_id) AS mfa_rows,
        (SELECT COUNT(*) FROM public.gracz_tournament_players p WHERE p.user_id=a.user_id) AS tournament_rows,
        (SELECT COUNT(*) FROM public.gracz_global_chat c WHERE c.user_id=a.user_id) AS global_chat_rows,
        (SELECT COUNT(*) FROM public.gracz_chat_friends f WHERE f.requester_id=a.user_id OR f.addressee_id=a.user_id) AS friendship_rows
      FROM public.gracz_accounts a
      LEFT JOIN quarantine q USING(user_id)
      WHERE q.user_id IS NULL
        AND (a.email IS NULL OR btrim(a.email)='')
      ORDER BY a.created_at, a.user_id
    `)).rows;
    await client.query("ROLLBACK");
    begun = false;
    return {
      test: "gate12-blank-email-drilldown-v1",
      readOnly: true,
      status: rows.length === 1 ? "PASS-COLLECTOR" : "REVIEW",
      meta,
      blankEmailCandidateCount: rows.length,
      candidates: rows,
    };
  } finally {
    if (begun) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    client.release();
    await pool.end();
  }
}
