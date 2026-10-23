import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {auditIndexability} from "./check-seo-auto-indexing.mjs";

const ROOT = "https://gracz.pl/";
const RULES = "User-agent: *\nAllow: /\n\nSitemap: https://gracz.pl/sitemap.xml\n";
const page = (canonical, directives = "index,follow", extra = "") =>
  '<!doctype html><html><head><title>gracz.pl — gry i poradniki</title>' +
  '<meta name="description" content="Polski portal gier gracz.pl, zasady i poradniki.">' +
  '<meta name="robots" content="' + directives + '">' +
  '<link rel="canonical" href="' + canonical + '">' + extra +
  '</head><body><h1>Gry na gracz.pl</h1></body></html>';
const sitemap = (urls) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((url) => '<url><loc>' + url + '</loc><lastmod>2026-10-02</lastmod></url>').join("\n") +
  '\n</urlset>';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gracz-seo-r1-"));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const write = (relative, data) => {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, data);
  };
  write("robots.txt", RULES);
  write("sitemap.xml", sitemap([ROOT]));
  write("index.html", page(ROOT));
  write("szukaj/index.html", page(ROOT + "szukaj/", "noindex,follow"));
  return {root, write};
}

test("valid public page and noindex-only search page pass", (t) => {
  const {root} = fixture(t);
  assert.deepEqual(auditIndexability(root), []);
});

test("a new public page must be added to the sitemap", (t) => {
  const {root, write} = fixture(t);
  write("gry/gomoku/index.html", page(ROOT + "gry/gomoku/"));
  assert.match(auditIndexability(root).join("\n"), /indexable page missing from sitemap/);
});

test("a private noindex page must never be included in the sitemap", (t) => {
  const {root, write} = fixture(t);
  write("sitemap.xml", sitemap([ROOT, ROOT + "szukaj/"]));
  assert.match(auditIndexability(root).join("\n"), /noindex page must not appear/);
});

test("wrong self-canonical fails before publish", (t) => {
  const {root, write} = fixture(t);
  write("index.html", page(ROOT + "gry/"));
  assert.match(auditIndexability(root).join("\n"), /expected one self-referencing canonical/);
});

test("Googlebot noindex on a public page is detected", (t) => {
  const {root, write} = fixture(t);
  write("index.html", page(ROOT, "index,follow", '<meta name="googlebot" content="noindex">'));
  assert.match(auditIndexability(root).join("\n"), /noindex page must not appear/);
});

test("duplicates and stale sitemap references are rejected", (t) => {
  const {root, write} = fixture(t);
  write("sitemap.xml", sitemap([ROOT, ROOT, ROOT + "nie-istnieje/"]));
  const result = auditIndexability(root).join("\n");
  assert.match(result, /duplicate URL/);
  assert.match(result, /not an indexable published HTML page/);
});

test("public page missing metadata is blocked", (t) => {
  const {root, write} = fixture(t);
  write("index.html", '<html><head><title>gracz.pl</title><meta name="robots" content="index,follow"></head><body></body></html>');
  const result = auditIndexability(root).join("\n");
  assert.match(result, /canonical/);
  assert.match(result, /meta description missing/);
  assert.match(result, /exactly one H1/);
});
