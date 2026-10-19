// Include all first-party Node module extensions; ambiguous symlinks fail closed.
import {readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export function discoverModules(dir){
  const modules=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git')continue;
    const path=join(dir,entry.name);
    if(entry.isSymbolicLink())throw new Error('First-party syntax gate refuses symlinks');
    if(entry.isDirectory())modules.push(...discoverModules(path));
    else if(entry.isFile()&&/\.(?:mjs|cjs|js)$/.test(entry.name))modules.push(path);
  }
  return modules.sort();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  for(const path of discoverModules(fileURLToPath(new URL('../',import.meta.url)))){
    const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
    if(result.error||result.status!==0)process.exit(1);
  }
}
