import {createHash} from 'node:crypto';
import {Client} from 'pg';

export const MIGRATION_ID = 'newsletter/001_opt_in_requests';
export const CANDIDATE_SHA256 = '66566f04025ab96aff2d03e3426e70a38f8d13c657a81a81c503ed00cb304b99';
export const digest = value => createHash('sha256').update(value).digest('hex');
export function refuse(code) { throw Object.assign(new Error(code), {code}); }
const hex = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export const EVIDENCE_KEYS = Object.freeze([
  'ownerGo', 'databaseOperatorGo', 'autoDeployFrozen', 'safeBuildStartHooks',
  'allWriterRetirement', 'noQueuedLaunches', 'databaseSessionCrossCheck',
  'providerUncertainInventory', 'restoreRehearsal', 'backupExportPitR',
  'secretEscrow', 'inertRollback', 'frontendCompatibility',
]);

// Offline structural validation, NOT independent proof of operator attestations.
// No ambient DATABASE_URL fallback and no connection-string overrides.
export function validateMigrationTarget({mode, connectionString, evidence, codeHead, now = Date.now()} = {}) {
  let url;
  try {url = new URL(connectionString);} catch {refuse('NEWSLETTER_MIGRATION_TARGET_REJECTED');}
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.search || url.hash)
    refuse('NEWSLETTER_MIGRATION_TARGET_REJECTED');
  const parameters = new Client({connectionString}).connectionParameters;
  const target = {host:parameters.host.replace(/^\[|\]$/g,''), port:Number(parameters.port), database:parameters.database, user:parameters.user};
  const local = ['127.0.0.1','::1','localhost'].includes(target.host);
  if (mode === 'disposable') {
    if (!local || target.database !== 'gracz_test') refuse('NEWSLETTER_MIGRATION_TARGET_REJECTED');
    return {target, evidenceDigest:null};
  }
  if (mode !== 'production' || local || !evidence || !/^[0-9a-f]{40}$/.test(codeHead || ''))
    refuse('NEWSLETTER_MIGRATION_APPROVAL_REQUIRED');
  const e = evidence;
  if (e.version !== 1 || e.action !== 'INSTALL_NEWSLETTER_SCHEMA' || e.codeHead !== codeHead ||
      e.migrationId !== MIGRATION_ID || e.sqlSha256 !== CANDIDATE_SHA256 || !hex(e.registrySha256) ||
      JSON.stringify(e.target) !== JSON.stringify(target)) refuse('NEWSLETTER_MIGRATION_EVIDENCE_MISMATCH');
  const issued = Date.parse(e.issuedAt), expires = Date.parse(e.expiresAt), stopped = Date.parse(e.writersStoppedAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || !Number.isFinite(stopped) ||
      stopped > issued || issued > now || expires <= now || expires-issued > 3600000 || now-stopped > 3600000)
    refuse('NEWSLETTER_MIGRATION_EVIDENCE_EXPIRED');
  for (const key of EVIDENCE_KEYS) {
    const item = e.evidence?.[key];
    if (item?.verified !== true || !hex(item.sha256) || typeof item.reference !== 'string' ||
        item.reference.trim().length < 8 || /TODO|UNVERIFIED|REPLACE|PENDING/.test(item.reference))
      refuse('NEWSLETTER_MIGRATION_EVIDENCE_INCOMPLETE');
  }
  if (typeof e.owner !== 'string' || !e.owner.trim() || typeof e.operator !== 'string' || !e.operator.trim())
    refuse('NEWSLETTER_MIGRATION_APPROVAL_REQUIRED');
  return {target, evidenceDigest:digest(JSON.stringify(e))};
}
