import { Player, PLAYER_Y, TWIN_GAP } from '../src/game/player.js';
import { W } from '../src/game/paths.js';
import { check, done } from './lib.mjs';

const p = new Player();
p.setMove(1);
for (let i = 0; i < 400; i++) p.step();
check('오른쪽 끝에서 멈춘다', p.x === W - 8);
p.setMove(-1);
for (let i = 0; i < 400; i++) p.step();
check('왼쪽 끝에서 멈춘다', p.x === 8);

const q = new Player();
q.setFire(true);
let fired = 0;
for (let i = 0; i < 20; i++) fired += q.step();
check('어뢰는 화면에 세 발까지', q.shots.length === 3 && fired === 3, `shots=${q.shots.length}`);
for (let i = 0; i < 80; i++) q.step();
check('어뢰는 화면 밖으로 나가면 사라진다', q.shots.every((s) => s.y > -8));

const tw = new Player();
tw.twin = true;
tw.setFire(true);
for (let i = 0; i < 40; i++) tw.step();
check('쌍둥이는 어뢰를 두 줄씩 여섯 발까지', tw.shots.length === 6, `shots=${tw.shots.length}`);
check('쌍둥이의 두 줄은 TWIN_GAP 만큼 떨어져 있다', Math.abs(tw.shots[1].x - tw.shots[0].x - TWIN_GAP) < 0.001);
check('쌍둥이는 맞는 폭이 넓다', tw.rect().x1 - tw.rect().x0 > new Player().rect().x1 - new Player().rect().x0);
tw.setMove(1);
for (let i = 0; i < 400; i++) tw.step();
check('쌍둥이도 화면 밖으로 나가지 않는다', tw.rect().x1 <= W - 2);

const s = new Player();
s.moveTo(150);
for (let i = 0; i < 200; i++) s.step();
check('터치 목표 x 로 따라간다', Math.abs(s.x - 150) < 0.01);
s.reset(true);
check('reset(true) 는 쌍둥이를 유지, reset() 은 잃는다', (() => { const a = new Player(); a.twin = true; a.reset(true); const k = a.twin; a.reset(); return k && !a.twin; })());
check('canFire=false 면 쏘지 않는다', (() => { const a = new Player(); a.setFire(true); return a.step(false) === 0 && a.shots.length === 0; })());
check('잠수함 높이', PLAYER_Y > 200);
done();
