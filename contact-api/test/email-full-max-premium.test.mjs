import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.doesNotMatch(html,/<img\b|<iframe\b/);
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
