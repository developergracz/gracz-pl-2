// OWNER P0: fail closed. Only static Warcaby caption copy or isolated
// tests may bypass unrelated full-platform/geometry/SEO jobs.
// Required Security Gate jobs are never modified or skipped.
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const CONSOLE='contact-api/auth/checkers-console.mjs';
export const TESTS=new Set([
 'contact-api/test/checkers-console.test.mjs',
 'contact-api/scaling/checkers-chess-shell.browser.test.mjs'
]);
const ALLOWED=new Set([CONSOLE,...TESTS]);

export function normalizedCaption(content){
 if(typeof content!=='string')return null;
 const pattern=/(<p id="checkers-start-detail">)([^<>\\\r\n]{1,220})(<\/p>)/g;
 const found=[...content.matchAll(pattern)];
 if(found.length!==1)return null;
 if(!/^[\p{L}\p{N} .,!?;:()–—-]+$/u.test(found[0][2]))return null;
 return content.replace(pattern,'$1__APPROVED_STATIC_CAPTION__$3');
}

export function isTargetedCheckersChange(entries,baseConsole,headConsole){
 if(!Array.isArray(entries)||entries.length===0||entries.length>3)return false;
 const seen=new Set();
 for(const item of entries){
  if(!item||typeof item.path!=='string'||!ALLOWED.has(item.path)||seen.has(item.path))return false;
  if(item.status!=='M'&&!(item.status==='A'&&TESTS.has(item.path)))return false;
  seen.add(item.path);
 }
 if(!seen.has(CONSOLE))return true;
 const normalizedBase=normalizedCaption(baseConsole);
 return normalizedBase!==null&&normalizedBase===normalizedCaption(headConsole);
}

function run(){
 let targeted=false;
 try{
  const base=process.env.CI_BASE_SHA;
  if(process.env.CI_EVENT==='pull_request'&&/^[0-9a-f]{40}$/.test(base||'')){
   const output=execFileSync('git',['diff','--name-status','-z','--no-renames',base,'HEAD','--'],{encoding:'utf8'});
   const tokens=output.split('\0').filter(Boolean);
   if(tokens.length&&tokens.length%2===0){
    const entries=[];
    for(let i=0;i<tokens.length;i+=2)entries.push({status:tokens[i],path:tokens[i+1]});
    const changedConsole=entries.some(item=>item.path===CONSOLE);
    let before=null,after=null;
    if(changedConsole){
     before=execFileSync('git',['show',base+':'+CONSOLE],{encoding:'utf8'});
     after=execFileSync('git',['show','HEAD:'+CONSOLE],{encoding:'utf8'});
    }
    targeted=isTargetedCheckersChange(entries,before,after);
    console.log('CI scope:',targeted?'targeted Warcaby acceptance':'full integration',
      entries.map(({status,path})=>status+' '+path).join(', '));
   }
  }
 }catch(error){console.warn('CI scope detection unavailable; running full tests:',error.message)}
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'targeted='+targeted+'\n');
 console.log('targeted='+targeted);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)run();
