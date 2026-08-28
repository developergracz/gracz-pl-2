import { createServer, request as httpRequest, get as httpGet } from "node:http";
import pg from "pg";

const { Pool } = pg;
const GATE12_PATH = "/__g12r_20260829_7d4a3e85b64f4f7aa69cfcb2f41d9d13";
const publicPort = Number(process.env.PORT || 10000);
const internalPort = publicPort < 65535 ? publicPort + 1 : publicPort - 1;
const publicHost = process.env.HOST || "0.0.0.0";

process.env.PORT = String(internalPort);
process.env.HOST = "127.0.0.1";

await import("./main.js");
await waitForInternalHealth();

const proxyServer = createServer(async (request, response) => {
  if (request.method === "GET" && new URL(request.url, "http://localhost").pathname === GATE12_PATH) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      const result = await collectGate12Reconciliation();
      response.writeHead(200);
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500);
      response.end(JSON.stringify({
        test: "gate12-reconciliation-runtime-v1",
        readOnly: false,
        status: "ERROR",
        errorCode: String(error?.code || "GATE12_RECONCILIATION_ERROR").slice(0, 80),
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
  console.log("[preflight.gate12.reconcile] temporary read-only proxy active");
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

async function collectGate12Reconciliation() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) throw Object.assign(new Error("DATABASE_URL missing"), { code: "DATABASE_URL_MISSING" });

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  let begun = false;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    begun = true;

    const meta = (await client.query(`SELECT now() AS captured_at, current_database() AS database_name, current_user, current_setting('server_version') AS server_version`)).rows[0];

    const result = (await client.query(`
      WITH quarantine(user_id) AS (
        VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer'),('gracz')
      ),
      accounts AS (
        SELECT a.*, q.user_id IS NOT NULL AS is_quarantine
        FROM public.gracz_accounts a
        LEFT JOIN quarantine q USING(user_id)
      ),
      candidates AS (
        SELECT * FROM accounts WHERE NOT is_quarantine
      ),
      username_groups AS (
        SELECT lower(trim(user_id)) AS k, COUNT(*) AS c
        FROM candidates
        GROUP BY lower(trim(user_id))
      ),
      email_groups AS (
        SELECT lower(trim(email)) AS k, COUNT(*) AS c
        FROM candidates
        WHERE email IS NOT NULL AND btrim(email) <> ''
        GROUP BY lower(trim(email))
      )
      SELECT
        (SELECT COUNT(*) FROM accounts) AS accounts_total,
        (SELECT COUNT(*) FROM accounts WHERE is_quarantine) AS quarantine_present,
        (SELECT COUNT(*) FROM candidates) AS canonical_candidates,
        (SELECT COUNT(*) FROM candidates WHERE user_id IS NULL OR btrim(user_id)='' OR user_id !~ '^[a-z0-9._-]{3,32}$' OR user_id <> lower(user_id)) AS invalid_or_noncanonical_user_id,
        (SELECT COUNT(*) FROM username_groups WHERE c > 1) AS normalized_username_collision_groups,
        (SELECT COUNT(*) FROM email_groups WHERE c > 1) AS normalized_email_collision_groups,
        (SELECT COUNT(*) FROM candidates WHERE email IS NULL OR btrim(email)='') AS candidate_blank_email,
        (SELECT COUNT(*) FROM candidates WHERE password_hash_version NOT IN (1,2) OR password_hash_version IS NULL) AS unsupported_hash_version,
        (SELECT COUNT(*) FROM candidates WHERE salt IS NULL OR octet_length(salt)<>16) AS invalid_salt_shape,
        (SELECT COUNT(*) FROM candidates WHERE password_hash IS NULL OR octet_length(password_hash)<>64) AS invalid_hash_shape,
        (SELECT COUNT(*) FROM public.gracz_auth_sessions s JOIN candidates c ON c.user_id=s.user_id WHERE s.revoked_at IS NULL AND s.expires_at>NOW()) AS candidate_sessions_active_now,
        (SELECT COUNT(*) FROM public.gracz_password_reset_tokens r JOIN candidates c ON c.user_id=r.user_id WHERE r.used_at IS NULL AND r.expires_at>NOW()) AS candidate_reset_tokens_active_now,
        (SELECT COUNT(*) FROM public.gracz_registration_codes r JOIN candidates c ON c.user_id=r.user_id WHERE r.expires_at>NOW() AND r.attempts<5) AS candidate_registration_codes_active_now,
        (SELECT COUNT(*) FROM public.gracz_mfa m JOIN candidates c ON c.user_id=m.user_id) AS candidate_mfa_rows,
        (SELECT COUNT(*) FROM public.gracz_roles r JOIN candidates c ON c.user_id=r.user_id WHERE r.role NOT IN ('player','moderator','administrator','owner')) AS unknown_role_values,
        ((SELECT COUNT(*) FROM accounts WHERE is_quarantine) + (SELECT COUNT(*) FROM candidates)) AS mapping_total
    `)).rows[0];

    const pass = [
      result.accounts_total === '11',
      result.quarantine_present === '6',
      result.canonical_candidates === '5',
      result.invalid_or_noncanonical_user_id === '0',
      result.normalized_username_collision_groups === '0',
      result.normalized_email_collision_groups === '0',
      result.candidate_blank_email === '0',
      result.unsupported_hash_version === '0',
      result.invalid_salt_shape === '0',
      result.invalid_hash_shape === '0',
      result.candidate_sessions_active_now === '0',
      result.candidate_reset_tokens_active_now === '0',
      result.candidate_registration_codes_active_now === '0',
      result.candidate_mfa_rows === '0',
      result.unknown_role_values === '0',
      result.mapping_total === result.accounts_total,
    ].every(Boolean);

    await client.query("ROLLBACK");
    begun = false;

    return {
      test: "gate12-reconciliation-runtime-v1",
      readOnly: true,
      status: pass ? "PASS" : "BLOCKED",
      meta,
      counts: result,
    };
  } finally {
    if (begun) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    client.release();
    await pool.end();
  }
}
