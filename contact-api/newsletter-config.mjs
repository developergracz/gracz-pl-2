// Only an explicit operator opt-in enables intake, including on first startup.
export function parseNewsletterIntakePaused(value) {
  const normalized=String(value).trim().toLowerCase();
  if(['false','0'].includes(normalized))return false;
  return true;
}
