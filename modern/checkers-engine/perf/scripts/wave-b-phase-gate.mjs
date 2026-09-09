import {readFile} from 'node:fs/promises';
const file=process.argv[2]||'perf/k6/reports/phase-status.txt';
const text=await readFile(file,'utf8');
const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const parsed=lines.map(line=>{const i=line.indexOf('=');return{phase:i<0?line:line.slice(0,i),status:i<0?'FAIL:INVALID_STATUS':line.slice(i+1)}});
const failures=parsed.filter(x=>x.status==='FAIL'||x.status.startsWith('FAIL:'));
const unknown=parsed.filter(x=>!['PASS','ENVIRONMENT_LIMITED','NOT_EXECUTED'].includes(x.status)&&!x.status.startsWith('FAIL:')&&!x.status.startsWith('ENVIRONMENT_LIMITED:')&&!x.status.startsWith('NOT_EXECUTED:'));
console.log(JSON.stringify({file,phases:parsed,failures,unknown},null,2));
if(failures.length||unknown.length)process.exitCode=1;
