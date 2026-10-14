// Unknown values must never silently enable intake. Missing preserves default.
export function parseNewsletterIntakePaused(value) {
  if (value === undefined) return false;
  const normalized=String(value).trim().toLowerCase();
  if(['false','0'].includes(normalized))return false;
  return true;
}
