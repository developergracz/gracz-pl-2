import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPremiumEmail} from '../email/full-max-premium.mjs';
import {createOwnerRecoveryMailer} from '../admin-r1/owner-recovery-mailer.mjs';

test('premium mail escapes user content, has correct brand and accessible CTA',()=>{
  const html=renderPremiumEmail({
    category:'NEWSLETTER',title:'Nowości <promo>',
    body:'Witaj <script>alert(1)</script> &amp; więcej',
    actionUrl:'https://gracz.pl/newsletter/#confirm=ni3.synthetic',
    actionLabel:'Potwierdź zapis',
    unsubscribeUrl:'https://gracz.pl/newsletter/#nl-withdrawal-panel'
  });
  assert.match(html,/gracz<span style="color:#ef5261">\.pl<\/span>/);
  assert.match(html,/Nowości &lt;promo&gt;/);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script\b/);
  assert.match(html,/Potwierdź zapis<\/a>/);
  assert.match(html,/Wypisz się z newslettera/);
  assert.match(html,/<img src="https:\/\/gracz\.pl\/assets\/gracz-envelope-yellow-spade\.png" width="54" height="54" alt="Koperta z żółtym pikiem"/);
  assert.equal((html.match(/<img\b/g)||[]).length,1,'Only the approved first-party branding image may load');
  assert.doesNotMatch(html,/<iframe\b/);
});

