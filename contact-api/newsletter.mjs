import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

const TOKEN_VERSION = "n1";
const CONFIRM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UNSUBSCRIBE_TTL_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 12_000;

export function createNewsletterManager({
  secret,
  resendApiKey,
  resendApiBase = "https://api.resend.com",
  emailEndpoint = "https://api.resend.com/emails",
  emailFrom,
  replyTo,
  baseUrl = "https://gracz.pl/newsletter/",
  segmentName = "gracz.pl Newsletter",
  topicName = "Newsletter gracz.pl",
}) {
  const normalizedSecret = String(secret || "").trim();
  const apiKey = String(resendApiKey || "").trim();
  const normalizedBase = String(resendApiBase || "").replace(/\/$/, "");
  const normalizedEmailEndpoint = String(emailEndpoint || "").trim();
  const normalizedBaseUrl = ensureHttpsPageUrl(baseUrl);
  const enabled = normalizedSecret.length >= 32 && Boolean(apiKey && normalizedBaseUrl);
  const key = normalizedSecret.length >= 32
    ? createHash("sha256").update(normalizedSecret, "utf8").digest()
    : null;

  let resourcesPromise = null;

  if (normalizedSecret && normalizedSecret.length < 32) {
    throw new Error("NEWSLETTER_SECRET must contain at least 32 characters");
  }

  async function requestOptIn({ email, name = "", source = "newsletter_page" }) {
    requireEnabled();
    const cleanEmail = validateMailbox(email);
    const cleanName = cleanShort(name, 80);
    const tokenData = {
      v: 1,
      purpose: "confirm",
      jti: randomUUID(),
      exp: Date.now() + CONFIRM_TTL_MS,
      email: cleanEmail,
      name: cleanName,
      source: cleanShort(source, 40) || "unknown",
      consentVersion: "newsletter-r1-2026-10-07",
    };
    const token = encrypt(tokenData);
    const confirmUrl = normalizedBaseUrl + "#confirm=" + token;

    await sendEmail({
      to: cleanEmail,
      subject: "Potwierdź zapis do newslettera gracz.pl",
      text: buildConfirmText(confirmUrl),
      html: buildConfirmHtml(confirmUrl),
      idempotencyKey: "newsletter-confirm/" + hashShort(tokenData.jti),
    });

    return { state: "confirmation_sent" };
  }

  async function confirm(token) {
    requireEnabled();
    const data = decrypt(token, "confirm");
    const resources = await ensureResources();

    const existing = await getContact(data.email);
    const names = splitName(data.name);

    if (!existing) {
      await api("/contacts", {
        method: "POST",
        body: {
          email: data.email,
          first_name: names.firstName || undefined,
          last_name: names.lastName || undefined,
          unsubscribed: false,
          segments: [{ id: resources.segmentId }],
          topics: [{ id: resources.topicId, subscription: "opt_in" }],
        },
        expected: [201],
      });
    } else {
      await api("/contacts/" + encodeURIComponent(data.email), {
        method: "PATCH",
        body: {
          first_name: names.firstName || undefined,
          last_name: names.lastName || undefined,
          unsubscribed: false,
        },
        expected: [200],
      });

      await api(
        "/contacts/" + encodeURIComponent(data.email) +
          "/segments/" + encodeURIComponent(resources.segmentId),
        { method: "POST", expected: [200, 409] }
      );

      await api("/contacts/" + encodeURIComponent(data.email) + "/topics", {
        method: "PATCH",
        body: {
          topics: [{ id: resources.topicId, subscription: "opt_in" }],
        },
        expected: [200],
      });
    }

    const unsubscribeToken = encrypt({
      v: 1,
      purpose: "unsubscribe",
      jti: randomUUID(),
      exp: Date.now() + UNSUBSCRIBE_TTL_MS,
      email: data.email,
    });
    const unsubscribeUrl = normalizedBaseUrl + "#unsubscribe=" + unsubscribeToken;

    await sendEmail({
      to: data.email,
      subject: "Witamy w newsletterze gracz.pl",
      text: buildWelcomeText(unsubscribeUrl),
      html: buildWelcomeHtml(unsubscribeUrl),
      idempotencyKey: "newsletter-welcome/" + hashShort(data.jti),
    });

    return {
      state: "subscribed",
      recipient: maskEmail(data.email),
    };
  }

  async function unsubscribe(token) {
    requireEnabled();
    const data = decrypt(token, "unsubscribe");
    const resources = await ensureResources();
    const existing = await getContact(data.email);

    if (existing) {
      await api("/contacts/" + encodeURIComponent(data.email) + "/topics", {
        method: "PATCH",
        body: {
          topics: [{ id: resources.topicId, subscription: "opt_out" }],
        },
        expected: [200],
      });

      await api(
        "/contacts/" + encodeURIComponent(data.email) +
          "/segments/" + encodeURIComponent(resources.segmentId),
        { method: "DELETE", expected: [200, 404] }
      );
    }

    return {
      state: "unsubscribed",
      recipient: maskEmail(data.email),
    };
  }

  async function ensureResources() {
    if (!resourcesPromise) {
      resourcesPromise = (async () => {
        const [segmentId, topicId] = await Promise.all([
          ensureNamedResource({
            listPath: "/segments?limit=100",
            createPath: "/segments",
            name: segmentName,
            createBody: { name: segmentName },
          }),
          ensureNamedResource({
            listPath: "/topics?limit=100",
            createPath: "/topics",
            name: topicName,
            createBody: {
              name: topicName,
              default_subscription: "opt_out",
              description: "Dobrowolny newsletter gracz.pl: nowe gry, poradniki i rozwój serwisu.",
              visibility: "public",
            },
          }),
        ]);
        return { segmentId, topicId };
      })().catch((error) => {
        resourcesPromise = null;
        throw error;
      });
    }
    return resourcesPromise;
  }

  async function ensureNamedResource({ listPath, createPath, name, createBody }) {
    const listed = await api(listPath, { method: "GET", expected: [200] });
    const found = Array.isArray(listed?.data)
      ? listed.data.find((item) => item?.name === name && item?.id)
      : null;
    if (found) return found.id;

    try {
      const created = await api(createPath, {
        method: "POST",
        body: createBody,
        expected: [201],
      });
      if (!created?.id) throw providerError("NEWSLETTER_RESOURCE_INVALID");
      return created.id;
    } catch (error) {
      if (error?.status !== 409) throw error;
      const retry = await api(listPath, { method: "GET", expected: [200] });
      const retryFound = Array.isArray(retry?.data)
        ? retry.data.find((item) => item?.name === name && item?.id)
        : null;
      if (!retryFound) throw error;
      return retryFound.id;
    }
  }

  async function getContact(email) {
    try {
      return await api("/contacts/" + encodeURIComponent(email), {
        method: "GET",
        expected: [200],
      });
    } catch (error) {
      if (error?.status === 404) return null;
      throw error;
    }
  }

  async function sendEmail({ to, subject, text, html, idempotencyKey }) {
    const response = await fetch(normalizedEmailEndpoint, {
      method: "POST",
      headers: {
        authorization: "Bearer " + apiKey,
        "content-type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "User-Agent": "gracz.pl-newsletter/1.0",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [to],
        reply_to: replyTo,
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      throw providerError("NEWSLETTER_MAIL_FAILED", response.status, raw);
    }

    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  async function api(path, { method, body, expected }) {
    const response = await fetch(normalizedBase + path, {
      method,
      headers: {
        authorization: "Bearer " + apiKey,
        "content-type": "application/json",
        "User-Agent": "gracz.pl-newsletter/1.0",
      },
      body: body === undefined ? undefined : JSON.stringify(removeUndefined(body)),
      signal: AbortSignal.timeout(10_000),
    });

    const raw = await response.text().catch(() => "");
    if (!expected.includes(response.status)) {
      throw providerError("NEWSLETTER_PROVIDER_FAILED", response.status, raw);
    }
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function encrypt(payload) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      TOKEN_VERSION,
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  function decrypt(token, purpose) {
    requireEnabled();
    const value = String(token || "").trim();
    if (!value || value.length > MAX_TOKEN_LENGTH) invalidToken();

    const parts = value.split(".");
    if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) invalidToken();

    try {
      const iv = Buffer.from(parts[1], "base64url");
      const tag = Buffer.from(parts[2], "base64url");
      const ciphertext = Buffer.from(parts[3], "base64url");
      if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 16) {
        invalidToken();
      }
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const parsed = JSON.parse(
        Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
      );
      validateTokenPayload(parsed, purpose);
      return parsed;
    } catch (error) {
      if (error?.code === "NEWSLETTER_TOKEN_EXPIRED") throw error;
      invalidToken();
    }
  }

  function requireEnabled() {
    if (!enabled) {
      const error = new Error("Newsletter jest chwilowo niedostępny.");
      error.code = "NEWSLETTER_NOT_CONFIGURED";
      error.status = 503;
      throw error;
    }
  }

  return {
    enabled,
    requestOptIn,
    confirm,
    unsubscribe,
    baseUrl: normalizedBaseUrl,
  };
}

function validateTokenPayload(data, purpose) {
  if (!data || typeof data !== "object" || Array.isArray(data)) invalidToken();
  if (data.v !== 1 || data.purpose !== purpose) invalidToken();
  if (typeof data.jti !== "string" || data.jti.length < 8 || data.jti.length > 80) invalidToken();
  validateMailbox(data.email);
  if (!Number.isFinite(data.exp)) invalidToken();
  if (data.exp <= Date.now()) {
    const error = new Error("Link newslettera wygasł.");
    error.code = "NEWSLETTER_TOKEN_EXPIRED";
    error.status = 410;
    throw error;
  }
}

function validateMailbox(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 254 || email.includes("\r") || email.includes("\n")) {
    invalidEmail();
  }
  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@")) invalidEmail();
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)
  ) {
    invalidEmail();
  }
  return local + "@" + domain.toLowerCase();
}

