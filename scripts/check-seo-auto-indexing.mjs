import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const HOST = "https://gracz.pl";
const SITEMAP_URL = HOST + "/sitemap.xml";

function attribute(tag, name) {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
  return match ? match[2] : null;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp("<" + name + "\\b[^>]*>", "gi"))].map((match) => match[0]);
}

function metaValues(html, name) {
  return tags(html, "meta")
    .filter((tag) => attribute(tag, "name")?.toLowerCase() === name)
    .map((tag) => attribute(tag, "content"));
}

function canonicalLinks(html) {
  return tags(html, "link")
    .filter((tag) => attribute(tag, "rel")?.toLowerCase().split(/\s+/).includes("canonical"))
    .map((tag) => attribute(tag, "href"));
}

function allHtmlFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...allHtmlFiles(file));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(file);
  }
  return files;
}

function isNoindex(directives) {
  return /(?:^|,)\s*noindex\s*(?:,|$)/i.test(directives ?? "");
}

export function auditIndexability(root) {
  const errors = [];
  const sitemapFile = path.join(root, "sitemap.xml");
  const robotsFile = path.join(root, "robots.txt");

  if (!fs.existsSync(sitemapFile)) return ["Missing sitemap.xml"];
  if (!fs.existsSync(robotsFile)) return ["Missing robots.txt"];

  const sitemap = fs.readFileSync(sitemapFile, "utf8");
  const robots = fs.readFileSync(robotsFile, "utf8");
  if (!/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(sitemap) ||
      !/<\/urlset>/i.test(sitemap)) {
    errors.push("sitemap.xml: missing XML sitemap urlset namespace");
  }
  if (!/^\s*Sitemap:\s*https:\/\/gracz\.pl\/sitemap\.xml\s*$/im.test(robots)) {
    errors.push("robots.txt: canonical sitemap declaration missing");
  }
  if (/^\s*Disallow:\s*\/\s*$/im.test(robots)) {
    errors.push("robots.txt: a blanket Disallow: / blocks crawling");
  }

  const sitemapURLs = new Set();
  const entries = [...sitemap.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/gi)];
  const rawLocs = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)];
  if (entries.length !== rawLocs.length) errors.push("sitemap.xml: malformed URL entries");
  for (const entry of entries) {
    const locs = [...entry[1].matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)];
    if (locs.length !== 1) {
      errors.push("sitemap.xml: each URL entry needs exactly one loc");
      continue;
    }
    const url = locs[0][1].trim();
    if (sitemapURLs.has(url)) errors.push("sitemap.xml: duplicate URL " + url);
    sitemapURLs.add(url);
    try {
      const parsed = new URL(url);
      if (parsed.origin !== HOST || parsed.search || parsed.hash) {
        errors.push("sitemap.xml: URL must use the canonical HTTPS host: " + url);
      }
    } catch {
      errors.push("sitemap.xml: invalid URL " + url);
    }
    const dates = [...entry[1].matchAll(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/gi)];
    if (dates.length > 1 || dates.some((match) =>
      !/^\d{4}-\d{2}-\d{2}$/.test(match[1]) ||
      Number.isNaN(Date.parse(match[1] + "T00:00:00Z")) ||
      match[1] > new Date().toISOString().slice(0, 10)
    )) {
      errors.push("sitemap.xml: invalid or future lastmod for " + url);
    }
  }

  const publicURLs = new Set();
  for (const file of allHtmlFiles(root)) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const pathname = relative.endsWith("index.html")
      ? "/" + relative.slice(0, -"index.html".length)
      : "/" + relative;
    const url = HOST + pathname;
    const html = fs.readFileSync(file, "utf8");
    const robotsMeta = metaValues(html, "robots");
    const googlebotMeta = metaValues(html, "googlebot");
    const noindex = robotsMeta.some(isNoindex) || googlebotMeta.some(isNoindex);

    if (robotsMeta.length !== 1 || !robotsMeta[0]) {
      errors.push(relative + ": expected exactly one explicit robots meta tag");
    }
    if (noindex) {
      if (sitemapURLs.has(url)) {
        errors.push(relative + ": noindex page must not appear in the sitemap");
      }
      continue;
    }

    publicURLs.add(url);
    if (!/(?:^|,)\s*index\s*(?:,|$)/i.test(robotsMeta[0] ?? "")) {
      errors.push(relative + ": public page must explicitly allow indexing");
    }
    const canonical = canonicalLinks(html);
    if (canonical.length !== 1 || canonical[0] !== url) {
      errors.push(relative + ": expected one self-referencing canonical " + url);
    }
    if (!/<title>\s*[^<\s][^<]*<\/title>/i.test(html)) {
      errors.push(relative + ": title missing");
    }
    if (!metaValues(html, "description").some((value) => value?.trim())) {
      errors.push(relative + ": meta description missing");
    }
    if ((html.match(/<h1\b/gi) ?? []).length !== 1) {
      errors.push(relative + ": public page must have exactly one H1");
    }
    if (!sitemapURLs.has(url)) {
      errors.push(relative + ": indexable page missing from sitemap.xml");
    }
  }

  for (const url of sitemapURLs) {
    if (!publicURLs.has(url)) {
      errors.push("sitemap.xml: URL is not an indexable published HTML page: " + url);
    }
  }
  return errors;
}

