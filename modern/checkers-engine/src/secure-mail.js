import { randomUUID } from "node:crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

export async function sendSystemEmail({ from, to, subject, html, text, unsubscribeUrl = null }) {
  if (!RESEND_API_KEY) return { sent: false, reason: "missing_api_key" };
  if (!isSafeMailbox(to) || !isSafeHeader(subject) || !isSafeHeader(from)) return { sent: false, reason: "invalid_headers" };

  const headers = {
    "X-Entity-Ref-ID": randomUUID(),
    "X-Gracz-Mail-Security": "tls-api; dkim; spf; dmarc-ready; no-secrets",
  };
  if (unsubscribeUrl) {
    if (!isHttpsUrl(unsubscribeUrl)) return { sent: false, reason: "insecure_unsubscribe_url" };
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text, headers }),
    });
    if (!response.ok) {
      console.error("System e-mail: dostawca odrzucił wiadomość", response.status);
      return { sent: false, reason: `provider_${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("System e-mail: błąd transportu", error?.name || "network_error");
    return { sent: false, reason: "network_error" };
  }
}

export function assertSecurePublicUrl(value) {
  if (!isHttpsUrl(value)) throw new Error("Publiczny adres wiadomości musi używać HTTPS.");
  return value;
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeMailbox(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value) && !/[\r\n]/.test(value);
}

function isSafeHeader(value) {
  return typeof value === "string" && value.length <= 998 && !/[\r\n]/.test(value);
}
