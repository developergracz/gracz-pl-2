// Automatically include new backend modules, fixtures and tests in the syntax gate.
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
function check(dir){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git')continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory())check(path);
    else if(entry.isFile()&&entry.name.endsWith('.mjs')){
      const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
      if(result.error||result.status!==0)process.exit(1);
    }
  }
}
check(root);
