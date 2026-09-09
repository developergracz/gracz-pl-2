import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {AuthService} from '../../src/auth.js';

const secret=process.env.AUTH_SECRET;
if(!secret||Buffer.byteLength(secret)<32)throw new Error('AUTH_SECRET >= 32 bytes is required.');
const baseUrls=String(process.env.BASE_URLS||'http://127.0.0.1:3000').split(',').map(x=>x.trim()).filter(Boolean);
const base=baseUrls[0];
const userCount=Math.max(100,Math.min(6000,Number(process.env.WAVE_B_USER_COUNT||1200)));
const gameCount=Math.max(1,Math.min(200,Number(process.env.WAVE_B_GAME_COUNT||20)));
const runId=String(process.env.WAVE_B_RUN_ID||'waveb').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,16)||'waveb';
const output=resolve(process.env.WAVE_B_DATASET||'perf/k6/datasets/runtime.json');
const auth=new AuthService({secret,ttlSeconds:3600});
const users=Array.from({length:userCount},(_,i)=>{
  const n=String(i+1).padStart(5,'0');const userId=`wb${n}`;const displayName=`WB ${n}`;
  return{userId,displayName,token:auth.issueGuest({userId,displayName,ttlSeconds:3600})};
});
const byId=new Map(users.map(u=>[u.userId,u]));
async function api(path,{method='GET',body,user}={}){
  const response=await fetch(`${base}${path}`,{method,headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{}),...(user?{authorization:`Bearer ${user.token}`}:{})},body:body?JSON.stringify(body):undefined});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={raw:text.slice(0,500)}}
  if(!response.ok)throw new Error(`${method} ${path} => ${response.status} ${JSON.stringify(payload).slice(0,800)}`);
  return payload;
}
let cursor=0;function take(count){if(cursor+count>users.length)throw new Error(`Need more users: cursor=${cursor}, count=${count}, total=${users.length}`);const result=users.slice(cursor,cursor+count);cursor+=count;return result}
async function seedLobbyGame(gameType,playerCount){
  const players=take(playerCount);const owner=players[0];
  const room=await api('/lobby/rooms',{method:'POST',user:owner,body:{roomName:`${runId}-${gameType}-${cursor}`,gameType,maxPlayers:playerCount}});
  let current=room;
  for(const player of players.slice(1))current=await api(`/lobby/rooms/${encodeURIComponent(room.roomId)}/join`,{method:'POST',user:player,body:{}});
  if(!current.gameId||current.status!=='playing')throw new Error(`Seeded ${gameType} room did not become playing: ${JSON.stringify(current).slice(0,800)}`);
  return{gameId:current.gameId,roomId:current.roomId,players:players.map(p=>p.userId)};
}
await api('/health');
const checkersGames=[],gomokuGames=[],thousandGames=[];
for(let i=0;i<gameCount;i++)checkersGames.push(await seedLobbyGame('checkers',2));
for(let i=0;i<gameCount;i++)gomokuGames.push(await seedLobbyGame('gomoku',2));
for(let i=0;i<gameCount;i++)thousandGames.push(await seedLobbyGame('thousand',3));
for(const game of [...checkersGames,...gomokuGames,...thousandGames])for(const id of game.players)if(!byId.has(id))throw new Error(`Unknown seeded player ${id}`);
const data={runId,baseUrls,seed:process.env.WAVE_B_SEED||'20260909',generatedAt:new Date().toISOString(),users,checkersGames,gomokuGames,thousandGames};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(data,null,2));
console.log(JSON.stringify({runId,output,userCount:users.length,checkersGames:checkersGames.length,gomokuGames:gomokuGames.length,thousandGames:thousandGames.length},null,2));
