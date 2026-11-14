import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createServer} from 'node:net';
import {PassThrough} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {createDatabase} from '../persistence/database.mjs';
import {readHiddenLine,repairRepeatWithdrawal} from '../operations/repair-repeat-withdrawal-marker.mjs';
import {runOnPty} from '../test-support/pty-session.mjs';

const cli=fileURLToPath(new URL('../operations/repair-repeat-withdrawal-marker.mjs',import.meta.url));
const subjectKey=Buffer.alloc(32,22).toString('base64url');
const address='hidden.synthetic@example.test';
const prompt='Adres e-mail (nie zostanie wypisany): ';
const leaks=text=>[address,'hidden.synthetic','synthetic@','example.test'].filter(part=>text.includes(part));

class FakeTty extends EventEmitter{
  isTTY=true;isRaw=false;modes=[];
  setRawMode(mode){this.modes.push(mode);this.isRaw=mode;return this;}
  setEncoding(){return this;}
  resume(){return this;}
  pause(){return this;}
}
function terminal(input=new FakeTty()){
  const signals=new EventEmitter(),writes=[];
  const output={write(text){writes.push({text,raw:input.isRaw});return true;}};
  const settled=readHiddenLine({input,output,signals}).then(
    value=>({value,raw:input.isRaw}),error=>({error,raw:input.isRaw}));
  const listeners=()=>['data','end','error'].map(name=>input.listenerCount(name)).concat(
    ['exit','SIGINT','SIGTERM','SIGHUP','SIGQUIT'].map(name=>signals.listenerCount(name)));
  return {input,signals,writes,settled,listeners};
}

test('TTY: echo is off before the prompt and restored before the address is returned',async()=>{
  const t=terminal();
  assert.deepEqual(t.writes,[{text:prompt,raw:true}]);
  t.input.emit('data','wrong\x15hidden.synthetiX\x7fc@exa');
  t.input.emit('data','mple.test\r');
  const result=await t.settled;
  assert.deepEqual(result,{value:address,raw:false});
  assert.deepEqual(t.input.modes,[true,false]);
  assert.deepEqual(t.writes,[{text:prompt,raw:true},{text:'\n',raw:false}]);
  assert.deepEqual(t.listeners(),[0,0,0,0,0,0,0,0]);
});

test('TTY: Ctrl+C, Ctrl+\\, signals, stream errors and EOF all restore the terminal',async()=>{
  const cases=[
    [t=>t.input.emit('data','hidden.synthetic@exa\x03'),{signal:'SIGINT'}],
    [t=>t.input.emit('data','hidden\x1c'),{signal:'SIGQUIT'}],
    ...['SIGINT','SIGTERM','SIGHUP','SIGQUIT'].map(name=>[t=>t.signals.emit(name,name),{signal:name}]),
    [t=>t.input.emit('error',new Error('private stream detail')),{message:'private stream detail'}],
    [t=>{t.input.emit('data','partial');t.input.emit('end');},{value:'partial'}],
    [t=>t.input.emit('data','partial\x04ignored'),{value:'partial'}]
  ];
  for(const [act,expected] of cases){
    const t=terminal();
    act(t);
    const result=await t.settled;
    assert.equal(result.raw,false);
    assert.deepEqual(t.input.modes,[true,false]);
    assert.deepEqual(t.listeners(),[0,0,0,0,0,0,0,0]);
    if(expected.signal){
      assert.equal(result.error.code,'REPEAT_WITHDRAWAL_INPUT_ABORTED');
      assert.equal(result.error.signal,expected.signal);
    }else if(expected.message)assert.equal(result.error.message,expected.message);
    else assert.equal(result.value,expected.value);
  }
});

test('TTY: an exit while typing restores the terminal synchronously',async()=>{
  const t=terminal();
  t.signals.emit('exit',1);
  assert.equal(t.input.isRaw,false);
  t.input.emit('end');
  assert.equal((await t.settled).raw,false);
});

test('TTY without a working raw mode fails closed before any prompt',async()=>{
  for(const setRawMode of [()=>{throw new Error('EIO');},()=>{}]){
    const input=new FakeTty();
    input.setRawMode=setRawMode;
    const t=terminal(input);
    assert.ok((await t.settled).error);
    assert.deepEqual(t.writes,[]);
    assert.deepEqual(t.listeners(),[0,0,0,0,0,0,0,0]);
  }
});

test('piped stdin keeps the one-line contract and never touches terminal modes',async()=>{
  const input=new PassThrough(),writes=[];
  input.end(address+'\nsecond line\n');
  assert.equal(await readHiddenLine({input,output:{write:text=>writes.push(text)},signals:new EventEmitter()}),address);
  assert.deepEqual(writes,[prompt]);
});

