// ETAP 3 / Gate 14D
// READ-ONLY PRODUCTION ENVIRONMENT VERIFIER
// STATUS: DESIGN ARTIFACT / NO NETWORK / NO DB / NO SECRET VALUES OUTPUT
//
// This script reads process.env and emits safe booleans/classifications only.
// It must never print connection strings, secret values, hashes or fingerprints.

const env = process.env;

const secret = (name) => typeof env[name] === "string" ? env[name] : "";
const present = (name) => secret(name).trim().length > 0;
const min32 = (name) => secret(name).length >= 32;
const exact = (name, value) => String(env[name] || "") === value;

function safeUrlClass(raw) {
  try {
    const url = new URL(String(raw || ""));
    const host = url.hostname;
    if (["localhost", "127.0.0.1", "::1"].includes(host)) return "LOCAL";
    if (/^dpg-[a-z0-9-]+$/i.test(host) && !host.includes(".")) return "PRIVATE_RENDER_NETWORK";
    return "PUBLIC_ENDPOINT_REQUIRES_VERIFIED_TLS";
  } catch {
    return "INVALID_OR_ABSENT";
  }
}

function canonicalPublicBaseUrl(raw) {
  try {
    const url = new URL(String(raw || ""));
    const originOnly = url.pathname === "/" && !url.search && !url.hash;
    return url.protocol === "https:" && url.hostname === "gracz.pl" && originOnly;
  } catch {
    return false;
  }
}

function pairwiseDistinct(names) {
  const values = names.map((name) => secret(name)).filter(Boolean);
  return values.length === names.length && new Set(values).size === values.length;
}

const twilioBits = [
  present("TWILIO_ACCOUNT_SID"),
  present("TWILIO_AUTH_TOKEN"),
  present("TWILIO_FROM_NUMBER"),
];
const twilioComplete = twilioBits.every(Boolean);
const twilioDisabled = twilioBits.every((value) => !value);

const cryptoNames = [
  "AUTH_SECRET",
  "AUDIT_HASH_SALT",
  "LEGACY_CRYPTO_ROOT_V1",
  "MESSAGE_ENCRYPTION_KEY_V2",
  "ATTACHMENT_ENCRYPTION_KEY_V2",
  "MFA_ENCRYPTION_KEY_V2",
];

const result = Object.freeze({
  verifier: "gate14d-production-env-readonly-v1",
  safeOutput: true,
  nodeEnvProduction: exact("NODE_ENV", "production"),

  publicBaseUrlPresent: present("PUBLIC_BASE_URL"),
  publicBaseUrlCanonical: canonicalPublicBaseUrl(env.PUBLIC_BASE_URL),

  turnstileSiteKeyPresent: present("TURNSTILE_SITE_KEY"),
  turnstileSecretKeyPresent: present("TURNSTILE_SECRET_KEY"),
  turnstilePairComplete: present("TURNSTILE_SITE_KEY") && present("TURNSTILE_SECRET_KEY"),
  turnstileHostnamePresent: present("TURNSTILE_HOSTNAME"),
  turnstileHostnameCanonical: exact("TURNSTILE_HOSTNAME", "gracz.pl"),

  resendApiKeyPresent: present("RESEND_API_KEY"),
  emailFromPresent: present("EMAIL_FROM"),

  twilioComplete,
  twilioDisabled,
  twilioPartial: !twilioComplete && !twilioDisabled,

  authSecretPresent: present("AUTH_SECRET"),
  authSecretMin32: min32("AUTH_SECRET"),
  auditHashSaltPresent: present("AUDIT_HASH_SALT"),
  auditHashSaltMin32: min32("AUDIT_HASH_SALT"),
  auditSaltDistinctFromAuth: present("AUDIT_HASH_SALT") && present("AUTH_SECRET") && secret("AUDIT_HASH_SALT") !== secret("AUTH_SECRET"),

  legacyCryptoRootV1Present: present("LEGACY_CRYPTO_ROOT_V1"),
  messageKeyV2Present: present("MESSAGE_ENCRYPTION_KEY_V2"),
  attachmentKeyV2Present: present("ATTACHMENT_ENCRYPTION_KEY_V2"),
  mfaKeyV2Present: present("MFA_ENCRYPTION_KEY_V2"),
  messageKeyV2Min32: min32("MESSAGE_ENCRYPTION_KEY_V2"),
  attachmentKeyV2Min32: min32("ATTACHMENT_ENCRYPTION_KEY_V2"),
  mfaKeyV2Min32: min32("MFA_ENCRYPTION_KEY_V2"),
  allCryptoAndAuditRootsPairwiseDistinct: pairwiseDistinct(cryptoNames),
  cryptoWriteVersion2: exact("CRYPTO_WRITE_VERSION", "2"),

  databaseUrlPresent: present("DATABASE_URL"),
  databaseTransportClass: safeUrlClass(env.DATABASE_URL),
  migratorDatabaseUrlAbsentFromRuntime: !present("MIGRATOR_DATABASE_URL"),

  databaseSslCaPresent: present("DATABASE_SSL_CA_BASE64"),

  trustCloudflareHeaders: String(env.TRUST_CLOUDFLARE_HEADERS || "").toLowerCase() === "true",
  trustProxyHeaders: String(env.TRUST_PROXY_HEADERS || "").toLowerCase() === "true",

  legacyMessageKeyNamePresent: present("MESSAGE_ENCRYPTION_KEY"),
  legacyAttachmentKeyNamePresent: present("ATTACHMENT_ENCRYPTION_KEY"),
  legacyMfaKeyNamePresent: present("MFA_ENCRYPTION_KEY"),
});

// This output is intentionally safe: no env value is emitted.
console.log(JSON.stringify(result, null, 2));
