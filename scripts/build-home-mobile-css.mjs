// Exact order-preserving mobile subset of the approved homepage CSS bundle.
// Only @media blocks that cannot match any viewport <=680 CSS px are removed.
import fs from "node:fs";
import assert from "node:assert/strict";

export function mobileCss(source) {
  const media = /@media\s*([^{}]+)\{/gi;
  let result = "", cursor = 0, match, removed = 0;
  while ((match = media.exec(source)) !== null) {
    let i = media.lastIndex, depth = 1;
    for (; i < source.length && depth; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
    }
    if (depth !== 0) throw Error("Unbalanced @media block");
    const minWidths = [...match[1].matchAll(/\bmin-width\s*:\s*(\d+(?:\.\d+)?)px/gi)]
      .map(x => Number(x[1]));
    if (minWidths.length && minWidths.every(x => x >= 681)) {
      result += source.slice(cursor, match.index);
      cursor = i;
      removed++;
    }
    media.lastIndex = i;
  }
  result += source.slice(cursor);
  assert.ok(removed > 0 && result.length < source.length, "Expected desktop-only CSS");
  return {css: result, removed};
}

const sourcePath = "maintenance-site/assets/home-lcp-bundle-r1.css";
const mobilePath = "maintenance-site/assets/home-lcp-bundle-r1-mobile.css";
if (process.argv[1]?.endsWith("build-home-mobile-css.mjs")) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const {css, removed} = mobileCss(source);
  if (process.argv.includes("--check")) {
    assert.equal(fs.readFileSync(mobilePath, "utf8"), css,
      "Mobile stylesheet must be the exact generated mobile subset");
  } else fs.writeFileSync(mobilePath, css);
  console.log(JSON.stringify({state:"PASS",sourceBytes:source.length,
    mobileBytes:css.length,removedDesktopMediaBlocks:removed}));
}
