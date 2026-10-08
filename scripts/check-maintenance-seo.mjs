import fs from "node:fs";
import path from "node:path";

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
  const h1 = h1Matches[0]?.[1]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";

  requireCheck(title.length >= 30 && title.length <= 60, `${label}: title length must be 30-60 (got ${title.length})`);
  requireCheck(description.length >= 120 && description.length <= 160, `${label}: description length must be 120-160 (got ${description.length})`);
  requireCheck(foundCanonical === canonical, `${label}: canonical must be ${canonical}`);
  requireCheck(/name="robots"[^>]*content="[^"]*index,follow/i.test(html), `${label}: robots must be index,follow`);
  requireCheck(h1Matches.length === 1, `${label}: must have exactly one H1 (got ${h1Matches.length})`);
  requireCheck(/rel="icon"[^>]*href="\/favicon-192\.png(?:\?v=card-r1)?"/i.test(html), `${label}: favicon link missing`);
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
const regulation = read("regulamin/index.html");
const privacy = read("polityka-prywatnosci/index.html");
const robots = read("robots.txt");
const sitemap = read("sitemap.xml");

const sharedHeaderPages = [
  "index.html",
  "gry/index.html",
  "gry-karciane/index.html",
  "poradniki/index.html",
  "o-gracz-pl/index.html",
  "gry/poker-treningowy/index.html",
  "gry/tysiac/index.html",
  "gry/warcaby/index.html",
  "gry/gomoku/index.html",
  "gry/poker-treningowy/zasady/index.html",
  "gry/tysiac/zasady/index.html",
  "gry/warcaby/zasady/index.html",
  "gry/gomoku/zasady/index.html",
  "regulamin/index.html",
  "polityka-prywatnosci/index.html",
  "newsletter/index.html",
  "szukaj/index.html",
  "wyszukiwarka/index.html"
];

for (const page of sharedHeaderPages) {
  const html = read(page);
  requireCheck(
    html.includes('href="/assets/global-header-r1.css?v=r3"'),
    `${page}: canonical global header stylesheet missing`
  );
  requireCheck(
    /<header class="site-header\b/.test(html),
    `${page}: canonical site-header missing`
  );
  requireCheck(
    /data-modal="login"[^>]*>Zaloguj się</.test(html),
    `${page}: canonical login action missing`
  );
  requireCheck(
    /data-modal="register"[^>]*>Załóż konto</.test(html),
    `${page}: canonical gold register action missing`
  );
  requireCheck(
    /class="[^"]*forum-trigger[^"]*"[^>]*>Forum</.test(html),
    `${page}: canonical Forum action missing`
  );
}

for (const page of [
  "gry/poker-treningowy/zasady/index.html",
  "gry/tysiac/zasady/index.html",
  "gry/warcaby/zasady/index.html",
  "gry/gomoku/zasady/index.html",
  "regulamin/index.html",
  "polityka-prywatnosci/index.html",
  "newsletter/index.html",
  "szukaj/index.html",
  "wyszukiwarka/index.html"
]) {
  const html = read(page);
  requireCheck(
    html.includes('data-shared-header="r1"'),
    `${page}: shared header runtime marker missing`
  );
  requireCheck(
    html.includes('src="/assets/global-header-r1.js?v=r1"'),
    `${page}: shared header behavior missing`
  );
}

const sharedHeaderCss = read("assets/global-header-r1.css");
const sharedHeaderJs = read("assets/global-header-r1.js");
requireCheck(
  sharedHeaderCss.includes("linear-gradient(180deg,#ffe9ad,#f2b43f)"),
  "global header: approved gold register treatment missing"
);
requireCheck(
  sharedHeaderCss.includes("background:#050706!important"),
  "global header: approved dark login treatment missing"
);
requireCheck(
  sharedHeaderCss.includes("--gh-teal:#56c8c1"),
  "global header: approved Forum teal missing"
);
requireCheck(
  sharedHeaderCss.includes("width:min(1340px,calc(100% - 48px))!important"),
  "homepage header: 1340px layout parity missing"
);
requireCheck(
  sharedHeaderCss.includes("GLOBAL HEADER R3 — homepage internal fit") &&
    sharedHeaderCss.includes(".homepage-premium-max .site-header .nav-list{") &&
    sharedHeaderCss.includes("gap:18px!important") &&
    sharedHeaderCss.includes("min-width:128px!important") &&
    sharedHeaderCss.includes("min-width:150px!important"),
  "homepage header: compact internal geometry missing"
);
requireCheck(
  sharedHeaderCss.includes(".site-header .search-btn--mobile,") &&
    sharedHeaderCss.includes(".site-header .head-search-mobile{") &&
    sharedHeaderCss.includes("display:none!important"),
  "global header: desktop mobile-search suppression missing"
);
requireCheck(
  sharedHeaderJs.includes("data-shared-header"),
  "global header: special-page runtime binding missing"
);

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

