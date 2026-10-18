import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
test('newsletter page explicitly blocks submissions and preserves manual withdrawal route',()=>{
  const js=read('maintenance-site/assets/newsletter-full-max-r1.js');
  const html=read('maintenance-site/newsletter/index.html');
  assert.match(js,/NEWSLETTER_PUBLIC_INTAKE_ENABLED=false/);
  assert.match(js,/if\(!NEWSLETTER_PUBLIC_INTAKE_ENABLED\).*return/);
  assert.match(js,/actionButton\.disabled=true/);
  assert.match(js,/\['nl-submit','nl-request-button','nl-action-button'\]/);
  assert.match(html,/id="nl-maintenance-notice"/);
  assert.match(html,/mailto:czsocha@wp\.pl\?subject=/);
  assert.match(html,/nie oznacza automatycznego wypisania/i);
  assert.ok(html.indexOf('id="nl-maintenance-notice"')<html.indexOf('id="nl-subscribe-panel"'));
});
test('all shared footer forms are disabled before sending',()=>{
  const js=read('maintenance-site/assets/legal-links.js');
  assert.match(js,/NEWSLETTER_PUBLIC_INTAKE_ENABLED=false/);
  assert.match(js,/submit\.disabled=true/);
  assert.match(js,/email\.disabled=true/);
  assert.match(js,/if\(!NEWSLETTER_PUBLIC_INTAKE_ENABLED\)\{/);
  assert.match(js,/Informacja o niedostępności i wycofaniu zgody/);
});
