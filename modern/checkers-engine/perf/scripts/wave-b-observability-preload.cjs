"use strict";
const fs=require('node:fs');
const {monitorEventLoopDelay}=require('node:perf_hooks');
const path=process.env.WAVE_B_OBS_FILE;
if(path){
  fs.mkdirSync(require('node:path').dirname(path),{recursive:true});
  const histogram=monitorEventLoopDelay({resolution:20});histogram.enable();
  let poolWaitCount=0,poolWaitTotalMs=0,poolWaitMaxMs=0;
  try{
    const pg=require('pg');const original=pg.Pool.prototype.connect;
    pg.Pool.prototype.connect=function(callback){
      const started=process.hrtime.bigint();
      const record=()=>{const ms=Number(process.hrtime.bigint()-started)/1e6;poolWaitCount++;poolWaitTotalMs+=ms;poolWaitMaxMs=Math.max(poolWaitMaxMs,ms)};
      if(typeof callback==='function')return original.call(this,(error,client,done)=>{record();callback(error,client,done)});
      return Promise.resolve(original.call(this)).then(client=>{record();return client},error=>{record();throw error});
    };
  }catch{}
  const timer=setInterval(()=>{
    const mem=process.memoryUsage();
    const row={ts:new Date().toISOString(),pid:process.pid,rss:mem.rss,heapUsed:mem.heapUsed,heapTotal:mem.heapTotal,eventLoopP50Ms:Number(histogram.percentile(50))/1e6,eventLoopP95Ms:Number(histogram.percentile(95))/1e6,eventLoopP99Ms:Number(histogram.percentile(99))/1e6,eventLoopMaxMs:Number(histogram.max)/1e6,activeRequests:typeof process._getActiveRequests==='function'?process._getActiveRequests().length:null,activeHandles:typeof process._getActiveHandles==='function'?process._getActiveHandles().length:null,poolWaitCount,poolWaitAvgMs:poolWaitCount?poolWaitTotalMs/poolWaitCount:0,poolWaitMaxMs};
    fs.appendFileSync(path,JSON.stringify(row)+'\n');histogram.reset();
  },1000);timer.unref();
}
