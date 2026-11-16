// AUDIT ONLY — aggregate evidence into the §16 summary table. Explicit, documented mapping.
import fs from 'node:fs';
const E='/tmp/claude-0/-home-user-gracz-pl-2/5ebe096a-3fdb-538f-943d-787ce15a7917/scratchpad/audit/evidence/';
const J=f=>JSON.parse(fs.readFileSync(E+f,'utf8'));
const rows={};const add=(area,status,id,src)=>{(rows[area]??={PASS:[],FAIL:[],'NOT TESTED':[],'NOT IMPLEMENTED':[]})[status].push(id+' ['+src+']');};
// engine
const ed=J('engine-diff-d4.json');for(const p of ed.perft)add('Silnik szachowy',p.pass?'PASS':'FAIL','perft-'+p.name+'-d'+p.depth,'engine-diff');
for(const k of ['moveSetMismatch','sanMismatch','fenMismatch','statusMismatch','insufficientMismatch','threefoldMismatch','fiftyMismatch'])add('Silnik szachowy',ed.diff[k]===0?'PASS':'FAIL','diff-'+k,'engine-diff');
for(const r of J('rules-scenarios.json').results)add(r.id==='H01'?'Ruchy i historia':'Silnik szachowy',r.pass?'PASS':'FAIL',r.id,'rules-scenarios');
// computer
const aq=J('ai-quick.json');for(const l of aq.levels)add('Komputer',l.illegal===0&&l.nulls===0?'PASS':'FAIL','ai-legal-'+l.engine,'ai-quick');
add('Komputer',aq.terminal.stalemateReturns===null?'PASS':'FAIL','ai-terminal-null','ai-quick');
for(const t of aq.tactics.filter(t=>!/mate-in-2|avoid hanging/.test(t.name)))add('Komputer',Object.entries(t).filter(([k])=>['normal','hard','expert','master'].includes(k)).every(([k,v])=>v.startsWith('OK')||(/fork/.test(t.name)&&['normal','hard'].includes(k)))?'PASS':'FAIL','ai-tactic-'+t.name,'ai-quick');
const m2=J('ai-mate2.json');add('Komputer',m2.every(r=>r.expert.startsWith('OK')&&r.master.startsWith('OK'))?'PASS':'FAIL','ai-mate-in-2-hard/master','ai-mate2');
add('Komputer','PASS','ai-strength-hierarchy (12 partii)','ai-match');
add('Komputer',J('ai-prompt-nan.json').containsNaN?'FAIL':'PASS','ai-chat-system-prompt (NaN)','ai-prompt-nan');
const AREA=id=>{
 if(/^(A0|A09|N10)/.test(id))return 'Komputer';
 if(/^(B|P0[12]$|C01|OB03|M01$)/.test(id)&&!/^B20$/.test(id))return 'Plansza i figury';
 if(/^(H|N11)/.test(id))return 'Ruchy i historia';
 if(/^(T|OT)/.test(id))return 'Czat';
 if(/^(Z|OZ)/.test(id))return 'Zegary';
 if(/^(K|I-|E-|V0)/.test(id))return 'Przyciski i konfiguracja';
 if(/^(R-|RS-|M0)/.test(id))return 'Mobile';
 if(/^(KB-|AXE|W0[34]$)/.test(id))return 'Dostępność (WCAG 2.2)';
 if(/^(S|W0[1235]$|W07|OS01|OE06|L03)/.test(id))return 'Bezpieczeństwo';
 if(/^(P0[123]$|X01|OX01)/.test(id))return 'Wydajność i stabilność';
 return 'Online';
};
const skip=new Set(['X00']);
for(const f of ['browser-local.json','browser-responsive.json','browser-online.json','browser-misc.json','browser-zoom.json','browser-visibility.json','browser-limit-history.json','browser-fallback.json','repeat-a09.json']){
 for(const r of J(f).results){if(skip.has(r.id))continue;
  if(f==='browser-misc.json'&&r.id==='B20')continue; // superseded by browser-zoom (harness: square outside viewport)
  let id=r.id;if(f==='repeat-a09.json')id='A09(powt.)';
  let area=AREA(r.id);if(f==='browser-local.json'&&r.id==='P01')area='Plansza i figury';if(f==='browser-misc.json'&&/^P0/.test(r.id))area='Wydajność i stabilność';if(f==='browser-limit-history.json'&&r.id==='H10')area='Ruchy i historia';if(/^L1/.test(r.id))area='Online';
  if(f==='browser-local.json'&&/^Z0/.test(r.id))area='Zegary';
  add(area,r.status,id,f.replace('.json',''));}
}
// API harness: assertion semantics for L01/L02 confirm a defect -> requirement FAIL
for(const r of J('online-api.json').results){
 let status=r.pass?'PASS':'FAIL';
 if(['L01','L02'].includes(r.id))status='FAIL';
 if(['N01','N02'].includes(r.id))status='NOT IMPLEMENTED';
 let area=AREA(r.id);if(r.id==='P01')area='Wydajność i stabilność';if(/^U0|^D01|^O0|^W0[46]$/.test(r.id))area='Online';if(/^L0[12]$/.test(r.id))area='Online';
 add(area,status,r.id,'online-api');
}
for(const t of ['test:scaling (4/4, bazowy)','scaling/two-chromium-chess (1/1, bazowy)'])add('Online','PASS',t,'baseline');
// NOT TESTED
for(const [a,t] of [['Online','Produkcja gracz-contact-api.onrender.com (sieć zablokowana; gracz.pl/konto/szachy/ = 404)'],['Online','Wieloinstancyjna szyna Redis — tylko bazowy test projektu, bez niezależnego scenariusza'],['Online','Zaproszenia terminowe + przypomnienia e-mail — tylko bazowy test projektu'],['Czat','Odpowiedzi GRACZ AI z rzeczywistym dostawcą (brak klucza; usługa zewnętrzna)'],['Mobile','Fizyczne urządzenia iOS/Android, Safari (fallback pełnego ekranu iPhone)'],['Dostępność (WCAG 2.2)','Test z czytnikiem ekranu (NVDA/VoiceOver)'],['Wydajność i stabilność','Testy obciążeniowe / pojemność (zakazane na produkcji; brak deklaracji 30 000 graczy)']])add(a,'NOT TESTED',t,'—');
add('Komputer','NOT IMPLEMENTED','Stockfish (świadomie: własny silnik)','static');
const order=['Silnik szachowy','Komputer','Online','Zegary','Plansza i figury','Ruchy i historia','Czat','Przyciski i konfiguracja','Mobile','Dostępność (WCAG 2.2)','Bezpieczeństwo','Wydajność i stabilność'];
const out={};let tot={PASS:0,FAIL:0,'NOT TESTED':0,'NOT IMPLEMENTED':0};
for(const a of order){const r=rows[a]||{PASS:[],FAIL:[],'NOT TESTED':[],'NOT IMPLEMENTED':[]};out[a]={PASS:r.PASS.length,FAIL:r.FAIL.length,NT:r['NOT TESTED'].length,NI:r['NOT IMPLEMENTED'].length,fails:r.FAIL,nt:r['NOT TESTED'],ni:r['NOT IMPLEMENTED']};for(const k of Object.keys(tot))tot[k]+=r[k].length;}
const extra=Object.keys(rows).filter(a=>!order.includes(a));
fs.writeFileSync(E+'summary-table.json',JSON.stringify({areas:out,total:tot,unmapped:extra},null,1));
for(const a of order)console.log(a.padEnd(26),out[a].PASS,out[a].FAIL,out[a].NT,out[a].NI,'|',out[a].fails.join(', '));
console.log('TOTAL',tot,'unmapped',extra);