// Live inspection runs only in scheduled or manually dispatched GitHub Actions.
// The normal PR gate stays deterministic and does not depend on network uptime.
async function fetchPublicPage(url, fetcher) {
  const response = await fetcher(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: {"User-Agent": "gracz-seo-auto/1.0"}
  });
  if (!response.ok || response.url !== url) {
    throw new Error("HTTP " + response.status + "; final URL " + response.url);
  }
  return response.text();
}

export async function auditLiveIndexability(fetcher = fetch) {
  const errors = [];
  let robots, sitemap;
  try {
    [robots, sitemap] = await Promise.all([
      fetchPublicPage(HOST + "/robots.txt", fetcher),
      fetchPublicPage(SITEMAP_URL, fetcher)
    ]);
  } catch (error) {
    return ["Live robots.txt/sitemap.xml inaccessible: " + error.message];
  }

  if (!/^\\s*Sitemap:\\s*https:\\/\\/gracz\\.pl\\/sitemap\\.xml\\s*$/im.test(robots)) {
    errors.push("Live robots.txt: expected sitemap declaration missing");
  }
  if (/^\\s*Disallow:\\s*\\/\\s*$/im.test(robots)) {
    errors.push("Live robots.txt: blanket Disallow: /");
  }
  if (!/<urlset\\b[^>]*xmlns=["']http:\\/\\/www\\.sitemaps\\.org\\/schemas\\/sitemap\\/0\\.9["']/i.test(sitemap)) {
    errors.push("Live sitemap.xml: invalid sitemap namespace");
  }

  const blocks = [...sitemap.matchAll(/<url>\\s*([\\s\\S]*?)<\\/url>/gi)];
  const locs = [...sitemap.matchAll(/<loc>\\s*([^<]+?)\\s*<\\/loc>/gi)];
  if (!blocks.length || blocks.length !== locs.length) {
    errors.push("Live sitemap.xml: missing or malformed URL entries");
  }
  const urls = [];
  const seen = new Set();
  for (const block of blocks) {
    const matches = [...block[1].matchAll(/<loc>\\s*([^<]+?)\\s*<\\/loc>/gi)];
    if (matches.length !== 1) {
      errors.push("Live sitemap.xml: every URL needs exactly one loc");
      continue;
    }
    const url = matches[0][1].trim();
    let valid = false;
    try {
      const parsed = new URL(url);
      valid = parsed.origin === HOST && parsed.href === url &&
        !parsed.search && !parsed.hash;
    } catch {
      // Reject malformed URLs and never fetch a foreign host.
    }
    if (!valid) {
      errors.push("Live sitemap.xml: invalid canonical URL " + url);
    } else if (seen.has(url)) {
      errors.push("Live sitemap.xml: duplicate URL " + url);
    } else {
      seen.add(url);
      urls.push(url);
    }
  }
  // Bounded batches avoid a burst of requests to the production service.
  for (let i = 0; i < urls.length; i += 4) {
    await Promise.all(urls.slice(i, i + 4).map(async (url) => {
      try {
        const html = await fetchPublicPage(url, fetcher);
        const canonical = canonicalLinks(html);
        const robotsTags = metaValues(html, "robots");
        const googlebotTags = metaValues(html, "googlebot");
        if (canonical.length !== 1 || canonical[0] !== url) {
          errors.push("Live page canonical mismatch: " + url);
        }
        if (robotsTags.length !== 1 || robotsTags.some(isNoindex) ||
            googlebotTags.some(isNoindex)) {
          errors.push("Live page blocked from indexing: " + url);
        }
      } catch (error) {
        errors.push("Live page unavailable " + url + ": " + error.message);
      }
    }));
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = auditIndexability(path.resolve("maintenance-site"));
  if (process.argv.includes("--live")) errors.push(...await auditLiveIndexability());
  if (errors.length) {
    console.error("SEO AUTO R1: FAIL");
    for (const error of errors) console.error("- " + error);
    process.exitCode = 1;
  } else {
    console.log("SEO AUTO R1: PASS — sitemap, canonicals and indexability consistent");
  }
}
