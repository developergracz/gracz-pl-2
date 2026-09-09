function duration(name,fallback){const value=String(__ENV[name]||fallback);return value;}
export function profile(){
  const vus=Math.max(1,Number(__ENV.WAVE_B_VUS||100));
  return {
    stages:[
      {duration:duration('WAVE_B_WARMUP','2m'),target:vus},
      {duration:duration('WAVE_B_STEADY','5m'),target:vus},
      {duration:duration('WAVE_B_COOLDOWN','2m'),target:0},
    ],
    gracefulRampDown:'15s',
  };
}
