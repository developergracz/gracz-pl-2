import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Test the exact browser display helper, without connecting to production.
test('OWNER distinguishes expired DOI from an active subscription', async () => {
  const source=await readFile(new URL('../admin-r1/ui/owner-dashboard.js',import.meta.url),'utf8');
  const start=source.indexOf('function consentStateLabel(');
  const end=source.indexOf('\n}',start);
  assert.ok(start>=0 && end>start,'Display helper must exist');
  const labels={pending:'Oczekuje na DOI',active:'Aktywna',unsubscribed:'Wypisana'};
  const label=new Function('labels',source.slice(start,end+2)+';return consentStateLabel;')(labels);
  const at=Date.parse('2026-10-21T12:00:00+02:00');
  const requestedAt=new Date(at-31*60*1000).toISOString();
  assert.equal(label({state:'pending',requestedAt},at),'DOI wygasło — brak potwierdzenia');
  assert.equal(label({state:'pending',requestedAt:new Date(at-29*60*1000).toISOString()},at),'Oczekuje na DOI');
  assert.equal(label({state:'active',requestedAt},at),'Aktywna');
  assert.equal(label({state:'unsubscribed',requestedAt},at),'Wypisana');
  assert.equal(label({state:'pending',requestedAt:'invalid'},at),'Oczekuje na DOI');
  assert.match(source,/consentStateLabel\(item,moment\)/);
  assert.match(source,/consentStateLabel\(item,observedAt\)/);
  assert.match(source,/consentStateLabel\(data,Date\.parse\(data\.observedAt\)\)/);
});
