import http from 'k6/http';
import {check,sleep} from 'k6';
import {Rate,Counter,Trend} from 'k6/metrics';
import {thresholds,classes} from '../config/thresholds.js';
import {profile} from '../config/profiles.js';

const DATA=JSON.parse(open('../datasets/runtime.json'));
const unexpectedError=new Rate('wave_b_unexpected_error');
const server5xx=new Rate('wave_b_server_5xx');
const expected409=new Counter('wave_b_expected_409');
const expected429=new Counter('wave_b_expected_429');
const fastRead=new Trend('wave_b_fast_read_ms',true);
const normalCommand=new Trend('wave_b_normal_command_ms',true);
const complexRead=new Trend('wave_b_complex_read_ms',true);
const operations=new Counter('wave_b_operations');

export const options={...profile(),thresholds};

function urls(){const raw=String(__ENV.BASE_URLS||DATA.baseUrls?.join(',')||'http://127.0.0.1:3000');return raw.split(',').map(v=>v.trim()).filter(Boolean)}
function baseUrl(salt=0){const list=urls();return list[((__VU-1)+__ITER+salt)%list.length]}
function user(index=(__VU-1)){return DATA.users[index%DATA.users.length]}
function authHeaders(u){return{authorization:`Bearer ${u.token}`,accept:'application/json','user-agent':'gracz-wave-b-k6/1.0'}}
function jsonHeaders(u){return{...authHeaders(u),'content-type':'application/json'}}
function classify(res,kind){operations.add(1);const ok=res.status>=200&&res.status<400;if(res.status===409)expected409.add(1);if(res.status===429)expected429.add(1);const infraFailure=res.status>=500;server5xx.add(infraFailure);unexpectedError.add(!(ok||res.status===409||res.status===429));if(kind===classes.FAST)fastRead.add(res.timings.duration);else if(kind===classes.NORMAL)normalCommand.add(res.timings.duration);else complexRead.add(res.timings.duration);return ok||res.status===409||res.status===429}
function get(path,u=user(),kind=classes.FAST){const res=http.get(`${baseUrl()}${path}`,{headers:authHeaders(u),tags:{wave_b_class:kind}});classify(res,kind);return res}
function post(path,body,u=user(),kind=classes.NORMAL){const res=http.post(`${baseUrl()}${path}`,JSON.stringify(body),{headers:jsonHeaders(u),tags:{wave_b_class:kind}});classify(res,kind);return res}
function gameFor(key){const list=DATA[key]||[];return list.length?list[((__VU-1)+__ITER)%list.length]:null}
function mappedUser(userId){return DATA.users.find(item=>item.userId===userId)||user()}

function httpBaseline(){const paths=['/','/lobby.html','/players.html','/global-chat.html'];get(paths[(__VU+__ITER)%paths.length],user(),classes.FAST)}
function authenticatedBrowse(){const u=user();get('/auth/me',u,classes.FAST);if(__ITER%3===0)get('/lobby/state',u,classes.FAST)}
function lobbyLoad(){const u=user();if(__ITER%5===0){post('/lobby/rooms',{roomName:`wb-${u.userId}`,gameType:'checkers'},u,classes.NORMAL)}else get('/lobby/state',u,classes.FAST)}
function checkersActivity(){const game=gameFor('checkersGames');if(!game)return get('/lobby/state',user(),classes.FAST);const u=mappedUser(game.players[0]);get(`/games/${encodeURIComponent(game.gameId)}`,u,classes.FAST)}
function gomokuActivity(){const game=gameFor('gomokuGames');if(!game)return get('/lobby/state',user(),classes.FAST);const u=mappedUser(game.players[(__ITER+__VU)%game.players.length]);get(`/gomoku/games/${encodeURIComponent(game.gameId)}`,u,classes.FAST)}
function thousandActivity(){const game=gameFor('thousandGames');if(!game)return get('/lobby/state',user(),classes.FAST);const u=mappedUser(game.players[(__ITER+__VU)%game.players.length]);get(`/thousand/games/${encodeURIComponent(game.gameId)}`,u,classes.FAST)}
function globalChat(){const u=user();if(__ITER%20===0)post('/global-chat/messages',{body:`wave-b-${u.userId}-${__ITER}`},u,classes.NORMAL);else get('/global-chat/messages?limit=20',u,classes.FAST)}
function rankings(){const u=user();get('/rankings?period=all&game=all&limit=50',u,classes.COMPLEX)}
function miscellaneous(){const u=user();const paths=['/community.html','/tournaments.html','/ranking.html'];get(paths[(__VU+__ITER)%paths.length],u,classes.FAST)}

const weighted=[
  [20,httpBaseline],[15,authenticatedBrowse],[15,lobbyLoad],[15,checkersActivity],[10,gomokuActivity],[5,thousandActivity],[10,globalChat],[5,rankings],[5,miscellaneous],
];
function mixed(){let n=((__VU*1103515245+__ITER*12345)>>>0)%100;for(const [weight,fn] of weighted){if(n<weight)return fn();n-=weight}return httpBaseline()}

const routes={
  'http-baseline':httpBaseline,'authenticated-browse':authenticatedBrowse,'lobby-load':lobbyLoad,'checkers-gameplay':checkersActivity,'gomoku-gameplay':gomokuActivity,'thousand-gameplay':thousandActivity,'global-chat':globalChat,'rankings':rankings,'mixed-platform':mixed,'stress-breaking-point':mixed,'fault-injection-load':mixed,
};

export default function(){const scenario=String(__ENV.WAVE_B_SCENARIO||'mixed-platform');(routes[scenario]||mixed)();sleep(Number(__ENV.WAVE_B_THINK_SECONDS||0.05))}

export function handleSummary(data){
  const runId=String(__ENV.WAVE_B_RUN_ID||'wave-b');
  return {[`perf/k6/reports/${runId}-summary.json`]:JSON.stringify(data,null,2),stdout:`WAVE_B_SUMMARY ${runId} metrics=${Object.keys(data.metrics||{}).length}\n`};
}
