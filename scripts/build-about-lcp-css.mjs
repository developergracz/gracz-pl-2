// Deterministic page-local CSS elimination for /o-gracz-pl/ only.
// Never mutate shared poradniki.css, styles for other pages, or CSS source order.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {compact} from './check-home-premium-css-compact.mjs';

const dir='maintenance-site/';
const sourceFiles=[
  'cookie-consent.css',
  'poradniki.css',
  'o-gracz-pl.css',
  'related-thumbnails.css',
  'unified-subpage-hero.css'
];
const usedByFiles=[
  'o-gracz-pl/index.html',
  'assets/o-gracz-pl.js',
  'assets/legal-links.js',
  'assets/sticky-sidebars.js',
  'assets/cookie-consent.js'
];
const output=dir+'assets/o-gracz-pl-lcp-bundle-r1.css';

export function pruneAboutOnly(css, referenceText) {
  // Keep every selector with dynamic/functional pseudo classes or attributes.
  // Remove a rule only when ALL comma-separated alternatives require a CSS
  // class absent from both this page's markup and all scripts it loads.
  return css.replace(/([^{}]+)\{([^{}]*)\}/g,(whole,rawSelector)=>{
    const selector=rawSelector.trim();
    if(selector.startsWith('@')||/:not\(|:is\(|:where\(|:has\(/.test(selector))return whole;
    if(/[\\[\\]\\\\]/.test(selector))return whole;
    const impossible=selector.split(',').every(part=>{
      const classes=[...part.matchAll(/\.([A-Za-z][\w-]*)/g)].map(x=>x[1]);
      return classes.some(name=>!referenceText.includes(name));
    });
    return impossible?'':whole;
  });
}
export function buildAboutBundle() {
  const ref=usedByFiles.map(n=>fs.readFileSync(dir+n,'utf8')).join('\n');
  return compact(sourceFiles.map(n=>{
    const css=fs.readFileSync(dir+'assets/'+n,'utf8');
    return n==='poradniki.css'?pruneAboutOnly(css,ref):css;
  }).join('\n'));
}
const invoked=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(invoked) {
  const expected=buildAboutBundle();
  if(process.argv.includes('--write'))fs.writeFileSync(output,expected);
  else assert.equal(fs.readFileSync(output,'utf8'),expected,
    'About CSS must be deterministically derived from page markup, scripts and approved source styles');
  console.log(JSON.stringify({state:'PASS',bytes:expected.length}));
}
