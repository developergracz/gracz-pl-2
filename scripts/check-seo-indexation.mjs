// SEO AUTO MAX R1: deterministic checks, no content rewrites or Google indexing API.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("maintenance-site");
const ORIGIN = "https://gracz.pl";
const failures = [];
const report = (ok, message) => { if (!ok) failures.push(message); };
const tagList = (html, name) => [...html.matchAll(new RegExp("<" + name + "\\b[^>]*>", "gi"))].map(m => m[0]);
const attr = (tag, name) => {
  const found = tag.match(new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i"));
  return found ? (found[1] ?? found[2]) : null;
};
const namedMeta = (head, name) => tagList(head, "meta").filter(t => attr(t, "name")?.toLowerCase() === name);
const canonicals = head => tagList(head, "link").filter(t => (attr(t, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"));
const urlBlocks = xml => [...xml.matchAll(/<url>\s*([\s\S]*?)<\/url>/gi)].map(m => m[1]);
const value = (block, name) => block.match(new RegExp("<" + name + ">([^<]*)</" + name + ">", "i"))?.[1]?.trim() ?? "";

function sitemapEntries(xml, label) {
  const blocks = urlBlocks(xml);
  report(blocks.length > 0, label + ": no <url> entries");
  const seen = new Set();
  const entries = [];
  for (const block of blocks) {
    const url = value(block, "loc");
    report((block.match(/<loc>/gi) || []).length === 1, label + ": expected one loc per URL");
    report(!seen.has(url), label + ": duplicate URL " + url);
    seen.add(url);
    try {
      const parsed = new URL(url);
      report(parsed.origin === ORIGIN && parsed.href === url && !parsed.search &&
        !parsed.hash && parsed.pathname.endsWith("/"), label + ": invalid canonical URL " + url);
    } catch {
      report(false, label + ": invalid URL " + url);
    }
    const dates = [...block.matchAll(/<lastmod>([^<]*)<\/lastmod>/gi)].map(m => m[1]);
    report(dates.length <= 1, label + ": duplicate lastmod for " + url);
    if (dates.length) {
      const d = dates[0];
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(d) &&
        !Number.isNaN(Date.parse(d + "T00:00:00Z")) &&
        new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;
      report(validDate, label + ": invalid lastmod for " + url);
      if (validDate) report(d <= new Date().toISOString().slice(0, 10), label + ": future lastmod for " + url);
    }
    entries.push(url);
  }
  return entries;
}

function checkPage(html, url, label, sitemapSet) {
  const head = html.split(/<\/head\s*>/i)[0];
  const robots = namedMeta(head, "robots");
  report(robots.length === 1, label + ": expected one robots meta tag");
  const directives = (attr(robots[0] ?? "", "content") ?? "").toLowerCase().split(",").map(v => v.trim());
  if (directives.includes("noindex")) {
    report(!sitemapSet.has(url), label + ": noindex page must not be in sitemap");
    return false;
  }

  report(directives.includes("index"), label + ": public page must allow indexing");
  report(sitemapSet.has(url), label + ": indexable page missing from sitemap");
  const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  report(tagList(head, "title").length === 1 && title.length > 0, label + ": missing or duplicate title");
  const descriptions = namedMeta(head, "description");
  report(descriptions.length === 1 && Boolean(attr(descriptions[0] ?? "", "content")?.trim()),
    label + ": missing or duplicate meta description");
  const canonicalTags = canonicals(head);
  report(canonicalTags.length === 1 && attr(canonicalTags[0] ?? "", "href") === url,
    label + ": canonical must equal " + url);
  report(tagList(html, "h1").length === 1, label + ": exactly one H1 required");
  return true;
}

function htmlFiles(dir) {
  const files = [];
  for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...htmlFiles(p));
    else if (item.isFile() && item.name === "index.html") files.push(p);
  }
  return files;
}

const sitemapXml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const sitemap = sitemapEntries(sitemapXml, "repository sitemap");
const sitemapSet = new Set(sitemap);
const robotsTxt = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8");
report(/^\s*Sitemap:\s*https:\/\/gracz\.pl\/sitemap\.xml\s*$/im.test(robotsTxt),
  "robots.txt: missing canonical sitemap reference");
report(!/^\s*Disallow:\s*\/\s*$/im.test(robotsTxt), "robots.txt: site-wide disallow");

const publicRoutes = new Set();
let privateCount = 0;
for (const file of htmlFiles(ROOT)) {
  const relative = path.relative(ROOT, file).replaceAll("\\", "/");
  const route = relative === "index.html" ? "/" : "/" + relative.slice(0, -"index.html".length);
  const url = ORIGIN + route;
  const html = fs.readFileSync(file, "utf8");
  if (checkPage(html, url, relative, sitemapSet)) publicRoutes.add(url);
  else privateCount++;
}
for (const url of sitemap) {
  report(publicRoutes.has(url), "sitemap contains a missing, non-canonical or noindex page: " + url);
}

// Optional scheduled live crawl checks what the public site actually serves.
// Does not ask Google to index pages or change website content.
async function getPublicText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "gracz-seo-auto-max/1.0" }
  });
  if (!response.ok || response.url !== url) {
    throw new Error("HTTP " + response.status + ", final URL " + response.url);
  }
  return response.text();
}

async function liveCheck() {
  let liveRobots, liveMap;
  try {
    [liveRobots, liveMap] = await Promise.all([
      getPublicText(ORIGIN + "/robots.txt"),
      getPublicText(ORIGIN + "/sitemap.xml")
    ]);
  } catch (error) {
    failures.push("live robots/sitemap unavailable: " + error.message);
    return;
  }
  report(/^\s*Sitemap:\s*https:\/\/gracz\.pl\/sitemap\.xml\s*$/im.test(liveRobots),
    "live robots.txt: missing sitemap");
  const urls = sitemapEntries(liveMap, "live sitemap");
  // Small batches prevent the health check from overloading a free static site.
  for (let i = 0; i < urls.length; i += 4) {
    await Promise.all(urls.slice(i, i + 4).map(async url => {
      if (!url.startsWith(ORIGIN + "/")) return;
      try {
        const html = await getPublicText(url);
        const head = html.split(/<\/head\s*>/i)[0];
        const canonical = canonicals(head);
        const robots = namedMeta(head, "robots");
        report(canonical.length === 1 && attr(canonical[0] ?? "", "href") === url,
          "live page incorrect canonical: " + url);
        report(robots.length === 1 &&
          !(attr(robots[0] ?? "", "content") ?? "").toLowerCase().split(",").includes("noindex"),
          "live page blocked from indexing: " + url);
      } catch (error) {
        failures.push("live page unavailable " + url + ": " + error.message);
      }
    }));
  }
  console.log("Live SEO pages checked: " + urls.length);
}

if (process.argv.includes("--live")) await liveCheck();

if (failures.length) {
  console.error("SEO AUTO MAX R1: FAIL");
  for (const problem of failures) console.error("- " + problem);
  process.exitCode = 1;
} else {
  console.log("SEO AUTO MAX R1: PASS");
  console.log("Indexable pages: " + publicRoutes.size + "; noindex pages: " + privateCount +
    "; sitemap URLs: " + sitemap.length);
}
