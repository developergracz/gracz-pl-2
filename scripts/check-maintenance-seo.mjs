import fs from "node:fs";

const root = "maintenance-site";
const failures = [];

const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

const read = (relativePath) => fs.readFileSync(`${root}/${relativePath}`, "utf8");
const parseLdTypes = (html, label) => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  requireCheck(blocks.length > 0, `${label}: JSON-LD missing`);
  const types = new Set();

  for (const block of blocks) {
    try {
      const data = JSON.parse(block);
      const nodes = Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
      for (const node of nodes) {
        const raw = node?.["@type"];
        for (const type of Array.isArray(raw) ? raw : [raw]) {
          if (type) types.add(type);
        }
      }
    } catch (error) {
      failures.push(`${label}: invalid JSON-LD: ${error.message}`);
    }
  }
  return {blocks, types};
};

const validateBasePage = ({html, label, canonical, requireTitleTerms = [], requireH1Terms = []}) => {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1]?.trim() ?? "";
  const foundCanonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1]?.trim() ?? "";
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1 = h1Matches[0]?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";

  requireCheck(title.length >= 30 && title.length <= 60, `${label}: title length must be 30-60 (got ${title.length})`);
  requireCheck(description.length >= 120 && description.length <= 160, `${label}: description length must be 120-160 (got ${description.length})`);
  requireCheck(foundCanonical === canonical, `${label}: canonical must be ${canonical}`);
  requireCheck(/name="robots"[^>]*content="[^"]*index,follow/i.test(html), `${label}: robots must be index,follow`);
  requireCheck(h1Matches.length === 1, `${label}: must have exactly one H1 (got ${h1Matches.length})`);
  requireCheck(/rel="icon"[^>]*href="\/favicon-192\.png"/i.test(html), `${label}: favicon link missing`);
  requireCheck(!/SearchAction/.test(html), `${label}: deprecated SearchAction must not be present`);

  for (const term of requireTitleTerms) {
    requireCheck(title.toLowerCase().includes(term.toLowerCase()), `${label}: title missing "${term}"`);
  }
  for (const term of requireH1Terms) {
    requireCheck(h1.toLowerCase().includes(term.toLowerCase()), `${label}: H1 missing "${term}"`);
  }

  return {title, description, h1};
};

const home = read("index.html");
const games = read("gry/index.html");
const robots = read("robots.txt");
const sitemap = read("sitemap.xml");

const homeMeta = validateBasePage({
  html: home,
  label: "homepage",
  canonical: "https://gracz.pl/",
  requireTitleTerms: ["gracz.pl", "gry online"]
});
requireCheck(/href="\/assets\/img\/hero-bg\.webp"[^>]*fetchpriority="high"/i.test(home), "homepage: hero image preload/fetchpriority missing");

for (const href of [
  "/gry/",
  "/gry/poker-treningowy/",
  "/gry/tysiac/",
  "/gry/warcaby/",
  "/gry/gomoku/",
  "/gry-karciane/",
  "/poradniki/",
  "/o-gracz-pl/"
]) {
  requireCheck(home.includes(`href="${href}"`), `homepage: important internal link missing: ${href}`);
}

const homeLd = parseLdTypes(home, "homepage");
for (const type of ["WebSite", "Organization", "WebPage", "ImageObject", "ItemList"]) {
  requireCheck(homeLd.types.has(type), `homepage: schema type missing: ${type}`);
}

const gamesMeta = validateBasePage({
  html: games,
  label: "games",
  canonical: "https://gracz.pl/gry/",
  requireTitleTerms: ["gry online", "gracz.pl"],
  requireH1Terms: ["gry online"]
});

requireCheck(/href="\/assets\/gry-hero-approved-v4\.webp"[^>]*fetchpriority="high"/i.test(games), "games: hero preload missing");
requireCheck(/<img[^>]+src="\/assets\/gry-hero-approved-v4\.webp"[^>]+fetchpriority="high"/i.test(games), "games: LCP image fetchpriority missing");

for (const href of [
  "/gry/poker-treningowy/",
  "/gry/poker-treningowy/zasady/",
  "/gry/tysiac/",
  "/gry/tysiac/zasady/",
  "/gry/warcaby/",
  "/gry/warcaby/zasady/",
  "/gry/gomoku/",
  "/gry/gomoku/zasady/",
  "/gry-karciane/",
  "/poradniki/",
  "/o-gracz-pl/"
]) {
  requireCheck(games.includes(`href="${href}"`), `games: important internal link missing: ${href}`);
}

const gamesLd = parseLdTypes(games, "games");
requireCheck(gamesLd.blocks.length === 1, `games: expected one consolidated JSON-LD block (got ${gamesLd.blocks.length})`);
for (const type of ["WebSite", "Organization", "CollectionPage", "BreadcrumbList", "ImageObject", "ItemList"]) {
  requireCheck(gamesLd.types.has(type), `games: schema type missing: ${type}`);
}

requireCheck(/User-agent:\s*\*/i.test(robots), "robots.txt missing User-agent: *");
requireCheck(/Allow:\s*\//i.test(robots), "robots.txt missing Allow: /");
requireCheck(/Sitemap:\s*https:\/\/gracz\.pl\/sitemap\.xml/i.test(robots), "robots.txt missing canonical sitemap URL");

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const url of ["https://gracz.pl/", "https://gracz.pl/gry/"]) {
  requireCheck(sitemapUrls.includes(url), `sitemap missing ${url}`);
}
requireCheck(new Set(sitemapUrls).size === sitemapUrls.length, "sitemap contains duplicate URLs");
requireCheck(fs.existsSync(`${root}/favicon-192.png`), "favicon-192.png missing");

if (failures.length) {
  console.error("SEO GATE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SEO GATE: PASS");
console.log(`homepage title: ${homeMeta.title.length} chars; description: ${homeMeta.description.length} chars`);
console.log(`games title: ${gamesMeta.title.length} chars; description: ${gamesMeta.description.length} chars`);
console.log(`games H1: ${gamesMeta.h1}`);
console.log(`games schema: ${[...gamesLd.types].sort().join(", ")}`);
console.log(`sitemap URLs: ${sitemapUrls.length}`);