const regulationMeta = validateBasePage({
  html: regulation,
  label: "regulation",
  canonical: "https://gracz.pl/regulamin/",
  requireTitleTerms: ["Regulamin", "gracz.pl"],
  requireH1Terms: ["Regulamin", "gracz.pl"]
});
requireCheck(regulation.includes('href="/assets/legal.css?v=forum-teal-r3"'), "regulation: legal stylesheet missing");
requireCheck(regulation.includes('src="/assets/legal.js?v=owner-email-r1"'), "regulation: owner email premium legal script missing");
requireCheck(privacy.includes('src="/assets/legal.js?v=owner-email-r1"'), "privacy: owner email premium legal script missing");

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
for (const url of ["https://gracz.pl/", "https://gracz.pl/gry/", "https://gracz.pl/regulamin/"]) {
  requireCheck(sitemapUrls.includes(url), `sitemap missing ${url}`);
}
requireCheck(new Set(sitemapUrls).size === sitemapUrls.length, "sitemap contains duplicate URLs");
requireCheck(fs.existsSync(`${root}/favicon-192.png`), "favicon-192.png missing");

const allHtmlPages = [];
const collectHtml = (dir) => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtml(full);
    else if (entry.isFile() && entry.name.endsWith(".html")) allHtmlPages.push(full);
  }
};
collectHtml(root);

for (const file of allHtmlPages) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const icon = (html.match(/<link\b[^>]*rel="icon"[^>]*href="\/favicon-192\.png\?v=card-r1"[^>]*>/gi) || []).length;
  const shortcut = (html.match(/<link\b[^>]*rel="shortcut icon"[^>]*href="\/favicon-192\.png\?v=card-r1"[^>]*>/gi) || []).length;
  const apple = (html.match(/<link\b[^>]*rel="apple-touch-icon"[^>]*href="\/favicon-192\.png\?v=card-r1"[^>]*>/gi) || []).length;
  requireCheck(icon === 1, `${rel}: expected exactly one browser favicon link, got ${icon}`);
  requireCheck(shortcut === 1, `${rel}: expected exactly one shortcut favicon link, got ${shortcut}`);
  requireCheck(apple === 1, `${rel}: expected exactly one apple-touch-icon link, got ${apple}`);
  if (/data-modal="terms"/i.test(html) || /data-modal="contact"/i.test(html)) {
    requireCheck(html.includes('/assets/legal-links.js?v=r37'), `${rel}: legal/contact trigger exists but legal-links.js R37 is missing`);
  }
  if (/data-modal="contact"/i.test(html)) {
    requireCheck(html.includes('/assets/contact-modal.css?v=r8'), `${rel}: contact modal CSS R8 must be preloaded to prevent flash`);
    requireCheck(/data-contact-modal-style/i.test(html), `${rel}: contact modal preload marker missing`);
  }
  if (/\/zasady\/index\.html$/i.test(rel)) {
    requireCheck(html.includes('href="/"'), `${rel}: top navigation Start action missing`);
    requireCheck(html.includes('href="/gry/"'), `${rel}: top navigation Gry action missing`);
    requireCheck(html.includes('href="/gry-karciane/"'), `${rel}: top navigation Gry karciane action missing`);
    requireCheck(html.includes('href="/poradniki/"'), `${rel}: top navigation Poradniki action missing`);
    requireCheck(html.includes('data-modal="community"'), `${rel}: top navigation Społeczność action missing`);
    requireCheck(html.includes('data-modal="forum"'), `${rel}: top navigation Forum action missing`);
    requireCheck(html.includes('href="/o-gracz-pl/"'), `${rel}: top navigation O gracz.pl action missing`);
  }
}

