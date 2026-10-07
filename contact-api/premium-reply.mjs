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
  newsletterUrl = "",
  tokenStore = null,
  claimLeaseMs = 30_000,
}) {
  const normalizedSecret = String(secret || "").trim();
  const secretConfigured = normalizedSecret.length >= 32;
  const storeConfigured = Boolean(
    tokenStore &&
      typeof tokenStore.issue === "function" &&
      typeof tokenStore.claim === "function" &&
      typeof tokenStore.markUsed === "function" &&
      typeof tokenStore.release === "function"
  );
  const enabled = secretConfigured && storeConfigured;
  const key = secretConfigured
    ? createHash("sha256").update(normalizedSecret, "utf8").digest()
    : null;
  const normalizedClaimLeaseMs = Math.max(
    5_000,
    Math.min(120_000, Number(claimLeaseMs) || 30_000)
  );

  if (normalizedSecret && !secretConfigured) {
    throw new Error("CONTACT_REPLY_SECRET must contain at least 32 characters");
  }

  async function createAdminDelivery(payload, requestId) {
    let token = null;

    if (enabled) {
      let issued = false;

      for (let attempt = 0; attempt < 3 && !issued; attempt += 1) {
        const data = {
          v: 1,
          jti: randomUUID(),
          exp: Date.now() + TOKEN_TTL_MS,
          requestId,
          email: payload.email,
          name: payload.name,
          category: payload.category,
          subject: payload.subject,
          excerpt: payload.message.slice(0, 1200),
        };
        const tokenKey = hashTokenJti(data.jti);
        const idempotencyKey = providerIdempotencyKey(data.jti);

        issued = await tokenStore.issue({
          jtiHash: tokenKey,
          requestId,
          expiresAt: new Date(data.exp),
          providerIdempotencyKey: idempotencyKey,
        });

        if (issued) token = encrypt(data);
      }

      if (!token) {
        const error = new Error(
          "Nie udało się bezpiecznie utworzyć linku odpowiedzi."
        );
        error.code = "REPLY_TOKEN_ISSUE_FAILED";
        error.status = 503;
        throw error;
      }
    }

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
      html: buildAdminHtml({ payload, requestId, replyUrl, newsletterUrl }),
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

  async function prepareReply(token, message) {
    if (!enabled) {
      const error = new Error(
        "Moduł odpowiedzi premium nie ma aktywnego trwałego magazynu stanu."
      );
      error.code = "REPLY_NOT_CONFIGURED";
      error.status = 503;
      throw error;
    }

    const data = decrypt(token);
    const cleanMessage = validateReplyMessage(message);
    const tokenKey = hashTokenJti(data.jti);
    const messageHash = createHash("sha256")
      .update(cleanMessage, "utf8")
      .digest("hex");

    const claim = await tokenStore.claim(tokenKey, messageHash, {
      leaseMs: normalizedClaimLeaseMs,
    });

    if (!claim?.claimed) {
      rejectUnavailableClaim(claim);
    }

    return {
      tokenKey,
      messageHash,
      jti: data.jti,
      requestId: data.requestId,
      to: data.email,
      replyTo: ownerAddress,
      subject: "♦️ Odp: gracz.pl — " + data.subject,
      text: buildReplyText(data, cleanMessage),
      html: buildReplyHtml(data, cleanMessage, newsletterUrl),
      providerIdempotencyKey:
        claim.token?.provider_idempotency_key ||
        providerIdempotencyKey(data.jti),
    };
  }

  async function markReplySent(tokenKey, messageHash, providerMessageId = null) {
    const committed = await tokenStore.markUsed(
      tokenKey,
      messageHash,
      providerMessageId
    );

    if (!committed) {
      const error = new Error(
        "Wysłano wiadomość, ale nie udało się zatwierdzić trwałego stanu odpowiedzi."
      );
      error.code = "REPLY_STATE_COMMIT_FAILED";
      error.status = 503;
      throw error;
    }
  }

  async function releaseReply(tokenKey, messageHash, errorCode = null) {
    if (!enabled) return null;
    return tokenStore.release(tokenKey, messageHash, errorCode);
  }

  function providerIdempotencyKey(jti) {
    return (
      "contact-reply/" +
      createHash("sha256").update(String(jti), "utf8").digest("hex").slice(0, 40)
    );
  }

  function hashTokenJti(jti) {
    return createHash("sha256").update(String(jti), "utf8").digest("hex");
  }

  function encrypt(payload) {
    if (!secretConfigured) return null;
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
    if (!secretConfigured) {
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
      const iv = decodeCanonicalBase64Url(parts[1]);
      const tag = decodeCanonicalBase64Url(parts[2]);
      const ciphertext = decodeCanonicalBase64Url(parts[3]);
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

  return {
    enabled,
    secretConfigured,
    durableStateConfigured: storeConfigured,
    createAdminDelivery,
    getPublicContext,
    prepareReply,
    markReplySent,
    releaseReply,
    providerIdempotencyKey,
  };
}

function rejectUnavailableClaim(claim) {
  const state = claim?.token?.state;

  if (state === "used") {
    const error = new Error("Ta odpowiedź została już wysłana.");
    error.code = "REPLY_TOKEN_USED";
    error.status = 409;
    throw error;
  }

  if (state === "expired") {
    const error = new Error("Link do odpowiedzi wygasł.");
    error.code = "REPLY_TOKEN_EXPIRED";
    error.status = 410;
    throw error;
  }

  if (claim?.messageConflict) {
    const error = new Error(
      "Po rozpoczęciu wysyłki treść odpowiedzi jest zablokowana. Ponów wysyłkę tej samej wiadomości."
    );
    error.code = "REPLY_TOKEN_MESSAGE_CONFLICT";
    error.status = 409;
    throw error;
  }

  if (state === "inflight") {
    const error = new Error(
      "Wysyłka tej odpowiedzi już trwa. Spróbuj ponownie za chwilę."
    );
    error.code = "REPLY_TOKEN_IN_PROGRESS";
    error.status = 409;
    throw error;
  }

  if (!claim?.token) {
    const error = new Error(
      "Ten link nie ma aktywnego rekordu trwałego stanu i nie może zostać użyty."
    );
    error.code = "REPLY_TOKEN_NOT_ISSUED";
    error.status = 410;
    throw error;
  }

  const error = new Error(
    "Nie udało się bezpiecznie zarezerwować tej odpowiedzi."
  );
  error.code = "REPLY_STATE_UNAVAILABLE";
  error.status = 503;
  throw error;
}

function decodeCanonicalBase64Url(value) {
  if (
    typeof value !== "string" ||
    !value ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    invalidToken();
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    invalidToken();
  }
  return decoded;
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

function buildAdminHtml({ payload, requestId, replyUrl, newsletterUrl }) {
  const button = replyUrl
    ? `<tr><td style="padding:22px 32px 8px"><a href="${escapeAttribute(replyUrl)}" style="display:inline-block;background:#16d4c2;color:#041216;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Odpowiedz przez gracz.pl →</a></td></tr>
<tr><td style="padding:0 32px 18px;color:#8ca5ad;font-size:12px;line-height:1.5">Bezpieczny link jest ważny 7 dni i prowadzi do panelu odpowiedzi ${brandLogoHtml({ compact: true, onDark: true })}.</td></tr>`
    : `<tr><td style="padding:18px 32px;color:#f0b95a;font-size:13px">Moduł odpowiedzi premium nie jest jeszcze aktywny.</td></tr>`;

  return `<!doctype html>
<html lang="pl"><body style="margin:0;background:#061218;font-family:Arial,Helvetica,sans-serif;color:#eaf7f8">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#061218;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#0b1e25;border:1px solid #173943;border-radius:18px;overflow:hidden">
<tr><td style="padding:26px 32px;background:#07171d;border-bottom:1px solid #173943">
<div style="font-size:28px;font-weight:900;letter-spacing:-1px">gracz<span style="color:#f0505d">.pl</span></div>
<div style="margin-top:6px;color:#7ca0a8;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Centrum Obsługi Użytkownika · FULL MAX PREMIUM</div>
</td></tr>
<tr><td style="background:#f4faf9;border-bottom:1px solid #dce9e6">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td style="padding:13px 16px;font-size:11px;color:#718883">Numer sprawy<strong style="display:block;padding-top:4px;color:#16342f;font-size:12px">${escapeHtml(requestId)}</strong></td>
<td style="padding:13px 16px;font-size:11px;color:#718883">Status<strong style="display:block;padding-top:4px;color:#0d665c;font-size:12px">NOWE</strong></td>
<td style="padding:13px 16px;font-size:11px;color:#718883">Priorytet<strong style="display:block;padding-top:4px;color:#915a09;font-size:12px">STANDARD</strong></td>
<td style="padding:13px 16px;font-size:11px;color:#718883">Kanał<strong style="display:block;padding-top:4px;color:#16342f;font-size:12px">${brandifyEmailText("Formularz gracz.pl")}</strong></td>
</tr></table>
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
<tr><td style="padding:10px 32px 24px">${buildNewsletterEmailSection(newsletterUrl)}</td></tr>
<tr><td style="padding:18px 32px 28px;border-top:1px solid #173943;color:#6f8b92;font-size:12px;line-height:1.6">
${brandLogoHtml({ compact: true, onDark: true })} · panel kontaktowy<br>Nie odpowiadaj przez przekazywanie tego bezpiecznego linku osobom trzecim.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildReplyHtml(data, message, newsletterUrl) {
  return `<!doctype html>
<html lang="pl"><body style="margin:0;background:#061218;font-family:Arial,Helvetica,sans-serif;color:#eaf7f8">
<div style="display:none;max-height:0;overflow:hidden;color:transparent">Odpowiedź gracz.pl na Twoje zgłoszenie</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#061218;padding:26px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#0b1e25;border:1px solid #173943;border-radius:18px;overflow:hidden">
<tr><td style="padding:28px 34px;background:#07171d;border-bottom:1px solid #173943">
<div style="font-size:30px;font-weight:900;letter-spacing:-1px">gracz<span style="color:#f0505d">.pl</span></div>
<div style="margin-top:7px;color:#7ca0a8;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Centrum Obsługi Użytkownika · FULL MAX PREMIUM</div>
</td></tr>
<tr><td style="background:#f4faf9;border-bottom:1px solid #dce9e6">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td style="padding:13px 16px;font-size:11px;color:#718883">Numer sprawy<strong style="display:block;padding-top:4px;color:#16342f;font-size:12px">${escapeHtml(data.requestId)}</strong></td>
<td style="padding:13px 16px;font-size:11px;color:#718883">Status<strong style="display:block;padding-top:4px;color:#0d665c;font-size:12px">ODPOWIEDŹ UDZIELONA</strong></td>
<td style="padding:13px 16px;font-size:11px;color:#718883">Priorytet<strong style="display:block;padding-top:4px;color:#915a09;font-size:12px">STANDARD</strong></td>
<td style="padding:13px 16px;font-size:11px;color:#718883">Obsługa<strong style="display:block;padding-top:4px;color:#16342f;font-size:12px">${brandifyEmailText("Zespół gracz.pl")}</strong></td>
</tr></table>
</td></tr>
<tr><td style="padding:34px 34px 12px">
<div style="display:inline-block;background:#12313a;color:#63e6d6;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:800">ODPOWIEDŹ ${brandLogoHtml({ compact: true, onDark: true })}</div>
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
<tr><td style="padding:8px 34px 18px">${buildNewsletterEmailSection(newsletterUrl)}</td></tr>
<tr><td style="padding:26px 34px">
<a href="https://gracz.pl/" style="display:inline-block;background:#16d4c2;color:#041216;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:10px">Przejdź do gracz.pl →</a>
</td></tr>
<tr><td style="padding:22px 34px 30px;border-top:1px solid #173943">
<div style="color:#d8e8ea;font-size:14px;font-weight:700">Pozdrawiamy<br>${brandLogoHtml({ onDark: true })}</div>
<div style="margin-top:14px;color:#708b92;font-size:11px;line-height:1.7">
Otrzymujesz tę wiadomość, ponieważ wcześniej skontaktowałeś się z ${brandLogoHtml({ compact: true, onDark: true })} przez formularz kontaktowy.<br>
<a href="https://gracz.pl/polityka-prywatnosci/" style="color:#69cfc4">Polityka prywatności</a> ·
<a href="https://gracz.pl/regulamin/" style="color:#69cfc4">Regulamin</a>
</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildNewsletterEmailSection(newsletterUrl) {
  const url = normalizeNewsletterUrl(newsletterUrl);
  const action = url
    ? '<div style="padding-top:14px"><a href="' + escapeAttribute(url) + '" style="display:inline-block;background:#56c8c1;color:#08312b;text-decoration:none;padding:12px 17px;border-radius:9px;font-size:13px;font-weight:800">Zapisz się do newslettera gracz.pl</a></div><div style="padding-top:7px;color:#718a85;font-size:11px;line-height:1.5">Zapis prowadzi do osobnego procesu double opt-in.</div>'
    : '<div style="padding-top:14px"><span style="display:inline-block;background:#ffffff;border:1px solid #d5e8e4;color:#0f6d62;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:800">ZAPISY — MODUŁ W PRZYGOTOWANIU</span></div><div style="padding-top:7px;color:#718a85;font-size:11px;line-height:1.5">Newsletter jest dobrowolny. Aktywny zapis pojawi się po uruchomieniu bezpiecznego double opt-in.</div>';

  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e9f8f6;border:1px solid #cfe9e4;border-radius:14px"><tr><td style="padding:18px 18px 8px"><div style="font-size:10px;font-weight:800;color:#2c8379;letter-spacing:.8px">NEWSLETTER ' + brandLogoHtml({ compact: true }) + '</div><div style="font-size:18px;font-weight:800;color:#0d5a52;padding-top:4px">Chcesz być bliżej ' + brandLogoHtml({ compact: true }) + '?</div><div style="font-size:13px;line-height:1.55;color:#496660;padding-top:6px">Nowe gry, poradniki i najważniejsze aktualizacje serwisu — bez zbędnego spamu.</div></td></tr><tr><td style="padding:8px 18px 4px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="33.33%" style="padding-right:4px;vertical-align:top"><div style="background:#fff;border:1px solid #dcebe8;border-radius:9px;padding:10px;font-size:11px;color:#3f5d57"><strong>Nowe gry</strong><br>Premiery i nowe moduły.</div></td><td width="33.33%" style="padding:0 4px;vertical-align:top"><div style="background:#fff;border:1px solid #dcebe8;border-radius:9px;padding:10px;font-size:11px;color:#3f5d57"><strong>Poradniki</strong><br>Materiały i Academy.</div></td><td width="33.33%" style="padding-left:4px;vertical-align:top"><div style="background:#fff;border:1px solid #dcebe8;border-radius:9px;padding:10px;font-size:11px;color:#3f5d57"><strong>Rozwój serwisu</strong><br>Ważne aktualizacje.</div></td></tr></table></td></tr><tr><td style="padding:8px 18px 18px">' + action + '</td></tr></table>';
}

function normalizeNewsletterUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function brandLogoHtml({ compact = false, onDark = false } = {}) {
  const fontSize = compact ? "11px" : "13px";
  const padding = onDark ? "0" : compact ? "2px 5px" : "3px 7px";
  const background = onDark ? "transparent" : "#071f1a";
  const radius = onDark ? "0" : "5px";
  return (
    '<span style="display:inline-block;vertical-align:baseline;background:' +
    background +
    ';border-radius:' +
    radius +
    ';padding:' +
    padding +
    ';font-size:' +
    fontSize +
    ';line-height:1;font-weight:900;letter-spacing:-.25px;white-space:nowrap">' +
    '<span style="color:#ffffff">gracz</span><span style="color:#f0505d">.pl</span></span>'
  );
}

function brandifyEmailText(value, { onDark = false } = {}) {
  return escapeHtml(value).replace(
    /gracz\.pl/gi,
    brandLogoHtml({ compact: true, onDark })
  );
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
