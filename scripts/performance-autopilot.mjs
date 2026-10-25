// GRACZ.PL Performance Autopilot R1: strictly allowlisted, idempotent static LCP repairs.
// This file has no network, credentials, HTML rewriting framework or runtime-site dependency.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const HOME = "index.html";
const HERO = Object.freeze({
  "gry-karciane/index.html": "gry-karciane-hero-reference.webp",
  "o-gracz-pl/index.html": "o-gracz-pl-hero-approved.webp"
});
const FONTS = ["montserrat-latin.woff2", "montserrat-latin-ext.woff2"];
const CONTACT = /^(?<indent>[ \t]*)<link rel="stylesheet" href="\/assets\/contact-modal\.css\?v=r8" data-contact-modal-style>[ \t]*\r?\n/gm;
const IMAGE_LINK = asset => `<link rel="preload" href="/assets/${asset}" as="image" type="image/webp" fetchpriority="high">`;

export function repairSite(root, {write = false} = {}) {
  const changed = [], warnings = [];
  const files = new Map();
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name === "index.html") {
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        files.set(relative, absolute);
      }
    }
  };
  visit(root);
  for (const [relative, absolute] of files) {
    let html = fs.readFileSync(absolute, "utf8");
    const original = html;
    // R1: remove only the known hidden contact modal stylesheet, after proving
    // the existing on-demand loader and trigger still exist.
    if (html.includes('href="/assets/contact-modal.css?v=r8"')) {
      if (html.includes('data-modal="contact"') &&
          html.includes('/assets/legal-links.js?v=') &&
          fs.existsSync(path.join(root,"assets/legal-links.js"))) {
        const next = html.replace(CONTACT, "");
        if (next === html) warnings.push(relative + ": unsupported contact stylesheet markup");
        else html = next;
      } else warnings.push(relative + ": no verified contact modal loader");
    }
    if (relative === HOME) {
      for (const font of FONTS) {
        const file = path.join(root, "assets/fonts", font);
        const re = new RegExp(`(<link rel="preload" href="/assets/fonts/${font.replaceAll(".", "\\.")}" as="font" type="font/woff2" crossorigin)(>)`);
        if (!fs.existsSync(file)) warnings.push(relative + ": missing approved font " + font);
        else if (re.test(html)) html = html.replace(re, '$1 fetchpriority="high"$2');
        else if (!html.includes(`href="/assets/fonts/${font}" as="font" type="font/woff2" crossorigin fetchpriority="high"`))
          warnings.push(relative + ": unsupported font markup " + font);
      }
    }
    if (Object.hasOwn(HERO,relative)) {
      const asset = HERO[relative];
      const file = path.join(root, "assets", asset);
      const preload = IMAGE_LINK(asset);
      const imgRe = new RegExp(`<img\\b[^>]*\\bsrc="/assets/${asset.replaceAll(".", "\\.")}"[^>]*>`, "i");
      const img = html.match(imgRe)?.[0];
      if (!fs.existsSync(file)) warnings.push(relative + ": missing hero asset " + asset);
      else if (!img) warnings.push(relative + ": hero image changed; requires review");
      else {
        if (!img.includes('fetchpriority="high"'))
          html = html.replace(img, img.replace(/>$/, ' fetchpriority="high">'));
        if (!html.includes(preload)) {
          if (html.includes(`href="/assets/${asset}"`))
            warnings.push(relative + ": unexpected preloading markup for " + asset);
          else html = html.replace("</head>", "  " + preload + "\n</head>");
        }
      }
    }
    if (html !== original) {
      changed.push(relative);
      if (write) fs.writeFileSync(absolute, html);
    }
  }
  return {changed:changed.sort(),warnings:warnings.sort()};
}
const main = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
  const action = process.argv.includes("--fix") ? "fix" : "audit";
  const root = path.resolve("maintenance-site");
  const report = repairSite(root,{write:action==="fix"});
  process.stdout.write(JSON.stringify({mode:action,...report})+"\n");
  if (report.warnings.length || (action === "audit" && report.changed.length))
    process.exitCode=1;
}
