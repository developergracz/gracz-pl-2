import fs from "node:fs";

const root = "maintenance-site";
const html = fs.readFileSync(`${root}/index.html`, "utf8");
const robots = fs.readFileSync(`${root}/robots.txt`, "utf8");
const sitemap = fs.readFileSync(`${root}/sitemap.xml`, "utf8");
const failures = [];

const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

const one = (re) => html.match(re)?.[1] ?? "";
const title = one(/<title>([^<]+)<\/title>/i).trim();
const description = one(/<meta\s+name="description"\s+content="([^"]+)"/i).trim();
const canonical = one(/<link\s+rel="canonical"\s+href="([^"]+)"/i).trim();
const h1Count = (html.match(/<h1\b/gi) || []).length;

requireCheck(title.length >= 30 && title.length <= 60, `title length must be 30-60 (got ${title.length})`);
requireCheck(title.toLowerCase().includes("gracz.pl"), "title must contain gracz.pl");
requireCheck(title.toLowerCase().includes("gry online"), "title must contain natural 'gry online' context");
requireCheck(description.length >= 120 && description.length <= 160, `description length must be 120-160 (got ${description.length})`);
requireCheck(canonical === "https://gracz.pl/", "canonical must be https://gracz.pl/");
requireCheck(/name="robots"[^>]*content="[^"]*index,follow/i.test(html), "homepage robots must be index,follow");
requireCheck(h1Count === 1, `homepage must have exactly one H1 (got ${h1Count})`);
requireCheck(/rel="icon"[^>]*href="\/favicon-192\.png"/i.test(html), "favicon link missing");
requireCheck(fs.existsSync(`${root}/favicon-192.png`), "favicon-192.png missing");
requireCheck(/href="\/assets\/img\/hero-bg\.webp"[^>]*fetchpriority="high"/i.test(html), "hero image preload/fetchpriority missing");
requireCheck(!/SearchAction/.test(html), "deprecated SearchAction must not be present");

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
  requireCheck(html.includes(`href="${href}"`), `important internal link missing: ${href}`);
}

const ldJsonBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
requireCheck(ldJsonBlocks.length > 0, "JSON-LD missing");

const schemaTypes = new Set();
for (const block of ldJsonBlocks) {
  try {
    const data = JSON.parse(block);
    const nodes = Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
    for (const node of nodes) {
      const t = node?.["@type"];
      for (const type of Array.isArray(t) ? t : [t]) {
        if (type) schemaTypes.add(type);
      }
    }
  } catch (error) {
    failures.push(`invalid JSON-LD: ${error.message}`);
  }
}

for (const type of ["WebSite", "Organization", "WebPage", "ImageObject", "ItemList"]) {
  requireCheck(schemaTypes.has(type), `schema type missing: ${type}`);
}

requireCheck(/User-agent:\s*\*/i.test(robots), "robots.txt missing User-agent: *");
requireCheck(/Allow:\s*\//i.test(robots), "robots.txt missing Allow: /");
requireCheck(/Sitemap:\s*https:\/\/gracz\.pl\/sitemap\.xml/i.test(robots), "robots.txt missing canonical sitemap URL");

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
requireCheck(sitemapUrls.includes("https://gracz.pl/"), "sitemap missing homepage");
requireCheck(new Set(sitemapUrls).size === sitemapUrls.length, "sitemap contains duplicate URLs");

if (failures.length) {
  console.error("SEO GATE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SEO GATE: PASS");
console.log(`title: ${title.length} chars`);
console.log(`description: ${description.length} chars`);
console.log(`schema: ${[...schemaTypes].sort().join(", ")}`);
console.log(`sitemap URLs: ${sitemapUrls.length}`);