function invalidEmail() {
  const error = new Error("Podaj prawidłowy adres e-mail.");
  error.code = "INVALID_EMAIL";
  error.status = 400;
  throw error;
}

function invalidToken() {
  const error = new Error("Link newslettera jest nieprawidłowy.");
  error.code = "INVALID_NEWSLETTER_TOKEN";
  error.status = 400;
  throw error;
}

function providerError(code, status = 502) {
  const error = new Error("Usługa newslettera jest chwilowo niedostępna.");
  error.code = code;
  error.status = Number.isInteger(status) ? status : 502;
  if (error.status < 400) error.status = 502;
  return error;
}

function cleanShort(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function splitName(value) {
  const parts = cleanShort(value, 80).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ").slice(0, 80),
  };
}

function ensureHttpsPageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function hashShort(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 40);
}

function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  return local && domain ? local.slice(0, 1) + "***@" + domain : "ukryty adres";
}

function removeUndefined(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [
        key,
        item && typeof item === "object" && !Array.isArray(item)
          ? removeUndefined(item)
          : item,
      ])
  );
}

function buildConfirmText(url) {
  return [
    "gracz.pl — potwierdzenie zapisu do newslettera",
    "",
    "Otrzymaliśmy prośbę o zapis do newslettera gracz.pl.",
    "Aby zakończyć zapis, otwórz poniższy link i kliknij przycisk potwierdzenia:",
    url,
    "",
    "Link jest ważny przez 30 dni.",
    "Jeśli to nie Ty inicjowałeś zapis, zignoruj tę wiadomość.",
  ].join("\n");
}

