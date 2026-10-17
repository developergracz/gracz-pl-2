/**
 * Only a fully received HTTP 422 response to POST /emails (not a timeout,
 * network error, JSON parse error or a 422 in contact management) is a
 * definitive provider rejection. Do NOT treat that as authorization to
 * clear any durable reservation: a separate reviewed operator procedure
 * must prove the absence of delivery and reconcile it.
 */
export function isDefinitiveNewsletterEmailRejection(error) {
  return Boolean(
    error &&
    error.code === 'NEWSLETTER_MAIL_FAILED' &&
    error.providerOperation === 'POST /emails' &&
    error.providerStatus === 422 &&
    error.status === 422
  );
}
