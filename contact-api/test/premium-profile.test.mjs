import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {createPremiumProfileRouter} from '../auth/premium-profile.mjs';
import {enhanceProfileHtml,premiumProfileScript,servePublicProfile} from '../auth/profile-premium-ui.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';

const account='11111111-1111-4111-8111-111111111111';
function reply(){
 const r={status:0,headers:{},body:''};
 return {r,res:{writeHead(status,headers){r.status=status;r.headers=headers},end(body){r.body=String(body)}}};
}
function fakeApi({publicRow=null,stats=false}={}){
 const history=[];
 const rows={
  extras:null,
  grouped:[{game:'warcaby',played:3,wins:2,losses:1,draws:0,active:1}],
  recent:[{id:'22222222-2222-4222-8222-222222222222',game:'warcaby',winner:'1',player:1,opponent:'oponent',moves:'21',updated_at:'2026-11-04'}]
 };
 const db={query:async(sql,params)=>{
  history.push({sql,params});
  if(sql.includes('FROM gracz_public_identity.sessions s'))return {rows:[{id:account,nickname:'tester'}]};
  if(sql.includes('SELECT * FROM gracz_public_identity.player_profile_premium'))return {rows:rows.extras?[rows.extras]:[]};
  if(sql.includes('INSERT INTO gracz_public_identity.player_profile_premium')){
   const p=params;rows.extras={avatar:p[1],cover:p[2],accent:p[3],motto:p[4],city:p[5],
    time_zone:p[6],date_format:p[7],public_profile:p[8],show_stats:p[9],
    show_country:p[10],show_badges:p[11],sounds:p[12]};return {rows:[]};
  }
  if(sql.includes('COUNT(*) FILTER'))return {rows:stats?rows.grouped:[]};
  if(sql.includes('m.updated_at,m.state'))return {rows:stats?rows.recent:[]};
  if(sql.includes('WHERE a.nickname_key='))return {rows:publicRow?[publicRow]:[]};
  throw Error('Unexpected SQL '+sql);
 }};
 const api=createPremiumProfileRouter({database:db,ready:async()=>{},sessionToken:()=>('a'.repeat(64)),
  digest:()=>Buffer.alloc(32),authorizedOrigin:()=>true,readBody:async()=>({}),
  allow:()=>true,validNick:x=>/^[a-z][a-z0-9._-]{2,31}$/i.test(x)});
 return {api,db,rows,history};
}
function call(api,path,method='GET'){
 const {r,res}=reply();
 return api.handle({method,headers:{},socket:{remoteAddress:'127.0.0.1'}},res,new URL('https://example.com'+path))
  .then(()=>({status:r.status,body:JSON.parse(r.body),headers:r.headers}));
}
test('premium profile defaults to private and returns no public account data',async()=>{
 const {api}=fakeApi();
 const own=await call(api,'/auth/profile/premium');assert.equal(own.status,200);
 assert.equal(own.body.preferences.publicProfile,false);
 const pub=await call(api,'/auth/public-profile?nick=tester');
 assert.equal(pub.status,404);assert.equal(pub.body.error,'PROFIL_NIEPUBLICZNY');
});
test('premium profile rejects incomplete writes and stores only validated options',async()=>{
 const f=fakeApi();
 const bad=await call(f.api,'/auth/profile/premium','PUT');assert.equal(bad.status,400);
 assert.equal(f.history.some(x=>x.sql.includes('INSERT INTO gracz_public_identity.player_profile_premium')),false);
});
test('real match statistics, history, and earned badges use database records',async()=>{
 const {api}=fakeApi({stats:true});
 const got=await call(api,'/auth/profile/stats');
 assert.equal(got.status,200);
 assert.equal(got.body.stats.totals.played,3);
 assert.equal(got.body.stats.totals.wins,2);
 assert.equal(got.body.stats.totals.winRate,67);
 assert.equal(got.body.stats.latest.length,1);
 assert.equal(got.body.stats.achievements.find(x=>x.id==='first-win').unlocked,true);
 assert.equal(got.body.stats.achievements.find(x=>x.id==='ten-wins').unlocked,false);
});
test('public profile never exposes email, sessions, or private identifiers',async()=>{
 const row={id:account,nickname:'tester',display_name:'Publiczny',bio:'Gry i nauka',created_at:'2026-11-04',
  country:'PL',avatar:'crown',cover:'wave',accent:'turquoise',motto:'Czas na grę',city:'Jaworzno',
  public_profile:true,show_stats:false,show_country:false,show_badges:false};
 const {api}=fakeApi({publicRow:row});
 const result=await call(api,'/auth/public-profile?nick=tester');
 assert.equal(result.status,200);assert.equal(result.body.profile.country,'');
 assert.equal(JSON.stringify(result.body).includes('email'),false);
 assert.equal(JSON.stringify(result.body).includes(account),false);
 assert.equal(result.body.profile.stats,undefined);
});
test('profile panel exposes six tabs and only one logged-in editor',()=>{
 const {r,res}=reply(),url=new URL('https://example.com/konto/panel/');
 assert.equal(servePlayerPanel({method:'GET'},res,url),true);
 assert.equal(r.status,200);
 assert.equal((r.body.match(/data-profile-tab="/g)||[]).length,6);
 assert.equal((r.body.match(/data-profile-tab-panel="/g)||[]).length,6);
 assert.match(r.body,/id="premium-public"/);
 assert.match(r.body,/id="profile-form"/);
 assert.doesNotMatch(r.body,/<script[^>]*src="https:/i);
 assert.doesNotThrow(()=>new Script(premiumProfileScript));
});
test('public profile page serves fixed assets and not user-provided HTML',()=>{
 const {r,res}=reply();
 assert.equal(servePublicProfile({method:'GET'},res,new URL('https://example.com/konto/profil/tester'),'css',{}),true);
 assert.equal(r.status,200);assert.match(r.body,/id="pub-card"/);
 assert.doesNotMatch(r.body,/tester/i);
});
