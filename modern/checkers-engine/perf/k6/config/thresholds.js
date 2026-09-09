export const thresholds = {
  wave_b_unexpected_error: ['rate<0.01'],
  wave_b_server_5xx: ['rate<0.001'],
  wave_b_fast_read_ms: ['p(95)<200', 'p(99)<500'],
  wave_b_normal_command_ms: ['p(95)<300', 'p(99)<750'],
  wave_b_complex_read_ms: ['p(95)<500', 'p(99)<1000'],
};
export const classes=Object.freeze({FAST:'fast',NORMAL:'normal',COMPLEX:'complex'});
