// Disposable integration process; uses the production router, DB adapter and hub.
import {createServer} from 'node:http';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {createGomokuRealtime} from '../auth/gomoku-realtime.mjs';
const database=createDatabase();
let hub;
const router=createPublicIdentityRouter({database,emailFrom:'p3@example.test',resendKey:'not-used',
 onGomokuChange:id=>hub?.notify(id),onMatchChange:id=>hub?.notify(id)});
await router.probe();
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'https://gracz-contact-api.onrender.com');
 hub.observe(req,res,url);
 if(!await router.handle(req,res,url)){res.writeHead(404);res.end();}
});
hub=createGomokuRealtime({server,router,redisUrl:process.env.GAME_REDIS_URL,
 reconcileMs:1000,heartbeatMs:250,maxConnections:100});
await hub.ready;
server.listen(0,'127.0.0.1',()=>process.send?.({port:server.address().port}));
process.on('SIGTERM',()=>{hub.close();server.close(async()=>{await database.close();process.exit(0);});});
