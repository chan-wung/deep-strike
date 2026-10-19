import { Formation, ROW_COLS, ROW_KIND } from '../src/game/formation.js';
import { W } from '../src/game/paths.js';
import { check, done } from './lib.mjs';

const total = ROW_COLS.reduce((n, c) => n + c.length, 0);
check('대열은 40칸 (문어 4 · 복어 16 · 해파리 20)', total === 40 && ROW_COLS[0].length === 4 && ROW_KIND.join() === 'boss,butterfly,butterfly,bee,bee');

const f = new Formation();
const seen = new Set();
ROW_COLS.forEach((cols, r) => cols.forEach((c) => seen.add(`${Math.round(f.slot(r, c).x)},${Math.round(f.slot(r, c).y)}`)));
check('모든 칸의 자리가 서로 다르다', seen.size === 40);
check('좌우 대칭 (흔들기 전)', Math.abs(f.slot(3, 0).x + f.slot(3, 9).x - W) < 0.001);
check('줄이 내려갈수록 y 가 커진다', f.slot(4, 0).y > f.slot(0, 3).y);

for (let i = 0; i < 100; i++) f.update();
check('모이는 동안은 좌우로 흔들린다', Math.abs(f.sway) > 0.5 || f.t > 0);
const w0 = f.slot(3, 9).x - f.slot(3, 0).x;
f.breathing = true;
let maxW = w0;
for (let i = 0; i < 400; i++) { f.update(); maxW = Math.max(maxW, f.slot(3, 9).x - f.slot(3, 0).x); }
check('다 모이면 벌어졌다 오므라든다 (폭이 커진다)', maxW > w0 * 1.1, `w0=${w0.toFixed(1)} max=${maxW.toFixed(1)}`);
check('다 모이면 흔들기가 잦아든다', Math.abs(f.swayAmp) < 5, `amp=${f.swayAmp.toFixed(2)}`);
done();
