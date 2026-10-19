let fails = 0;
export function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) fails++;
}
export const done = () => process.exit(fails ? 1 : 0);
/** 정해진 수열을 돌려주는 가짜 난수 */
export const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
