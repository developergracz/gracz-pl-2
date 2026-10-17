// Scoped Owner-approved F-03 exception for Render's encrypted private DB transport.
// No public hostname, generic SSL bypass, server startup or other DB clients.
export const F03_PRIVATE_TLS_APPROVAL = 'GRACZ_F03_RENDER_PRIVATE_TLS_R1';
const DENIED = 'F03_PRIVATE_TLS_SCOPE_REJECTED';
const HOST = 'dpg-db38btt9fdbs73aadohg-a';
const DATABASE = 'gracz_r4_staging_postgres';
const USER = 'gracz_r4_staging_postgres_user';
const SERVICE = 'srv-db00m2u7bikc73fnsje0';

export function f03TlsOptions(connectionString, env = process.env) {
  const approval = env.F03_PRIVATE_RENDER_TLS_EXCEPTION;
  if (approval === undefined || approval === '') return {rejectUnauthorized: true};
  if (approval !== F03_PRIVATE_TLS_APPROVAL) throw new Error(DENIED);
  try {
    const url = new URL(connectionString);
    // Exact Render private hostname, not the public Frankfurt PostgreSQL hostname.
    // This is transport encryption WITHOUT certificate-identity verification.
    // The separate migration receipt, live DB identity and writer gates still apply.
    if (env.RENDER_SERVICE_ID !== SERVICE ||
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        url.hostname !== HOST || (url.port || '5432') !== '5432' ||
        url.search || url.hash || !url.password ||
        decodeURIComponent(url.pathname.slice(1)) !== DATABASE ||
        decodeURIComponent(url.username) !== USER) throw new Error(DENIED);
    return {rejectUnauthorized: false};
  } catch {
    throw new Error(DENIED);
  }
}
