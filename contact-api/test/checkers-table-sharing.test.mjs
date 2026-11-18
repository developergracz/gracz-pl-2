import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import qrcode from '../auth/assets/qrcode.mjs';
import {checkersLossHtml,checkersLossCss,checkersLossJs} from '../auth/checkers-loss-popup.mjs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';

test('Warcaby lobby exposes owner edit, QR, send and an accessible sharing dialog',()=>{
 for(const label of ['Edytuj','Kod QR','Wyślij'])assert.ok(checkersLossJs.includes(label));
 for(const id of ['warcaby-share-overlay','warcaby-share-link','warcaby-share-qr',
  'warcaby-tables-form-heading','warcaby-tables-save'])
  assert.ok(checkersLossHtml.includes(id),id);
 assert.ok(checkersLossHtml.includes('aria-modal="true"'));
 assert.ok(checkersLossJs.includes("if(!item.mine||item.status!=='waiting'"));
 assert.ok(checkersLossJs.includes("action:editId?'edit':'create'"));
 assert.ok(checkersLossJs.includes("new URL('/konto/warcaby/',location.origin)"));
 assert.ok(checkersLossJs.includes('if(UUID.test(invited))openTables(invited)'));
 assert.ok(checkersLossCss.includes('.warcaby-tables-actions'));
 assert.ok(checkersLossCss.includes('.warcaby-share-overlay[hidden]'));
});

test('QR generator creates a local SVG from an invitation URL',()=>{
 const url='https://gracz.pl/konto/warcaby/?table=12345678-1234-4234-8234-1234567890ab';
 const qr=qrcode(0,'L');qr.addData(url);qr.make();
 assert.ok(qr.getModuleCount()>=21);
 const svg=qr.createSvgTag({cellSize:5,margin:5});
 assert.match(svg,/^<svg /);
 assert.match(svg,/<path /);
 assert.match(svg,/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});

test('QR generator is served by existing same-origin Warcaby endpoint',()=>{
 const url=new URL('https://gracz.pl/konto/warcaby/qr.mjs');
 let output='',headers={},status=0;
 const res={writeHead(s,h){status=s;headers=h},end(s){output=s}};
 assert.equal(serveCheckersConsole({method:'GET'},res,url),true);
 assert.equal(status,200);
 assert.match(headers['Content-Type'],/application\/javascript/);
 assert.ok(output.includes('export default qrcode;'));
 assert.equal(output,readFileSync(new URL('../auth/assets/qrcode.mjs',import.meta.url),'utf8'),
  'inline QR source must remain byte-for-byte identical to audited vendor file');
 assert.equal(serveCheckersConsole({method:'POST'},res,url),false);
});
