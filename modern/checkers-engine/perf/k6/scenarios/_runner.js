import http from 'k6/http';
import {sleep} from 'k6';
import exec from 'k6/execution';
import {Rate,Counter,Trend} from 'k6/metrics';
import {getLegalMoves} from '../../../src/index.js';
import {thresholds,classes} from '../config/thresholds.js';
import {profile} from '../config/profiles.js';

const DATA=JSON.parse(open('../datasets/runtime.json'));const RUN_ID=String(__ENV.WAVE_B_RUN_ID||'wave-b');const cfg=profile();
const unexpectedError=new Rate('wave_b_unexpected_error'),server5xx=new Rate('wave_b_server_5xx'),timeoutRate=new Rate('wave_b_timeout');
const expected409=new Counter('wave_b_expected_409'),expected429=new Counter('wave_b_expected_429'),httpMs=new Trend('wave_b_http_ms',true),fastRead=new Trend('wave_b_fast_read_ms',true),normalCommand=new Trend('wave_b_normal_command_ms',true),complexRead=new Trend('wave_b_complex_read_ms',true),operations=new Counter('wave_b_operations');
const readOps=new Counter('wave_b_read_operations'),writeAttempts=new Counter('wave_b_write_attempts'),writeAccepted=new Counter('wave_b_write_accepted');
const checkersAccepted=new Counter('wave_b_checkers_write_accepted'),gomokuAccepted=new Counter('wave_b_gomoku_write_accepted'),thousandAccepted=new Counter('wave_b_thousand_write_accepted');
export const options={scenarios:cfg.scenarios,thresholds:{...thresholds,wave_b_timeout:['rate<0.01']},summaryTrendStats:['avg','min','med','p(90)','p(95)','p(99)','max']};
function steady(){return exec.scenario.name==='steady'}
function urls(){return String(__ENV.BASE_URLS||DATA.baseUrls?.join(',')||'http://127.0.0.1:3000').split(',').map(v=>v.trim()).filter(Boolean)}
function baseUrl(salt=0){const list=urls();return list[((__VU-1)+__ITER+salt)%list.length]}
function user(index=(__VU-1)){return DATA.users[index%DATA.users.length]}
function mappedUser(userId){return DATA.users.find(item=>item.userId===userId)||user()}
function syntheticClientIp(){const index=(Math.max(1,Number(__VU)||1)-1)%65024;return `198.18.${Math.floor(index/254)}.${index%254+1}`}
function authHeaders(u){return{authorization:`Bearer ${u.token}`,accept:'application/json','user-agent':'gracz-wave-b-k6/2.0','x-forwarded-for':syntheticClientIp()}}
function jsonHeaders(u){return{...authHeaders(u),'content-type':'application/json'}}
function classify(res,kind,write=false){if(!steady())return res.status>=200&&res.status<400;if(write)writeAttempts.add(1);else readOps.add(1);operations.add(1);const ok=res.status>=200&&res.status<400;if(res.status===409)expected409.add(1);if(res.status===429)expected429.add(1);const timeout=res.status===0;timeoutRate.add(timeout);server5xx.add(res.status>=500);unexpectedError.add(!(ok||res.status===409||res.status===429));httpMs.add(res.timings.duration);if(kind===classes.FAST)fastRead.add(res.timings.duration);else if(kind===classes.NORMAL)normalCommand.add(res.timings.duration);else complexRead.add(res.timings.duration);if(write&&ok)writeAccepted.add(1);return ok||res.status===409||res.status===429}
function rawGet(path,u=user(),kind=classes.FAST){const res=http.get(`${baseUrl()}${path}`,{headers:authHeaders(u),tags:{wave_b_class:kind}});classify(res,kind,false);return res}
function rawPost(path,body,u=user(),kind=classes.NORMAL){const res=http.post(`${baseUrl(1)}${path}`,JSON.stringify(body),{headers:jsonHeaders(u),tags:{wave_b_class:kind}});classify(res,kind,true);return res}
function payload(res){try{return res.json()}catch{return null}}
function gameFor(key){const list=DATA[key]||[];return list.length?list[(__VU-1)%list.length]:null}
function logicalVuSlot(vu){return(Math.max(1,Number(vu)||1)-1)%Math.max(1,cfg.vus)}
function writerFor(key){const list=DATA[key]||[];return list.length>0&&logicalVuSlot(__VU)<list.length&&__ITER%20===0}
function acceptedWrite(res){return Boolean(res&&res.status>=200&&res.status<300)}
function recordGameAccepted(res,counter){if(acceptedWrite(res))counter.add(1)}
function recordCheckersAccepted(res){if(!acceptedWrite(res))return;const body=payload(res);if(body?.duplicate===false)checkersAccepted.add(1)}
function httpBaseline(){const paths=['/','/lobby.html','/players.html','/global-chat.html'];rawGet(paths[(__VU+__ITER)%paths.length])}
function authenticatedBrowse(){const u=user();rawGet('/auth/me',u);if(__ITER%3===0)rawGet('/lobby/state',u)}
function lobbyLoad(){const u=user();if(__ITER%8===0)rawPost('/lobby/rooms',{roomName:`wb-${RUN_ID}-${u.userId}-${__ITER}`,gameType:'checkers'},u);else rawGet('/lobby/state',u)}
function checkersActivity(){const game=gameFor('checkersGames');if(!game)return rawGet('/lobby/state');const probe=mappedUser(game.players[0]);const viewRes=rawGet(`/games/${encodeURIComponent(game.gameId)}`,probe);const view=payload(viewRes);if(!writerFor('checkersGames')||!view?.game||view.game.status!=='active')return;const currentId=view.players?.[view.game.turn]?.id;if(!currentId)return;const moves=getLegalMoves(view.game);if(!moves.length)return;const u=mappedUser(currentId),requestId=`wb:${RUN_ID}:checkers:${game.gameId}:${view.lastEventSequence+1}`.slice(0,128);const res=rawPost(`/games/${encodeURIComponent(game.gameId)}/moves`,{requestId,move:moves[0]},u);recordCheckersAccepted(res)}
function gomokuActivity(){const game=gameFor('gomokuGames');if(!game)return rawGet('/lobby/state');const probe=mappedUser(game.players[0]);const viewRes=rawGet(`/gomoku/games/${encodeURIComponent(game.gameId)}`,probe);const view=payload(viewRes);if(!writerFor('gomokuGames')||!view||view.status!=='active')return;const currentId=view.players?.[view.turn]?.userId;if(!currentId)return;const occupied=new Set((view.moves||[]).map(m=>`${m.row}:${m.column}`));const cells=view.size*view.size;let chosen=null;for(let n=0;n<cells;n++){const index=(view.revision*7+n*11)%cells,row=Math.floor(index/view.size),column=index%view.size;if(!occupied.has(`${row}:${column}`)){chosen={row,column};break}}if(!chosen)return;const u=mappedUser(currentId),requestId=`wb:${RUN_ID}:gomoku:${game.gameId}:${view.revision+1}`.slice(0,128);const res=rawPost(`/gomoku/games/${encodeURIComponent(game.gameId)}/moves`,{...chosen,requestId},u);recordGameAccepted(res,gomokuAccepted)}
function thousandActivity(){const game=gameFor('thousandGames');if(!game)return rawGet('/lobby/state');const probe=mappedUser(game.players[0]);let view=payload(rawGet(`/thousand/games/${encodeURIComponent(game.gameId)}`,probe));if(!writerFor('thousandGames')||!view?.state)return;const state=view.state;let u=probe,action=null,nextRound=false;if(['round-ended','game-ended','redeal'].includes(state.status)){nextRound=true}else{const seat=Number.isInteger(state.currentPlayerIndex)?state.currentPlayerIndex:(Number.isInteger(state.declarerIndex)?state.declarerIndex:view.viewerIndex);u=mappedUser(game.players[seat]||game.players[0]);view=payload(rawGet(`/thousand/games/${encodeURIComponent(game.gameId)}`,u))||view;const s=view.state;if(s.status==='bidding')action=s.bid?.highest==null?{type:'bid',amount:100}:{type:'pass'};else if(s.status==='talon')action={type:'take-talon'};else if(s.status==='discard'){const key=`player-${view.viewerIndex+1}`,hand=s.hands?.[key]||[],others=Array.from({length:view.playerCount},(_,i)=>i).filter(i=>i!==view.viewerIndex);action={type:'give-cards',gifts:others.map((toPlayerIndex,i)=>({toPlayerIndex,cardId:hand[i]?.id})).filter(x=>x.cardId)}}else if(s.status==='contract')action={type:'contract',amount:s.bid?.highest||100};else if(s.status==='playing'&&view.legalCardIds?.length)action={type:'play-card',cardId:view.legalCardIds[0],declareMarriage:false}}
let res;if(nextRound)res=rawPost(`/thousand/games/${encodeURIComponent(game.gameId)}/next-round`,{expectedRevision:view.revision},u);else if(action)res=rawPost(`/thousand/games/${encodeURIComponent(game.gameId)}/actions`,{expectedRevision:view.revision,action},u);recordGameAccepted(res,thousandAccepted)}
function globalChat(){const u=user();if(__ITER%20===0)rawPost('/global-chat/messages',{body:`wave-b-${RUN_ID}-${u.userId}-${__ITER}`},u);else rawGet('/global-chat/messages?limit=20',u)}
function rankings(){rawGet('/rankings?period=all&game=all&limit=50',user(),classes.COMPLEX)}
function miscellaneous(){const paths=['/community.html','/tournaments.html','/ranking.html'];rawGet(paths[(__VU+__ITER)%paths.length])}
const weighted=[[20,httpBaseline],[15,authenticatedBrowse],[15,lobbyLoad],[15,checkersActivity],[10,gomokuActivity],[5,thousandActivity],[10,globalChat],[5,rankings],[5,miscellaneous]];
function mixed(){let n=((__VU*1103515245+__ITER*12345)>>>0)%100;for(const [weight,fn] of weighted){if(n<weight)return fn();n-=weight}return httpBaseline()}
const routes={'http-baseline':httpBaseline,'authenticated-browse':authenticatedBrowse,'lobby-load':lobbyLoad,'checkers-gameplay':checkersActivity,'gomoku-gameplay':gomokuActivity,'thousand-gameplay':thousandActivity,'global-chat':globalChat,'rankings':rankings,'mixed-platform':mixed,'stress-breaking-point':mixed,'fault-injection-load':mixed};
export default function(){(routes[String(__ENV.WAVE_B_SCENARIO||'mixed-platform')]||mixed)();sleep(Number(__ENV.WAVE_B_THINK_SECONDS||0.05))}
export function handleSummary(data){return{[`perf/k6/reports/${RUN_ID}-summary.json`]:JSON.stringify(data,null,2),stdout:`WAVE_B_SUMMARY ${RUN_ID} metrics=${Object.keys(data.metrics||{}).length}\n`}}