test('approved mail identity keeps only white-red gracz.pl and thin-seam yellow-spade envelope',()=>{
  const markup=renderPremiumEmail({title:'Potwierdź zapis',body:'Powiadomienie'});
  assert.match(markup, /color:#fff">gracz<span style="color:#ef5261">\.pl<\/span>/);
  const svg=readFileSync(new URL('../../maintenance-site/.well-known/bimi/gracz-envelope-yellow-spade.svg',import.meta.url),'utf8');
  assert.match(svg,/baseProfile="tiny-ps"/);
  assert.match(svg,/<rect x="22" y="63" width="212" height="137" rx="15" fill="#FFFFFF"\/>/);
  assert.match(svg,/stroke="#CED3D9" stroke-width="1\.15"/);
  assert.match(svg,/fill="#FFCC21"/);
  assert.doesNotMatch(svg,/<text\b|<script\b|<image\b/i);
  const png=readFileSync(new URL('../../maintenance-site/assets/gracz-envelope-yellow-spade.png',import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(png.length>100,'Approved SVG raster must be available as lossless PNG');

});

test('premium mail disallows external, insecure and credential-bearing action URLs',()=>{
  for(const actionUrl of ['http://gracz.pl/x','https://evil.example.test/x',
    'https://gracz.pl.evil.example.test/', 'https://evil@gracz.pl/']){
    assert.throws(()=>renderPremiumEmail({title:'Test',actionUrl,actionLabel:'Kliknij'}));
  }
  assert.throws(()=>renderPremiumEmail({title:'Test',actionUrl:'https://gracz.pl/'}));
});

test('OWNER one-time recovery secret is shown as a code, never embedded in a URL',async()=>{
  let sent;const code='A'.repeat(24);
  const mailer=createOwnerRecoveryMailer({
    apiKey:'synthetic-owner-recovery-key',emailFrom:'gracz.pl <admin@gracz.pl>',
    request:async(_url,options)=>{sent=JSON.parse(options.body);return {status:201,json:async()=>({id:'synthetic'})};}
  });
  assert.ok(mailer);
  assert.equal(await mailer.send({email:'admin@example.test',code,purpose:'verify'}),true);
  assert.match(sent.html,/KOD JEDNORAZOWY/);
  assert.ok(sent.html.includes(code));
  assert.doesNotMatch(sent.html,/href="[^"]*A{24}/);
  assert.ok(sent.text.includes(code));
});


test('targeted Markdown email renders formatting safely and leaves non-targeted content plain',()=>{
  const body='**Witaj** *graczu* ++ważne++\n- Pierwsza wiadomość\n- Druga wiadomość\n[Odwiedź](https://gracz.pl/poradniki/)\n<script>alert(1)</script> [klik](javascript:alert(1))';
  const premium=renderPremiumEmail({title:'Nowości gracz.pl',body,bodyMarkdown:true});
  assert.match(premium,/<strong>Witaj<\/strong>/);
  assert.match(premium,/<em>graczu<\/em>/);
  assert.match(premium,/<u>ważne<\/u>/);
  assert.match(premium,/<ul[^>]*>/);
  assert.match(premium,/<a href="https:\/\/gracz.pl\/poradniki\/"/);
  assert.match(premium,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(premium,/<script\b|href\s*=\s*["\']?\s*javascript:/i);
  const plain=renderPremiumEmail({title:'Nowości',body});
  assert.ok(plain.includes('**Witaj**'));
  assert.doesNotMatch(plain,/<strong>Witaj<\/strong>/);
});

test('campaign title and message keep white gracz and red .pl in Gmail',()=>{
  const brand='<span style="color:#ffffff !important;text-decoration:none">gracz</span>'+
    '<span style="color:#ef5261 !important;text-decoration:none">.pl</span>';
  const html=renderPremiumEmail({
    title:'Test kampanii gracz.pl',
    body:'Nowości gracz.pl i https://gracz.pl/poradniki/ oraz admin@gracz.pl',
    footnote:'Subskrybujesz newsletter gracz.pl.'
  });
  assert.ok(html.includes('Test kampanii '+brand+'</h1>'));
  assert.ok(html.includes('Nowości '+brand+' i https://gracz.pl/poradniki/'));
  assert.ok(html.includes('oraz admin@gracz.pl'));
  assert.ok(html.includes('newsletter '+brand+'.'));
  assert.doesNotMatch(html,/<h1[^>]*>Test kampanii gracz\.pl<\/h1>/);
});

test('brand styling preserves safe markdown links and HTML escaping',()=>{
  const html=renderPremiumEmail({
    title:'gracz.pl <script>',
    body:'**gracz.pl** [gracz.pl](https://gracz.pl/) <img src=x>',
    bodyMarkdown:true
  });
  assert.match(html,/<h1[^>]*><span style="color:#ffffff !important;text-decoration:none">gracz<\/span>/);
  assert.match(html,/<strong><span style="color:#ffffff !important;text-decoration:none">gracz<\/span>/);
  assert.match(html,/<a href="https:\/\/gracz\.pl\/" style="color:#8be6df;text-decoration:underline">/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&lt;img src=x&gt;/);
  assert.doesNotMatch(html,/<script\b|<img src=x>/i);
  assert.equal((html.match(/<img\b/g)||[]).length,1);
});

test('campaign preview is blank with cross-client invisible padding, branding remains untouched',()=>{
  const mail=renderPremiumEmail({category:'NEWSLETTER · GRACZ.PL',
    title:'Temat dnia na gracz.pl !',preheader:'\\u034f\\u200c',
    preheaderPadding:true,
    body:'To jest przykładowa treść newslettera gracz.pl.'
  });
  const snippet=mail.match(/<div aria-hidden="true" style="([^"]+)">([\\s\\S]*?)<\\/div>/);
  assert.ok(snippet,'Preview spacer must be first in the HTML body');
  assert.ok(!snippet[1].includes('display:none'),'WP mail may omit elements with display:none from snippet extraction');
  assert.ok(snippet[1].includes('max-height:0;')&&snippet[1].includes('overflow:hidden;'));
  assert.equal((snippet[2].match(/&#847;&zwnj;&nbsp;&shy;/g)||[]).length,320);
  assert.ok(!snippet[2].includes('Temat dnia')&&!snippet[2].includes('To jest przykładowa'));
  assert.ok(mail.indexOf(snippet[0])<mail.indexOf('FULL MAX PREMIUM'));
  assert.ok(mail.includes('To jest przykładowa treść'));
  assert.ok(mail.includes('gracz<span style="color:#ef5261">.pl</span>'));
  const other=renderPremiumEmail({title:'Zapis potwierdzony',body:'Witaj!'});
  assert.match(other,/display:none;max-height:0/,'Transactional messages keep their previous preheader');
});
