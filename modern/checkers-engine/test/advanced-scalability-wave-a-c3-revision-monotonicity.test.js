import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {ThousandRealtimeHub} from '../src/thousand-realtime.js';
import {GomokuRealtimeHub} from '../src/gomoku-realtime.js';

function deferred(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej});return{promise,resolve,reject}}
function responseCollector(){const writes=[];const listeners=new Map();return{writes,writeHead(){},write(value){writes.push(String(value));return true},end(){listeners.get('close')?.()},on(name,fn){listeners.set(name,fn)}}}
function revisionsFrom(writes){return writes.map(chunk=>{const match=chunk.match(/data: (.+)\n/);if(!match)return null;try{return JSON.parse(match[1]).revision}catch{return null}}).filter(Number.isInteger)}

test('Wave A C3 browser contracts reject non-increasing revisions',async()=>{
  const [gomoku,thousand]=await Promise.all([
    readFile(new URL('../web/gomoku.js',import.meta.url),'utf8'),
    readFile(new URL('../web/thousand.js',import.meta.url),'utf8'),
  ]);
  assert.match(gomoku,/incomingRevision<=lastRenderedRevision/);
  assert.match(thousand,/incomingRevision<=currentRevision/);
});

test('Wave A C3 Tysiac hub suppresses delayed older projection after a newer projection',async()=>{
  const slow=deferred();let calls=0;
  const service={repository:{pool:null},async getView(){calls+=1;if(calls===1)return{revision:0};if(calls===2)return slow.promise;return{revision:2}}};
  const response=responseCollector();const hub=new ThousandRealtimeHub({service});
  try{
    await hub.subscribe('thousand_c3_game','alice',response);
    const first=hub.publish('thousand_c3_game');
    await Promise.resolve();
    const second=hub.publish('thousand_c3_game');
    await second;
    slow.resolve({revision:1});
    await first;
    assert.deepEqual(revisionsFrom(response.writes),[0,2]);
  }finally{hub.close()}
});

test('Wave A C3 Gomoku hub suppresses delayed older projection after a newer projection',async()=>{
  const slow=deferred();let calls=0;
  const service={pool:null,async view(){calls+=1;if(calls===1)return{revision:0};if(calls===2)return slow.promise;return{revision:2}}};
  const response=responseCollector();const hub=new GomokuRealtimeHub({service});
  try{
    await hub.subscribe('gomoku_c3_game','alice',response);
    const first=hub.publish('gomoku_c3_game');
    await Promise.resolve();
    const second=hub.publish('gomoku_c3_game');
    await second;
    slow.resolve({revision:1});
    await first;
    assert.deepEqual(revisionsFrom(response.writes),[0,2]);
  }finally{hub.close()}
});
