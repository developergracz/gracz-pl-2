import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

const TOKEN_VERSION = "v1";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 12_000;
const MAX_REPLY_MESSAGE = 5_000;
const MAX_USED_TOKENS = 2_000;

export function createPremiumReplyManager({
  secret,
  baseUrl = "https://gracz.pl/kontakt/odpowiedz/",
  ownerAddress,
}) {
  const normalizedSecret = String(secret || "").trim();
  const enabled = normalizedSecret.length >= 32;
  const key = enabled
    ? createHash("sha256").update(normalizedSecret, "utf8").digest()
    : null;
  const usedTokens = new Map();

  if (normalizedSecret && !enabled) {
    throw new Error("CONTACT_REPLY_SECRET must contain at least 32 characters");
  }

  function createAdminDelivery(payload, requestId) {
    const token = enabled
      ? encrypt({
          v: 1,
          jti: randomUUID(),
          exp: Date.now() + TOKEN_TTL_MS,
          requestId,
          email: payload.email,
          name: payload.name,
          category: payload.category,
          subject: payload.subject,
          excerpt: payload.message.slice(0, 1200),
        })
      : null;

    const replyUrl = token ? baseUrl + "#token=" + token : null;
    const text = [
      "Nowa wiadomość z formularza kontaktowego gracz.pl",
      "",
      "Imię i nazwisko: " + payload.name,
      "E-mail nadawcy: " + payload.email,
      "Kategoria: " + payload.category,
      "Temat: " + payload.subject,
      "Strona źródłowa: " + payload.page,
      "",
      "Wiadomość:",
      payload.message,
      "",
      "ID zgłoszenia: " + requestId,
      replyUrl ? "" : null,
      replyUrl ? "Odpowiedz przez gracz.pl:" : null,
      replyUrl ? replyUrl : null,
    ]
      .filter((line) => line !== null)
      .join("\n");

    return {
      text,
      html: buildAdminHtml({ payload, requestId, replyUrl }),
      replyUrl,
    };
  }

  function getPublicContext(token) {
    const data = decrypt(token);
    return {
      requestId: data.requestId,
      recipient: maskEmail(data.email),
      name: data.name,
      category: data.category,
      subject: data.subject,
      excerpt: data.excerpt,
      expiresAt: new Date(data.exp).toISOString(),
    };
  }

  function prepareReply(token, message) {
    cleanupUsedTokens();
    const data = decrypt(token);
    const cleanMessage = validateReplyMessage(message);
    const tokenKey = createHash("sha256").update(data.jti).digest("hex");

    if (usedTokens.has(tokenKey)) {
      const error = new Error("Ta odpowiedź została już wysłana.");
      error.code = "REPLY_TOKEN_USED";
      error.status = 409;
      throw error;
    }

    if (usedTokens.size >= MAX_USED_TOKENS) {
      const oldestKey = usedTokens.keys().next().value;
      if (oldestKey !== undefined) usedTokens.delete(oldestKey);
    }

    usedTokens.set(tokenKey, {
      state: "inflight",
      expiresAt: data.exp,
    });

    return {
      tokenKey,
      jti: data.jti,
      requestId: data.requestId,
      to: data.email,
      replyTo: ownerAddress,
      subject: "Odp: gracz.pl — " + data.subject,
      text: buildReplyText(data, cleanMessage),
      html: buildReplyHtml(data, cleanMessage),
    };
  }

  function markReplySent(tokenKey) {
    const current = usedTokens.get(tokenKey);
    if (current) current.state = "done";
  }

  function releaseReply(tokenKey) {
    const current = usedTokens.get(tokenKey);
    if (current?.state === "inflight") usedTokens.delete(tokenKey);
  }

  function providerIdempotencyKey(jti) {
    return "contact-reply/" + createHash("sha256").update(jti).digest("hex").slice(0, 40);
  }

  function encrypt(payload) {
    if (!enabled) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      TOKEN_VERSION,
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  function decrypt(token) {
    if (!enabled) {
      const error = new Error("Moduł odpowiedzi premium nie jest skonfigurowany.");
      error.code = "REPLY_NOT_CONFIGURED";
      error.status = 503;
      throw error;
    }

    const value = String(token || "").trim();
    if (!value || value.length > MAX_TOKEN_LENGTH) {
      invalidToken();
    }

    const parts = value.split(".");
    if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
      invalidToken();
    }

    try {
      const iv = Buffer.from(parts[1], "base64url");
      const tag = Buffer.from(parts[2], "base64url");
      const ciphertext = Buffer.from(parts[3], "base64url");
      if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 16) {
        invalidToken();
      }

      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
      const data = JSON.parse(plaintext);
      validateTokenPayload(data);
      return data;
    } catch (error) {
      if (error?.code === "REPLY_TOKEN_EXPIRED") throw error;
      invalidToken();
    }
  }

  function cleanupUsedTokens() {
    const now = Date.now();
    for (const [tokenKey, entry] of usedTokens) {
      if (entry.expiresAt <= now) usedTokens.delete(tokenKey);
    }
  }

  return {
    enabled,
    createAdminDelivery,
    getPublicContext,
    prepareReply,
    markReplySent,
    releaseReply,
    providerIdempotencyKey,
  };
}

function validateTokenPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) invalidToken();
  if (data.v !== 1) invalidToken();
  if (!isShortString(data.jti, 80)) invalidToken();
  if (!isShortString(data.requestId, 80)) invalidToken();
  if (!isValidMailbox(data.email)) invalidToken();
  if (!isShortString(data.name, 80)) invalidToken();
  if (!isShortString(data.category, 60)) invalidToken();
  if (!isShortString(data.subject, 120)) invalidToken();
  if (typeof data.excerpt !== "string" || data.excerpt.length > 1200) invalidToken();
  if (!Number.isFinite(data.exp)) invalidToken();

  if (data.exp <= Date.now()) {
    const error = new Error("Link do odpowiedzi wygasł.");
    error.code = "REPLY_TOKEN_EXPIRED";
    error.status = 410;
    throw error;
  }

  if (data.exp - Date.now() > TOKEN_TTL_MS + 60_000) invalidToken();
}

function validateReplyMessage(value) {
  if (typeof value !== "string") {
    const error = new Error("Nieprawidłowa treść odpowiedzi.");
    error.code = "INVALID_REPLY_MESSAGE";
    error.status = 400;
    throw error;
  }

  const message = value.replace(/\r\n?/g, "\n").trim();
  if (message.length < 2 || message.length > MAX_REPLY_MESSAGE) {
    const error = new Error(
      "Odpowiedź musi mieć od 2 do " + MAX_REPLY_MESSAGE + " znaków."
    );
    error.code = "INVALID_REPLY_MESSAGE";
    error.status = 400;
    throw error;
  }

  return message;
}

function invalidToken() {
  const error = new Error("Link do odpowiedzi jest nieprawidłowy.");
  error.code = "INVALID_REPLY_TOKEN";
  error.status = 400;
  throw error;
}