requireCheck(fs.existsSync(path.resolve(root, "assets/contact-modal.css")), "contact modal stylesheet missing");
requireCheck(fs.existsSync(path.resolve(root, "assets/legal-links.js")), "legal-links.js missing");
requireCheck(fs.existsSync(path.resolve(root, "assets/footer-newsletter.css")), "footer-newsletter.css missing");
requireCheck(fs.existsSync(path.resolve(root, "assets/account-access-premium.css")), "account premium stylesheet missing");
requireCheck(fs.existsSync(path.resolve(root, "assets/legal.js")), "legal script missing");
const accountAccessCss = fs.readFileSync(path.resolve(root, "assets/account-access-premium.css"), "utf8");
const legalJs = fs.readFileSync(path.resolve(root, "assets/legal.js"), "utf8");
const contactCss = fs.readFileSync(path.resolve(root, "assets/contact-modal.css"), "utf8");
const legalLinksJs = fs.readFileSync(path.resolve(root, "assets/legal-links.js"), "utf8");
requireCheck(legalLinksJs.includes("account-access-premium.css?v=r2"), "account modal R2 stylesheet loader missing");
requireCheck(accountAccessCss.includes("max-height:calc(100dvh - 28px)"), "account modal: desktop viewport height guard missing");
requireCheck(accountAccessCss.includes("@media (max-height:850px) and (min-width:641px)"), "account modal: compact-height desktop mode missing");
requireCheck(legalJs.includes('owner-email-premium-modal'), "owner email premium modal missing");
requireCheck(legalJs.includes('a[href="mailto:czsocha@wp.pl"]'), "owner email links are not intercepted");
requireCheck(legalJs.includes('/assets/account-access-premium.css?v=r2'), "owner email modal must reuse account premium sizing");
requireCheck(legalJs.includes('Napisz e-mail do gracz.pl'), "owner email premium CTA missing");
requireCheck(regulation.includes('href="mailto:czsocha@wp.pl"'), "regulation: owner email mailto missing");
requireCheck(privacy.includes('href="mailto:czsocha@wp.pl"'), "privacy: owner email mailto missing");
requireCheck(legalLinksJs.includes("footer-newsletter.css?v=r2"), "live footer newsletter R2 stylesheet loader missing");
requireCheck(legalLinksJs.includes("/newsletter/subscribe"), "live footer newsletter API handler missing");
requireCheck(legalLinksJs.includes("data-footer-newsletter-consent"), "live footer newsletter consent UI missing");
requireCheck(legalLinksJs.includes("newsletter-success-modal"), "premium newsletter success modal missing");
requireCheck(legalLinksJs.includes("Dziękujemy za zapis!"), "premium newsletter success copy missing");
requireCheck(legalLinksJs.includes("await openNewsletterSuccess(submit)"), "footer newsletter success must open premium modal");
const footerNewsletterCss = fs.readFileSync(path.resolve(root, "assets/footer-newsletter.css"), "utf8");
requireCheck(footerNewsletterCss.includes("max-width:470px"), "footer newsletter: compact max width missing");
requireCheck(footerNewsletterCss.includes("height:44px !important"), "footer newsletter: compact field height missing");
requireCheck(footerNewsletterCss.includes(".newsletter-success .account-access__panel"), "newsletter success: account-size premium shell missing");
requireCheck(legalLinksJs.includes('/polityka-prywatnosci/#kontakt'), "contact modal: current privacy information link missing");
requireCheck(contactCss.includes('resize:none'), "contact modal: message textarea must not be resizable");
requireCheck(contactCss.includes('overflow-y:auto'), "contact modal: message textarea internal scrolling missing");
requireCheck(contactCss.includes('width:min(680px'), "contact modal: compact desktop width missing");
requireCheck(contactCss.includes('height:120px'), "contact modal: compact textarea height missing");
requireCheck(contactCss.includes('position:sticky'), "contact modal: sticky action bar missing");
requireCheck(legalLinksJs.includes('await ensureStyles()'), "contact modal: must wait for stylesheet before opening");
requireCheck(contactCss.includes('#56c8c1'), "forum nav: shared teal color #56c8c1 missing");
const searchCss = fs.readFileSync(path.resolve(root, "assets/search.css"), "utf8");
requireCheck(searchCss.includes('SEARCH R3 NAV HOVER DROPDOWN FIX'), "search nav: desktop hover dropdown clipping fix missing");
requireCheck(searchCss.includes('SEARCH R3 NAV SCALE R1'), "search nav: enlarged navigation scale missing");
requireCheck(searchCss.includes('min-width:220px'), "search nav: enlarged dropdown width missing");
requireCheck(searchCss.includes('font:700 12.5px/1.28'), "search nav: enlarged dropdown typography missing");

requireCheck(searchCss.includes('overflow:visible!important'), "search nav: desktop overflow escape missing");


if (failures.length) {
  console.error("SEO GATE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SEO GATE: PASS");
console.log(`homepage title: ${homeMeta.title.length} chars; description: ${homeMeta.description.length} chars`);
console.log(`games title: ${gamesMeta.title.length} chars; description: ${gamesMeta.description.length} chars`);
console.log(`regulation title: ${regulationMeta.title.length} chars; description: ${regulationMeta.description.length} chars`);
console.log(`games H1: ${gamesMeta.h1}`);
console.log(`games schema: ${[...gamesLd.types].sort().join(", ")}`);
console.log(`sitemap URLs: ${sitemapUrls.length}`);
console.log(`favicon-covered HTML pages: ${allHtmlPages.length}`);

