import fs from 'node:fs';
import {serveChessConsole} from '/home/user/gracz-pl-2/contact-api/auth/chess-console.mjs';
const out=process.argv[2];
for(const p of ['/konto/szachy','/konto/szachy/styl.css','/konto/szachy/app.js','/konto/szachy/rules.mjs','/konto/szachy/pieces.mjs','/konto/szachy/computer.mjs','/konto/szachy/realtime-client.mjs','/konto/szachy/invitations.css','/konto/szachy/invitations.js']){
 let body='',head;
 const res={writeHead:(c,h)=>{head=h},end:b=>{body=b}};
 serveChessConsole({method:'GET'},res,new URL('http://x'+p));
 const name=p==='/konto/szachy'?'index.html':p.split('/').pop();
 fs.writeFileSync(out+'/'+name,body);
 console.log(name,body.length, head['Content-Security-Policy']?'csp':'');
}
