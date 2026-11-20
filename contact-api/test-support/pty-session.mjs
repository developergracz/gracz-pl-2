// Test-only: a real pseudo-terminal from the Python standard library (no native
// Node module). Resolves with the pty-session.py report plus decoded `text`.
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const driver=fileURLToPath(new URL('./pty-session.py',import.meta.url));

export function runOnPty({argv,env,steps,timeout=20}){
  return new Promise((resolve,reject)=>{
    execFile('python3',['-I',driver,JSON.stringify({argv,env,steps,timeout})],
      {timeout:(timeout+10)*1000,maxBuffer:1<<20},(error,stdout)=>{
        if(error)return reject(error);
        const report=JSON.parse(stdout);
        report.text=Buffer.from(report.output,'base64').toString('utf8');
        resolve(report);
      });
  });
}
