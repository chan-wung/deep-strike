import { SELECT_LOCK } from '../src/game/game.js';
let fails = 0;
export function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) fails++;
}
export const done = () => process.exit(fails ? 1 : 0);
/** 정해진 수열을 돌려주는 가짜 난수 */
export const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
/** 타이틀에서 기체 고르기를 거쳐 새 게임을 시작한다 (게임 오버 등 다른 화면에서는 그냥 start). 돌려주는 값은 g */
export function begin(g) {
  if (g.phase === 'title') { g.start(); g.timer = SELECT_LOCK; }
  g.start();
  return g;
}
