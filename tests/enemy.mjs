import { Enemy, inBeam, BEAM_TICKS, BEAM_MAX } from '../src/game/enemy.js';
import { Formation } from '../src/game/formation.js';
import { H } from '../src/game/paths.js';
import { buildStage, isBonus, BONUS_FISH } from '../src/game/stage.js';
import { check, done } from './lib.mjs';

const f = new Formation();
const fired = [];
const env = (extra = {}) => ({ slot: (r, c) => f.slot(r, c), playTime: 0, diveSpeed: 2, shotsPerDive: 2, fire: (e) => fired.push(e.y), ...extra });
const run = (e, n, ev = env()) => { for (let i = 0; i < n && e.state !== 'gone'; i++) e.step(ev); };

const e = new Enemy({ kind: 'bee', row: 3, col: 4, delay: 50, entry: 0 });
e.step(env({ playTime: 49 }));
check('delay 전에는 대기', e.state === 'wait');
e.step(env({ playTime: 50 }));
check('delay 가 지나면 입장', e.state === 'enter' && e.y < 0);
run(e, 600);
check('입장 → 자리로 → 대열', e.state === 'formation');
const s = f.slot(3, 4);
check('대열에서는 자기 자리에 있다', Math.abs(e.x - s.x) < 0.001 && Math.abs(e.y - s.y) < 0.001);

e.beginDive(env(), 112, 1);
check('급강하를 시작하면 diving', e.state === 'dive' && e.diving);
let shots = 0;
for (let i = 0; i < 1000 && e.state === 'dive'; i++) { e.step(env()); }
check('급강하 중 탄을 쏜다 (최대 shotsPerDive 발)', fired.length >= 1 && fired.length <= 2, `fired=${fired.length}`);
check('급강하가 끝나면 위에서 다시 들어온다', e.state === 'toSlot' && e.y === -16);
run(e, 600);
check('다시 대열로 돌아온다', e.state === 'formation');

const fish = new Enemy({ kind: 'fish', delay: 0, entry: 2, slotless: true, bonus: true });
run(fish, 3000);
check('보너스 물고기는 경로 끝에서 사라진다', fish.state === 'gone');

const ship = new Enemy({ kind: 'ship', slotless: true });
ship.x = 100; ship.y = 100;
ship.beginDive(env(), 100, 1);
run(ship, 3000);
check('적이 된 잠수함은 화면 밖에서 사라진다', ship.state === 'gone');

const boss = new Enemy({ kind: 'boss', row: 0, col: 3 });
boss.state = 'formation'; boss.step(env());
boss.beginBeam(100, 1);
for (let i = 0; i < 2000 && boss.state !== 'beam'; i++) boss.step(env());
check('문어는 소용돌이 자리에서 멈춰 beam', boss.state === 'beam' && Math.abs(boss.x - 100) < 1 && Math.abs(boss.y - 170) < 1);
check('소용돌이는 아래로 자란다', (() => { run(boss, 40); return boss.beamLen > 50; })());
run(boss, 100);
check('다 자라면 최대 길이', boss.beamLen === BEAM_MAX);
const by = boss.y;
check('소용돌이 안 판정', inBeam(boss, boss.x, by + 40) && !inBeam(boss, boss.x + 60, by + 40) && !inBeam(boss, boss.x, by - 5));
check('소용돌이는 아래로 갈수록 넓다', !inBeam(boss, boss.x + 8, by + 12) && inBeam(boss, boss.x + 20, by + 80));
for (let i = 0; i < BEAM_TICKS && boss.state === 'beam'; i++) boss.step(env());
check('소용돌이가 끝나면 exit', boss.state === 'exit' && boss.beamLen === 0);
for (let i = 0; i < 200 && boss.state === 'exit'; i++) boss.step(env());
check('화면 아래로 나가면 위에서 다시 들어온다', boss.state === 'toSlot' && boss.y === -16);
run(boss, 600);
check('문어도 대열로 돌아온다', boss.state === 'formation');

boss.carrying = true; boss.state = 'dive'; boss.beamLen = 10;
boss.recall();
check('recall: 출격 중이면 대열로 돌아가고 납치한 잠수함은 유지', boss.state === 'toSlot' && boss.carrying && boss.beamLen === 0);

const st1 = buildStage(1);
check('스테이지 1: 40마리 5웨이브', st1.length === 40 && new Set(st1.map((x) => x.wave)).size === 5);
check('종류별 수', st1.filter((x) => x.kind === 'boss').length === 4 && st1.filter((x) => x.kind === 'butterfly').length === 16 && st1.filter((x) => x.kind === 'bee').length === 20);
check('웨이브는 시간차로 들어온다', st1[0].delay < st1[8].delay && st1[8].delay < st1[39].delay);
check('보너스 스테이지는 3 · 7 · 11', isBonus(3) && isBonus(7) && isBonus(11) && !isBonus(4) && !isBonus(1));
const b = buildStage(3);
check('보너스 스테이지: 물고기 40마리, 모두 슬롯 없음', b.length === BONUS_FISH && b.every((x) => x.kind === 'fish' && x.slotless && x.bonus));
check('화면 높이', H === 288);
done();
