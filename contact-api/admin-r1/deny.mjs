export const privateHeaders = Object.freeze({
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
});
// Intentionally no feature flag, auth callback, environment override or service import.
export function denyAdmin(req, res) {
  res.writeHead(403, {
    ...privateHeaders,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(
    req.method === "HEAD"
      ? undefined
      : JSON.stringify({ ok: false, error: "admin_access_not_approved" }),
  );
}