function buildConfirmHtml(url) {
  return emailShell({
    eyebrow: "DOUBLE OPT-IN",
    title: "Potwierdź zapis do newslettera",
    body:
      "Kliknij przycisk poniżej, a następnie potwierdź zapis na stronie gracz.pl. Bez tego kroku adres nie zostanie aktywowany w newsletterze.",
    buttonText: "Potwierdź zapis",
    buttonUrl: url,
    footer:
      "Link jest ważny przez 30 dni. Jeśli nie inicjowałeś zapisu, zignoruj tę wiadomość.",
  });
}

function buildWelcomeText(unsubscribeUrl) {
  return [
    "Witaj w newsletterze gracz.pl",
    "",
    "Twój adres został potwierdzony metodą double opt-in.",
    "Będziemy wysyłać informacje o nowych grach, poradnikach i rozwoju serwisu.",
    "",
    "Wypisz się:",
    unsubscribeUrl,
  ].join("\n");
}

function buildWelcomeHtml(unsubscribeUrl) {
  return emailShell({
    eyebrow: "FULL MAX PREMIUM",
    title: "Witaj w newsletterze gracz.pl",
    body:
      "Zapis został potwierdzony. Od teraz możesz otrzymywać informacje o nowych grach, poradnikach i najważniejszych aktualizacjach gracz.pl.",
    buttonText: "Przejdź do gracz.pl",
    buttonUrl: "https://gracz.pl/",
    footer:
      'Newsletter jest dobrowolny. <a href="' +
      escapeHtml(unsubscribeUrl) +
      '" style="color:#79d9d1">Wypisz się z newslettera</a>.',
  });
}

function emailShell({ eyebrow, title, body, buttonText, buttonUrl, footer }) {
  return `<!doctype html>
<html lang="pl"><body style="margin:0;background:#edf4f3;font-family:Arial,Helvetica,sans-serif;color:#17342f">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf4f3;padding:32px 10px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:#071a17;padding:28px 34px">
<div style="font-size:32px;font-weight:900;color:#fff">gracz<span style="color:#e54848">.pl</span></div>
<div style="padding-top:7px;color:#b6d1cc;font-size:12px">NEWSLETTER · ${escapeHtml(eyebrow)}</div>
</td></tr>
<tr><td style="padding:34px">
<h1 style="margin:0 0 14px;font-size:26px;color:#0d413a">${escapeHtml(title)}</h1>
<p style="margin:0 0 22px;line-height:1.7;color:#405d58">${escapeHtml(body)}</p>
<a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#56c8c1;color:#08312b;text-decoration:none;padding:13px 18px;border-radius:9px;font-weight:800">${escapeHtml(buttonText)}</a>
<div style="margin-top:26px;padding:16px 18px;background:#e9f8f6;border-radius:12px;color:#496660;font-size:12px;line-height:1.6">
<strong>Newsletter gracz.pl</strong><br>Nowe gry · Poradniki · Rozwój serwisu
</div>
</td></tr>
<tr><td style="background:#071a17;color:#8fa8a3;padding:20px 34px;font-size:11px;line-height:1.6">${footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
