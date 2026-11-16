// AUDIT ONLY — §11 responsiveness (9 viewports), keyboard focus, axe WCAG scan, touch, orientation.
import fs from 'node:fs';
import {chromium,startServer,user,friends,challenge,context,open,log,save,cleanup,sq,pieces,sleep,SHOTS,AUDIT} from './bh.mjs';
const srv=await startServer();const base=srv.base;
const browser=await chromium.launch({headless:true});
const T=async(id,area,desc,fn)=>{try{const r=await fn();log(id,area,desc,r.pass,r.actual,r.extra||{});}catch(e){log(id,area,desc,false,'EXCEPTION '+String(e.message).slice(0,300));}};
const VIEWPORTS=[[1920,1080],[1600,900],[1366,768],[1280,720],[1024,768],[768,1024],[390,844],[375,667],[320,568]];
const metrics=page=>page.evaluate(()=>{
 const vw=innerWidth,vh=innerHeight,R=e=>e?e.getBoundingClientRect():null,vis=e=>{if(!e)return false;const r=e.getBoundingClientRect();return r.width>1&&r.height>1&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden';};
 const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
 const board=R(q('#board')),cells=qa('#board .chess-square').map(R);
 const keys={clockBlack:q('#clock-1'),clockWhite:q('#clock-2'),mail:q('.cc-mail'),profile:q('.cc-profile'),...Object.fromEntries(qa('.chess-reference-actions button').filter(vis).map((b,i)=>['action'+i+'_'+b.innerText.trim(),b])),...Object.fromEntries(qa('.cc-tools .cc-tool').map(b=>['tool_'+b.dataset.tool,b])),chatTab:q('#chat-tab'),movesTab:q('#history-tab'),infoTab:q('#chess-final-info-tab'),modeComputer:q('#training-mode'),modeOnline:q('#online-mode'),chatInput:q('#chat-input'),send:q('#chat-send')};
 const boxes={};for(const [k,e] of Object.entries(keys))if(vis(e)){const r=R(e);boxes[k]={x:r.x,y:r.y,w:r.width,h:r.height,clipped:e.scrollWidth>e.clientWidth+2&&e.tagName!=='INPUT',outside:r.left<-1||r.right>vw+1};}
 const overlaps=[];const ks=Object.keys(boxes);for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const a=boxes[ks[i]],b=boxes[ks[j]];const ix=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),iy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(ix>2&&iy>2)overlaps.push(ks[i]+'×'+ks[j]);}
 const missing=Object.entries(keys).filter(([k,e])=>e&&!vis(e)&&!/send|chatInput/.test(k)).map(([k])=>k);
 const clippedText=qa('.side-dock button,.side-dock a,.side-dock label,.players *').filter(vis).filter(e=>e.children.length===0&&e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflow!=='visible').map(e=>(e.id||e.className||e.tagName)+':'+e.textContent.trim().slice(0,20));
 const minCell=Math.min(...cells.map(c=>Math.min(c.width,c.height)));
 const smallTargets=qa('.side-dock button,.side-dock a,.side-dock select,.side-dock input').filter(vis).filter(e=>{const r=R(e);return r.width<24||r.height<24;}).map(e=>(e.id||e.className.split?.(' ')[0]||e.tagName)+' '+Math.round(e.getBoundingClientRect().width)+'×'+Math.round(e.getBoundingClientRect().height));
 return {vw,vh,hScroll:document.documentElement.scrollWidth>vw+1,scrollWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,
  board:{x:Math.round(board.x),y:Math.round(board.y),w:Math.round(board.width),h:Math.round(board.height),square:Math.abs(board.width-board.height)<2,inViewportX:board.left>=-1&&board.right<=vw+1,fullyAboveFold:board.bottom<=vh},minCell:Math.round(minCell),
  overlaps,missing,outside:Object.entries(boxes).filter(([k,b])=>b.outside).map(([k])=>k),clipped:Object.entries(boxes).filter(([k,b])=>b.clipped).map(([k])=>k),clippedText,smallTargets,
  clockFont:parseFloat(getComputedStyle(q('#clock-2')).fontSize)};
});
try{
 for(const [w,h] of VIEWPORTS){
  const ctx=await context(browser,base,null,{viewport:{width:w,height:h}});const errors=[];const page=await open(ctx,base+'/konto/szachy/',errors);await sleep(400);
  const m=await metrics(page);await page.screenshot({path:SHOTS+`/10-viewport-${w}x${h}.png`,fullPage:true});
  const ok=!m.hScroll&&m.board.square&&m.board.inViewportX&&m.overlaps.length===0&&m.missing.length===0&&m.outside.length===0&&m.clipped.length===0;
  log('R-'+w+'x'+h,'mobile/responsywność',`Viewport ${w}×${h}: brak poziomego przewijania, plansza kwadratowa i w kadrze, brak nakładania/przycięć kluczowych kontrolek`,ok,m);
  // sheet fits
  await page.locator('.cc-tool[data-tool="settings"]').click();await sleep(200);
  const sheet=await page.evaluate(()=>{const s=document.getElementById('cc-sheet-settings').getBoundingClientRect();return {x:Math.round(s.x),w:Math.round(s.width),right:Math.round(s.right),vw:innerWidth,hScroll:document.documentElement.scrollWidth>innerWidth+1};});
  await page.keyboard.press('Escape');
  log('RS-'+w+'x'+h,'mobile/responsywność',`Viewport ${w}×${h}: arkusz Ustawienia mieści się w szerokości ekranu`,sheet.x>=0&&sheet.right<=sheet.vw+1&&!sheet.hScroll,sheet);
  if(w===1600||w===390||w===320){
   // keyboard Tab traversal with :focus-visible
   const seen=[];for(let i=0;i<70;i++){await page.keyboard.press('Tab');const f=await page.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return {k:(e.id||'')+'|'+(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,30),indicator:(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)||cs.boxShadow!=='none',onScreen:r.width>0&&r.height>0};});if(f)seen.push(f);}
   const uniq=[...new Map(seen.map(s=>[s.k,s])).values()];const noInd=uniq.filter(s=>!s.indicator);const off=uniq.filter(s=>!s.onScreen);
   log('KB-'+w,'dostępność',`Tab ${w}px: widoczny wskaźnik fokusu (:focus-visible) na każdym elemencie`,noInd.length===0,{visited:uniq.length,withoutIndicator:noInd.map(s=>s.k).slice(0,20),invisibleFocusTargets:off.map(s=>s.k).slice(0,10)});
  }
  await ctx.close();
 }
 // axe with CSP bypass only for the scanner
 for(const [w,h,label] of [[1600,900,'desktop'],[390,844,'telefon']]){
  const ctx=await context(browser,base,null,{viewport:{width:w,height:h},bypassCSP:true});const page=await open(ctx,base+'/konto/szachy/');
  await page.addScriptTag({path:AUDIT+'/ref/node_modules/axe-core/axe.min.js'});
  const r=await page.evaluate(async()=>{const x=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return x.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length,help:v.help,sample:v.nodes.slice(0,4).map(n=>({t:n.target.join(' '),s:n.failureSummary?.split('\n').slice(0,2).join(' ')}))}));});
  fs.writeFileSync(AUDIT+`/evidence/axe-${label}.json`,JSON.stringify(r,null,1));
  log('AXE-'+label,'dostępność',`axe-core WCAG 2.x A/AA (${label} ${w}×${h}) — tryb Komputer`,r.length===0,r.map(v=>v.id+'('+v.impact+'):'+v.nodes));
  await ctx.close();
 }
 // touch on phone
 {const ctx=await context(browser,base,null,{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});const page=await open(ctx,base+'/konto/szachy/');
  await page.locator('#board .chess-square').nth(sq('e2')).tap();await page.locator('#board .chess-square').nth(sq('e4')).tap();
  await page.waitForFunction(()=>document.getElementById('move-count').textContent!=='Ruchy: 0',{timeout:8000});
  const p=await pieces(page);log('M01','mobile','Dotyk (tap-tap) na telefonie 390×844 wykonuje ruch',p[sq('e4')]==='P',{e4:p[sq('e4')],count:await page.locator('#move-count').textContent()});
  await page.screenshot({path:SHOTS+'/11-phone-touch-after-move.png'});
  // orientation change
  await page.setViewportSize({width:844,height:390});await sleep(500);const land=await metrics(page);await page.screenshot({path:SHOTS+'/12-phone-landscape-844x390.png',fullPage:true});
  log('M02','mobile','Zmiana orientacji 390×844 → 844×390: brak poziomego przewijania, plansza widoczna, stan gry zachowany',!land.hScroll&&land.board.square&&(await pieces(page))[sq('e4')]==='P',{hScroll:land.hScroll,board:land.board,overlaps:land.overlaps,missing:land.missing});
  await page.setViewportSize({width:390,height:844});await sleep(300);
  // fullscreen on mobile emulation
  await page.locator('.cc-tool[data-tool="fullscreen"]').tap();await sleep(600);const fs1=await page.evaluate(()=>({fs:!!document.fullscreenElement,focus:document.getElementById('game').classList.contains('game-focus')}));
  await page.screenshot({path:SHOTS+'/13-phone-fullscreen.png'});
  log('M03','mobile','Pełny ekran na telefonie (lub fallback „Sama gra”)',fs1.fs||fs1.focus,fs1);
  await ctx.close();}
 // Online mode on phone with a real match: clocks, board, chat reachable
 {const A=await user('Rsp'),B=await user('Rsq');await friends(A,B);const id=await challenge(A,B,5,0);
  const ctx=await context(browser,base,A,{viewport:{width:375,height:667},hasTouch:true,isMobile:true});const page=await open(ctx,base+'/konto/szachy/?match='+id);await sleep(1500);
  const m=await metrics(page);await page.screenshot({path:SHOTS+'/14-online-375x667.png',fullPage:true});
  log('M04','mobile','Online 375×667: brak poziomego przewijania, brak nakładania zegarów/ikon',!m.hScroll&&m.overlaps.length===0&&m.missing.length===0,{hScroll:m.hScroll,overlaps:m.overlaps,missing:m.missing,clockFont:m.clockFont,minCell:m.minCell});
  await ctx.close();}
}catch(e){log('X00','harness','Wyjątek',false,String(e.stack).slice(0,600));}
finally{await browser.close();srv.child.kill('SIGKILL');await cleanup();save('browser-responsive');process.exit(0);}
