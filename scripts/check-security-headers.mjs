import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('maintenance-site');
const CONTACT_API = 'https://gracz-contact-api.onrender.com';
const errors = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

const htmlFiles = walk(ROOT).filter(file => file.endsWith('.html'));
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file).replaceAll('\\', '/');
  const match = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/i);

  if (!match) {
    errors.push(`${rel}: missing CSP meta tag`);
    continue;
  }

  const policy = match[1];
  for (const required of [
    "default-src 'none'",
    "script-src 'self' https://www.googletagmanager.com",
    "style-src 'self'",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'"
  ]) {
    if (!policy.includes(required)) {
      errors.push(`${rel}: CSP missing required directive: ${required}`);
    }
  }

  const hasContactUi =
    html.includes('data-modal="contact"') ||
    html.includes('data-contact-modal-style') ||
    html.includes('/assets/contact-modal.css');

  if (hasContactUi && !policy.includes(CONTACT_API)) {
    errors.push(`${rel}: contact UI present but CSP connect-src does not allow ${CONTACT_API}`);
  }

  if (/script-src[^;]*\*/.test(policy) || /default-src[^;]*\*/.test(policy)) {
    errors.push(`${rel}: wildcard detected in script/default CSP directive`);
  }
}

const renderYaml = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
const expectedHeaders = new Map([
  ['Strict-Transport-Security', 'max-age=31536000'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()']
]);

for (const [name, value] of expectedHeaders) {
  if (!renderYaml.includes(`name: ${name}`) || !renderYaml.includes(`value: ${value}`) && !renderYaml.includes(`value: "${value}"`)) {
    errors.push(`maintenance-site/render.yaml: missing or unexpected ${name} header`);
  }
}

if (!renderYaml.includes('name: Content-Security-Policy')) {
  errors.push('maintenance-site/render.yaml: missing Content-Security-Policy response header');
}
if (!renderYaml.includes("frame-ancestors 'none'")) {
  errors.push("maintenance-site/render.yaml: response CSP must include frame-ancestors 'none'");
}
if (!renderYaml.includes(CONTACT_API)) {
  errors.push('maintenance-site/render.yaml: response CSP missing contact API in connect-src');
}

if (errors.length) {
  console.error('Security headers/CSP gate failed:');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log(`Security headers/CSP gate passed for ${htmlFiles.length} HTML files.`);
