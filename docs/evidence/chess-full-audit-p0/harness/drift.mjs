import fs from 'node:fs';
const root='/home/user/gracz-pl-2/contact-api/auth/';
const src=fs.readFileSync(root+'chess-console.mjs','utf8');
const grab=name=>{const m=src.match(new RegExp('const '+name+'=("(?:[^"\\\\]|\\\\.)*");'));return m?JSON.parse(m[1]):null};
const rules=grab('rulesSource'),comp=grab('computerSource');
const fr=fs.readFileSync(root+'chess-rules.mjs','utf8'),fc=fs.readFileSync(root+'chess-computer.mjs','utf8');
console.log('rulesSource found',!!rules,'identical to chess-rules.mjs:',rules===fr, rules?.length, fr.length);
console.log('computerSource found',!!comp,'identical to chess-computer.mjs:',comp===fc, comp?.length, fc.length);
if(rules!==fr){const a=rules.split('\n'),b=fr.split('\n');for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i])console.log('L'+(i+1),'\n console:',a[i],'\n file   :',b[i]);}
if(comp!==fc){const a=comp.split('\n'),b=fc.split('\n');for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i])console.log('L'+(i+1),'\n console:',a[i],'\n file   :',b[i]);}
