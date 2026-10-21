import { Enemy, inBeam, BEAM_TICKS, BEAM_MAX } from '../src/game/enemy.js';
import { Formation } from '../src/game/formation.js';
import { H, whalePath } from '../src/game/paths.js';
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

const tgt = new Enemy({ kind: 'fish', delay: 0, slotless: true, bonus: true, at: { x: 90, y: 80 }, stay: 30 });
run(tgt, 1);
check('표적은 정해진 자리에 나타난다', tgt.state === 'stay' && tgt.x === 90 && tgt.y === 80 && tgt.hittable);
run(tgt, 40);
check('표적은 정해진 시간 뒤에 사라진다', tgt.state === 'gone');
const whale = new Enemy({ kind: 'whale', delay: 0, slotless: true, bonus: true, path: whalePath(1), speed: 0.35 });
check('황금 고래는 체력이 많고 몸이 크다', whale.hp === 24 && (whale.rect().x1 - whale.rect().x0) > 30);
run(whale, 6000);
check('황금 고래도 경로 끝에서 사라진다', whale.state === 'gone');

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
check('보너스 스테이지는 계획에 든 스테이지뿐', isBonus(7, { 7: 'school' }) && !isBonus(3, { 7: 'school' }) && !isBonus(5, { 5: 'school' }));
const b = buildStage(7, null, { 7: 'school' });
check('보너스 스테이지: 물고기 40마리, 모두 슬롯 없음', b.length === BONUS_FISH && b.every((x) => x.kind === 'fish' && x.slotless && x.bonus));
check('화면 높이', H === 288);
done();
