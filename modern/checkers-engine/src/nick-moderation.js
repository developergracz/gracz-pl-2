const BLOCKED_TERMS = [
  "chuj", "chuja", "chujem", "chujek", "chujowy",
  "kurwa", "kurwy", "kurwo", "kurwica", "skurwysyn", "skurwiel",
  "pierdole", "pierdol", "pierdolony", "pierdolona", "pierdolone", "wypierdalaj", "spierdalaj",
  "jebac", "jebany", "jebana", "jebane", "zajebac", "zajebisty",
  "cipa", "cipka", "pizda", "pizdo", "fiut", "kutas",
  "pedal", "pedaly", "pedale"
];

const RESERVED_TERMS = [
  "admin", "administrator", "moderator", "mod", "support", "pomoc",
  "graczpl", "gracz.pl", "newsletter", "system", "root"
];

export function moderateNick(value) {
  const original = String(value || "").trim();
  if (!original) return { allowed: true, reason: null };

  const normalized = normalizeNick(original);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const collapsed = compact.replace(/(.)\1{2,}/g, "$1$1");

  for (const term of BLOCKED_TERMS) {
    const needle = normalizeNick(term).replace(/[^a-z0-9]/g, "");
    if (needle && (compact.includes(needle) || collapsed.includes(needle))) {
      return { allowed: false, reason: "offensive" };
    }
  }

  for (const term of RESERVED_TERMS) {
    const needle = normalizeNick(term).replace(/[^a-z0-9]/g, "");
    if (compact === needle) return { allowed: false, reason: "reserved" };
  }

  return { allowed: true, reason: null };
}

function normalizeNick(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/9/g, "g");
}
