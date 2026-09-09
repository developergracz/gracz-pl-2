// Long-lived SSE capacity is executed by perf/scripts/wave-b-sse-load.mjs.
// This k6 entrypoint remains as the documented scenario surface and runs the mixed HTTP control workload.
export {options,default,handleSummary} from './_runner.js';
