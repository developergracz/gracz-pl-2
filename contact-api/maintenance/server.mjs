// Independent maintenance artifact: never import the business API or its clients.
import {createServer} from 'node:http';

const port=Number(process.env.PORT || 10000);
if(!Number.isInteger(port)||port<1||port>65535){
  console.error('MAINTENANCE_INVALID_PORT');process.exit(1);
}
const unavailable=JSON.stringify({ok:false,error:'maintenance',message:'API jest tymczasowo niedostępne. Spróbuj ponownie później.'});
const health=JSON.stringify({ok:true,mode:'maintenance',businessReady:false,artifact:'contact-api-maintenance-r1'});
const headers={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'X-Gracz-API-Mode':'maintenance',
  'Connection':'close',
  'Vary':'Origin',
};
function respond(req,res,allowHealth=false){
  // Do not read/parse/log request bodies, tokens, query values or identities.
  const healthy=allowHealth && req.method==='GET' && req.url.split('?')[0]==='/health';
  const body=healthy?health:unavailable;
  const cors=['https://gracz.pl','https://www.gracz.pl'].includes(req.headers.origin)
    ? {'Access-Control-Allow-Origin':req.headers.origin}:{};
  res.writeHead(healthy?200:503,{...headers,...cors,'Content-Length':Buffer.byteLength(body),...(!healthy?{'Retry-After':'60'}:{})});
  res.end(body);
}
const server=createServer({maxHeaderSize:8192,headersTimeout:5000,requestTimeout:5000,connectionsCheckingInterval:1000},(req,res)=>respond(req,res,true));
server.on('checkContinue',(req,res)=>respond(req,res));
server.on('checkExpectation',(req,res)=>respond(req,res));
function rejectSocket(socket){
  if(socket.writable)socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nCache-Control: no-store\r\nRetry-After: 60\r\nContent-Length: 0\r\n\r\n',()=>socket.destroy());
  else socket.destroy();
}
server.on('upgrade',(_req,socket)=>rejectSocket(socket));
server.on('connect',(_req,socket)=>rejectSocket(socket));
// A parser error may follow an already-started response. Never append a second one.
server.on('clientError',(_error,socket)=>socket.destroy());
server.setTimeout(5000,socket=>socket.destroy());
server.on('error',()=>{console.error('MAINTENANCE_LISTENER_ERROR');process.exit(1);});
let stopping=false;
function stop(){
  if(stopping)return;
  stopping=true;
  server.close(()=>{process.exitCode=0;});
  server.closeAllConnections();
}
process.on('SIGTERM',stop);
process.on('SIGINT',stop);
server.listen(port,process.env.HOST || '0.0.0.0',()=>console.info('CONTACT_API_MAINTENANCE_R1_LISTENING'));