// The real tool on a real pseudo-terminal. A TCP server that never answers
// stands in for PostgreSQL: no database is touched, the tool stays alive.
async function heldDatabase(t){
  const sockets=new Set();
  const server=createServer(socket=>sockets.add(socket));
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  t.after(()=>{for(const socket of sockets)socket.destroy();return new Promise(done=>server.close(done));});
  return {url:`postgresql://synthetic:synthetic@127.0.0.1:${server.address().port}/synthetic`,
    get connections(){return sockets.size;}};
}
const cliOnPty=(db,steps)=>runOnPty({argv:[process.execPath,cli,'--address'],steps,
  env:{PATH:process.env.PATH||'/usr/bin:/bin',DATABASE_URL:db.url,DB_CONNECT_TIMEOUT_MS:'2000',
    NEWSLETTER_NEW_SUBJECT_KEY:subjectKey}});

test('PTY: the typed address never appears in the captured terminal output',{timeout:30000},async t=>{
  const db=await heldDatabase(t);
  const r=await cliOnPty(db,[{wait:prompt},{snapshot:'typing'},{write:address+'\r'},
    {wait:'\r\n'},{snapshot:'typed'}]);
  assert.equal(r.error,undefined);
  assert.deepEqual([r.typing.echo,r.typing.icanon],[false,false],'kernel TTY echo is off while typing');
  assert.equal(r.typed.alive,true);
  assert.deepEqual(r.typed.attrs,r.before.attrs,'restored by the tool, before it goes on to the database');
  assert.deepEqual(r.after.attrs,r.before.attrs);
  assert.ok(r.text.includes(prompt));
  assert.deepEqual(leaks(r.text),[]);
  assert.match(r.text,/KONTROLA NIEDOSTEPNA — BEZ ZMIAN/);
  assert.equal(r.code,1);
  assert.ok(db.connections>=1,'the address was accepted and the tool went on');
});

test('PTY: Ctrl+C and SIGTERM while typing restore the terminal and change nothing',{timeout:30000},async t=>{
  for(const [last,code] of [[{write:'\x03'},130],[{signal:'SIGTERM'},143]]){
    const db=await heldDatabase(t);
    const r=await cliOnPty(db,[{wait:prompt},{write:'hidden.synthetic@exa'},{sleep:0.2},
      {snapshot:'typing'},last]);
    assert.equal(r.error,undefined);
    assert.equal(r.typing.echo,false);
    assert.equal(r.code,code);
    assert.match(r.text,/PRZERWANO — BEZ ZMIAN/);
    assert.deepEqual(leaks(r.text),[]);
    assert.deepEqual(r.after.attrs,r.before.attrs);
    assert.equal(db.connections,0,'nothing reached the database');
  }
});

// The real transaction wrapper over a scripted connection: `lose` names the
// statement whose answer never arrives (the server may already have run it).
function scripted({lose,rowCount=1}){
  const sent=[],at=new Date('2026-10-01T10:00:00.000Z');
  const client={on(){},removeListener(){},release(){},async query(sql){
    const verb=String(sql).trim().split(/\s/)[0];
    sent.push(verb);
    if(verb===lose)throw Object.assign(new Error('Connection terminated unexpectedly'),{code:'ECONNRESET'});
    if(verb==='UPDATE')return {rowCount,rows:rowCount?[{repeat_withdrawn_at:at}]:[]};
    if(/^\s*SELECT s\.state/.test(sql))return {rows:[{state:'pending',requested_at:at,open:false,revoked:true}]};
    return {rowCount:1,rows:[]};
  }};
  class Pool{on(){}async connect(){return client;}async end(){}}
  const database=createDatabase({connectionString:'postgresql://synthetic@127.0.0.1/synthetic',
    poolFactory:Pool,logger:{error(){}}});
  return {sent,run:()=>repairRepeatWithdrawal({database,subjectKey,email:address})};
}

test('COMMIT sent after the marker write but unanswered is uncertain, never "no change"',async()=>{
  const lost=scripted({lose:'COMMIT'});
  assert.deepEqual(await lost.run(),{repaired:null,state:'WYNIK_NIEPEWNY'});
  assert.deepEqual(lost.sent.slice(-2),['COMMIT','ROLLBACK']);

  // A failure before COMMIT is sent is a real rollback: reported as unavailable.
  const early=scripted({lose:'UPDATE'});
  await assert.rejects(early.run(),{code:'ECONNRESET'});
  assert.equal(early.sent.includes('COMMIT'),false);

  // Nothing was written, so a lost COMMIT answer cannot have changed anything.
  await assert.rejects(scripted({lose:'COMMIT',rowCount:0}).run(),{code:'ECONNRESET'});

  const ok=await scripted({}).run();
  assert.deepEqual([ok.repaired,ok.state,ok.withdrawnAt],[true,'WYPISANA','2026-10-01T10:00:00.000Z']);
});
