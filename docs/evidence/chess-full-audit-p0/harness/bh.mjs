// AUDIT ONLY — shared browser harness: isolated production router + console, disposable accounts.
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire('/opt/node-tools/node_modules/');
export const {chromium}=require('playwright');
const {createDatabase}=await import('/home/user/gracz-pl-2/contact-api/persistence/database.mjs');
const {assertDisposableDatabaseUrl}=await import('/home/user/gracz-pl-2/contact-api/integration/test-database-guard.mjs');
assertDisposableDatabaseUrl(process.env.DATABASE_URL);
export const AUDIT='/tmp/claude-0/-home-user-gracz-pl-2/5ebe096a-3fdb-538f-943d-787ce15a7917/scratchpad/audit';
export const SHOTS=AUDIT+'/evidence/screenshots';fs.mkdirSync(SHOTS,{recursive:true});
export const HOST='https://gracz-contact-api.onrender.com';
const hash=x=>createHash('sha256').update(x).digest();
export const sq=s=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
export const results=[];
export function log(id,area,desc,pass,actual,extra={}){
 const status=pass===null?'NOT TESTED':pass==='NI'?'NOT IMPLEMENTED':pass?'PASS':'FAIL';
 results.push({id,area,desc,status,actual,...extra});
 console.error(status.padEnd(15)+id+' '+desc+' '+JSON.stringify(actual).slice(0,260));
}
export async function startServer(){
 const child=fork('/home/user/gracz-pl-2/contact-api/scaling/browser-instance.mjs',{env:{...process.env},stdio:['ignore','pipe','pipe','ipc']});
 let errs='';child.stderr.on('data',x=>errs+=x);child.stdout.on('data',x=>errs+=x);
 const [{port}]=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('server died '+errs)})]);
 return {child,base:'http://localhost:'+port,port,logs:()=>errs};
}
export const db=createDatabase();
const made=[];
export async function user(tag){
 const id=randomUUID(),token=randomBytes(32).toString('hex'),nick=('Aud'+tag+id.replaceAll('-','')).slice(0,18);
 await db.query('INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES($1,$2,$3,$4,$5,$5,now())',[id,nick,nick.toLowerCase(),nick.toLowerCase()+'@example.invalid',Buffer.alloc(64)]);
 await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval '3 hours')",[hash(token),id]);
 const u={id,token,nick,tag};made.push(u);return u;
}
export async function friends(a,b){await db.query("INSERT INTO gracz_public_identity.friend_connections(account_a,account_b,requested_by,status) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,'accepted') ON CONFLICT DO NOTHING",[a.id,b.id]);}
export async function challenge(a,b,minutes=0,inc=0){const id=randomUUID();await db.query("INSERT INTO gracz_public_identity.game_challenges(id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds) VALUES($1,$2,$3,'szachy','accepted',$4,$5)",[id,a.id,b.id,minutes,inc]);return id;}
export async function setState(id,mutate){
 const r=await db.query('SELECT state FROM gracz_public_identity.game_matches WHERE challenge_id=$1',[id]);
 const state=mutate(structuredClone(r.rows[0].state));
 await db.query('UPDATE gracz_public_identity.game_matches SET state=$1::jsonb,version=version+1 WHERE challenge_id=$2',[JSON.stringify(state),id]);
}
export async function readMatch(base,u,id){const r=await fetch(base+'/auth/match?id='+id,{headers:{Cookie:'__Host-gracz_session='+u.token,Origin:HOST}});return {status:r.status,...await r.json()};}
export async function context(browser,base,u,opts={}){
 const ctx=await browser.newContext({viewport:{width:1600,height:900},...opts});
 if(u)await ctx.addCookies([{name:'__Host-gracz_session',value:u.token,url:base.replace('http:','https:')+'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
 return ctx;
}
export async function open(ctx,url,errors=[]){
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64&&document.body.classList.contains('cc-owner'),{timeout:15000});
 return page;
}
export const pieces=page=>page.locator('#board .chess-square').evaluateAll(c=>c.map(x=>x.querySelector('svg')?.dataset.piece||'.'));
export const visible=state=>{const o=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)o.push(state.board[r*16+c]);return o;};
export async function clickMove(page,from,to){await page.locator('#board .chess-square').nth(sq(from)).click();await page.locator('#board .chess-square').nth(sq(to)).click();}
export async function cleanup(){for(const u of made)await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[u.id]).catch(()=>{});await db.close();}
export function save(name){
 const pass=results.filter(r=>r.status==='PASS').length,fail=results.filter(r=>r.status==='FAIL').length;
 fs.writeFileSync(AUDIT+'/evidence/'+name+'.json',JSON.stringify({pass,fail,notTested:results.filter(r=>r.status==='NOT TESTED').length,notImplemented:results.filter(r=>r.status==='NOT IMPLEMENTED').length,results},null,1));
 console.error('SUMMARY',name,{pass,fail});
}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const saveKey='gracz-chess-training-history-v1';
export const injected=(moves,{opponent='human',minutes='0',bonus='0',remaining=[0,0]}={})=>JSON.stringify({v:1,moves,opponent,minutes,bonus,remaining,timeout:0,draw:''});
