// Disposable browser-only server: real production router and console, isolated DB.
import {createServer} from 'node:http';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {createGomokuRealtime} from '../auth/gomoku-realtime.mjs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
const database=createDatabase(),origin='https://gracz-contact-api.onrender.com';
let hub;
const router=createPublicIdentityRouter({database,emailFrom:'browser-test@example.invalid',resendKey:'local-only',
 onGomokuChange:id=>hub?.notify(id),onMatchChange:id=>hub?.notify(id)});
await router.probe();
const server=createServer(async(req,res)=>{
 // Only in disposable CI: localhost Chrome requests retain production CSRF contract.
 if(req.headers.origin?.startsWith('http://localhost:'))req.headers.origin=origin;
 const url=new URL(req.url,origin);
 hub.observe(req,res,url);
 if(serveCheckersConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
 if(!await router.handle(req,res,url)){res.writeHead(404);res.end();}
});
// A browser sends localhost Origin; only this private process rewrites it.
server.prependListener('upgrade',req=>{
 if(req.headers.origin?.startsWith('http://localhost:'))req.headers.origin=origin;
});
hub=createGomokuRealtime({server,router,redisUrl:process.env.GAME_REDIS_URL,
 reconcileMs:1000,heartbeatMs:250,maxConnections:100});
await hub.ready;
server.listen(0,'127.0.0.1',()=>process.send?.({port:server.address().port}));
process.on('SIGTERM',()=>{hub.close();server.close(async()=>{await database.close();process.exit(0);});});