function isShortString(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isValidMailbox(value) {
  if (!isShortString(value, 254)) return false;
  if (value.includes("\r") || value.includes("\n")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  if (!local || !domain) return "ukryty adres";
  const shown = local.slice(0, 1);
  return shown + "***@" + domain;
}

function buildReplyText(data, message) {
  return [
    "gracz.pl — odpowiedź na Twoją wiadomość",
    "",
    message,
    "",
    "Dotyczy zgłoszenia:",
    data.subject,
    "ID zgłoszenia: " + data.requestId,
    "",
    "Twoja wcześniejsza wiadomość:",
    data.excerpt || "(brak podglądu)",
    "",
    "Pozdrawiamy",
    "gracz.pl",
    "Gry. Wiedza. Społeczność.",
    "",
    "https://gracz.pl/",
    "Polityka prywatności: https://gracz.pl/polityka-prywatnosci/",
    "Regulamin: https://gracz.pl/regulamin/",
  ].join("\n");
}

function buildAdminHtml({ payload, requestId, replyUrl }) {
  const button = replyUrl
    ? `<tr><td style="padding:22px 32px 8px"><a href="${escapeAttribute(replyUrl)}" style="display:inline-block;background:#16d4c2;color:#041216;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Odpowiedz przez gracz.pl →</a></td></tr>
<tr><td style="padding:0 32px 18px;color:#8ca5ad;font-size:12px;line-height:1.5">Bezpieczny link jest ważny 7 dni i prowadzi do panelu odpowiedzi gracz.pl.</td></tr>`
    : `<tr><td style="padding:18px 32px;color:#f0b95a;font-size:13px">Moduł odpowiedzi premium nie jest jeszcze aktywny.</td></tr>`;

  return `<!doctype html>
<html lang="pl"><body style="margin:0;background:#061218;font-family:Arial,Helvetica,sans-serif;color:#eaf7f8">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#061218;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#0b1e25;border:1px solid #173943;border-radius:18px;overflow:hidden">
<tr><td style="padding:26px 32px;background:#07171d;border-bottom:1px solid #173943">
<div style="font-size:28px;font-weight:900;letter-spacing:-1px">gracz<span style="color:#f0505d">.pl</span></div>
<div style="margin-top:6px;color:#7ca0a8;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Kontakt · nowe zgłoszenie</div>
</td></tr>
<tr><td style="padding:28px 32px 12px">
<div style="display:inline-block;background:#12313a;color:#63e6d6;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700">${escapeHtml(payload.category)}</div>
<h1 style="margin:14px 0 6px;font-size:24px;line-height:1.25;color:#ffffff">${escapeHtml(payload.subject)}</h1>
<div style="color:#8ca5ad;font-size:13px">ID: ${escapeHtml(requestId)}</div>
</td></tr>
<tr><td style="padding:12px 32px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f2931;border-radius:12px">
<tr><td style="padding:18px;color:#b9ced2;font-size:14px;line-height:1.7">
<strong style="color:#ffffff">${escapeHtml(payload.name)}</strong><br>
<a href="mailto:${escapeAttribute(payload.email)}" style="color:#63e6d6">${escapeHtml(payload.email)}</a><br>
<span style="color:#75939a">Źródło: ${escapeHtml(payload.page)}</span>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:10px 32px">
<div style="background:#08181e;border-left:3px solid #16d4c2;border-radius:8px;padding:18px;color:#dcebed;font-size:15px;line-height:1.7">${nl2br(payload.message)}</div>
</td></tr>
${button}
<tr><td style="padding:18px 32px 28px;border-top:1px solid #173943;color:#6f8b92;font-size:12px;line-height:1.6">
gracz.pl · panel kontaktowy<br>Nie odpowiadaj przez przekazywanie tego bezpiecznego linku osobom trzecim.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildReplyHtml(data, message) {
  return `<!doctype html>
<html lang="pl"><body style="margin:0;background:#061218;font-family:Arial,Helvetica,sans-serif;color:#eaf7f8">
<div style="display:none;max-height:0;overflow:hidden;color:transparent">Odpowiedź gracz.pl na Twoje zgłoszenie</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#061218;padding:26px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#0b1e25;border:1px solid #173943;border-radius:18px;overflow:hidden">
<tr><td style="padding:28px 34px;background:#07171d;border-bottom:1px solid #173943">
<div style="font-size:30px;font-weight:900;letter-spacing:-1px">gracz<span style="color:#f0505d">.pl</span></div>
<div style="margin-top:7px;color:#7ca0a8;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Gry · Wiedza · Społeczność</div>
</td></tr>
<tr><td style="padding:34px 34px 12px">
<div style="display:inline-block;background:#12313a;color:#63e6d6;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:800">ODPOWIEDŹ GRACZ.PL</div>
<h1 style="margin:16px 0 10px;color:#ffffff;font-size:28px;line-height:1.25">Dziękujemy za kontakt</h1>
<p style="margin:0;color:#9ab2b8;font-size:15px;line-height:1.7">Odpowiadamy na Twoje zgłoszenie dotyczące: <strong style="color:#dff6f3">${escapeHtml(data.subject)}</strong></p>
</td></tr>
<tr><td style="padding:18px 34px">
<div style="background:#0f2931;border:1px solid #1b4550;border-radius:14px;padding:22px;color:#eef9fa;font-size:16px;line-height:1.75">${nl2br(message)}</div>
</td></tr>
<tr><td style="padding:8px 34px 20px">
<div style="color:#8ca5ad;font-size:12px;line-height:1.6">Numer zgłoszenia: <strong style="color:#b7d8dc">${escapeHtml(data.requestId)}</strong></div>
</td></tr>
<tr><td style="padding:10px 34px 4px">
<div style="color:#6f8b92;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Twoja wcześniejsza wiadomość</div>
<div style="background:#08181e;border-left:3px solid #2b6570;border-radius:8px;padding:16px;color:#91aab0;font-size:13px;line-height:1.65">${nl2br(data.excerpt || "(brak podglądu)")}</div>
</td></tr>
<tr><td style="padding:26px 34px">
<a href="https://gracz.pl/" style="display:inline-block;background:#16d4c2;color:#041216;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Przejdź do gracz.pl →</a>
</td></tr>
<tr><td style="padding:22px 34px 30px;border-top:1px solid #173943">
<div style="color:#d8e8ea;font-size:14px;font-weight:700">Pozdrawiamy<br>gracz.pl</div>
<div style="margin-top:14px;color:#708b92;font-size:11px;line-height:1.7">
Otrzymujesz tę wiadomość, ponieważ wcześniej skontaktowałeś się z gracz.pl przez formularz kontaktowy.<br>
<a href="https://gracz.pl/polityka-prywatnosci/" style="color:#69cfc4">Polityka prywatności</a> ·
<a href="https://gracz.pl/regulamin/" style="color:#69cfc4">Regulamin</a>
</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
