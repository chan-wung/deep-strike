import { Game } from '../src/game/game.js';
import { Enemy } from '../src/game/enemy.js';
import { Player, PLAYER_Y, TWIN_GAP } from '../src/game/player.js';
import { WEAPONS, WEAPON_TICKS, itemPool, pickItem, pickWeapon, weaponFrom } from '../src/game/weapons.js';
import { check, done, seq } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
const kinds = (stage, d) => itemPool(stage, d).map(([k]) => k).join();
const formed = (x, y) => { const e = new Enemy({ kind: 'bee', row: 3, col: 4 }); e.state = 'formation'; e.x = x; e.y = y; return e; };
const anchor = () => new Enemy({ kind: 'bee', row: 4, col: 0, delay: 1e9 });
function playing(enemies, difficulty) {
  const g = new Game({ rng: seq(0.5) });
  if (difficulty) g.setDifficulty(difficulty);
  g.start();
  g.enemies = [...enemies, anchor()];
  g.phase = 'play';
  g.playTime = 1000;
  return g;
}

// 분배: 스테이지·난이도에 따라 무기가 열린다
check('무기는 세 종류', WEAPONS.join() === 'spread,laser,homing');
check('보통 1 스테이지는 기존 아이템 셋뿐', kinds(1, 'normal') === 'rapid,shield,charge');
check('보통: 확산 2, 레이저 4, 유도 7 스테이지부터', kinds(2, 'normal').includes('spread') && !kinds(3, 'normal').includes('laser') && kinds(4, 'normal').includes('laser') && !kinds(6, 'normal').includes('homing') && kinds(7, 'normal').includes('homing'));
check('쉬움은 한 스테이지 일찍', weaponFrom('spread', 'easy') === 1 && weaponFrom('laser', 'easy') === 3 && weaponFrom('homing', 'easy') === 6 && kinds(1, 'easy').includes('spread'));
check('어려움·무한은 한 스테이지 늦게', weaponFrom('spread', 'hard') === 3 && weaponFrom('laser', 'hard') === 5 && weaponFrom('laser', 'endless') === 5 && !kinds(2, 'hard').includes('spread'));
check('난이도마다 가중치가 다르다 (쉬움은 방어막 후하게, 어려움은 레이저 많이)', (() => {
  const w = (s, d, k) => Object.fromEntries(itemPool(s, d))[k];
  return w(9, 'easy', 'shield') > w(9, 'hard', 'shield') && w(9, 'hard', 'laser') > w(9, 'easy', 'laser') && w(9, 'easy', 'homing') > w(9, 'hard', 'homing');
})());
check('pickItem: 보통 1 스테이지는 3:3:2 (난수 구간별)', pickItem(() => 0.1, 1, 'normal') === 'rapid' && pickItem(() => 0.5, 1, 'normal') === 'shield' && pickItem(() => 0.95, 1, 'normal') === 'charge');
check('pickItem: 아주 깊은 스테이지에서는 모든 종류가 나온다', (() => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickItem(() => i / 200, 20, 'normal'));
  return seen.size === 6;
})());
check('pickItem: 아직 안 열린 무기는 절대 안 나온다', (() => { for (let i = 0; i < 100; i++) if (pickItem(() => i / 100, 3, 'normal') === 'laser') return false; return true; })());
check('pickWeapon: 무기만 고르고, 열린 무기가 없으면 null', WEAPONS.includes(pickWeapon(() => 0.5, 5, 'normal')) && pickWeapon(() => 0.5, 1, 'normal') === null && pickWeapon(() => 0.99, 5, 'normal') === 'laser');

// 발사 모양
const p = new Player();
p.setWeapon('spread'); p.setFire(true);
check('확산: 한 번에 세 발이 퍼진다', p.step() === 1 && p.shots.length === 3 && p.shots[0].vx < 0 && Math.abs(p.shots[1].vx) < 1e-9 && p.shots[2].vx > 0);
for (let i = 0; i < 40; i++) p.step();
check('확산: 화면에는 두 묶음(여섯 발)까지', p.shots.length <= 6);
const pt = new Player();
pt.twin = true; pt.setWeapon('spread'); pt.setFire(true); pt.step();
check('쌍둥이 확산: 여섯 발, 두 기체에서 나간다', pt.shots.length === 6 && Math.abs(pt.shots[3].x - pt.shots[0].x - TWIN_GAP) < 1e-9);

const pl = new Player();
pl.setWeapon('laser'); pl.setFire(true); pl.step();
check('레이저는 관통 탄이고 어뢰보다 빠르다', pl.shots[0].pierce === true && Math.abs(pl.shots[0].vy) > 4.5);

// 시간제: 15초 뒤 기본 어뢰로
const pw = new Player();
pw.setWeapon('laser');
check('무기 시간은 15초', WEAPON_TICKS === 900 && pw.weapon === 'laser' && pw.weaponT === 900);
for (let i = 0; i < 899; i++) pw.step(false);
check('15초가 다 되기 전에는 유지', pw.weapon === 'laser');
pw.step(false);
check('15초가 지나면 기본 어뢰', pw.weapon === 'torpedo' && pw.weaponT === 0);
pw.setWeapon('homing'); for (let i = 0; i < 300; i++) pw.step(false);
pw.setWeapon('spread');
check('다른 무기를 먹으면 교체되고 시간이 새로 찬다', pw.weapon === 'spread' && pw.weaponT === 900);
pw.setWeapon('nope');
check('모르는 무기는 무시', pw.weapon === 'spread');
pw.reset(true);
check('스테이지를 넘어가도(reset(true)) 무기 유지', pw.weapon === 'spread' && pw.weaponT === 900);
pw.reset(false);
check('잠수함을 잃으면(reset) 무기가 사라진다', pw.weapon === 'torpedo' && pw.weaponT === 0);

// 유도: 비스듬히 있는 적 쪽으로 휘어 간다
const ph = new Player();
ph.x = 100; ph.setWeapon('homing'); ph.setFire(true); ph.step(true, []);
const target = { x: 150, y: 120 };
const x0 = ph.shots[0].x;
for (let i = 0; i < 40; i++) ph.step(false, [target]);
check('유도탄은 오른쪽 위의 적을 향해 휜다', ph.shots.length === 0 || ph.shots[0].x > x0 + 5, ph.shots[0] && String(ph.shots[0].x));
const ph2 = new Player();
ph2.x = 100; ph2.setWeapon('homing'); ph2.setFire(true); ph2.step(true, []);
const xs = ph2.shots[0].x;
for (let i = 0; i < 10; i++) ph2.step(false, []);
check('목표가 없으면 곧게 간다', Math.abs(ph2.shots[0].x - xs) < 1e-6);

// 게임 안에서: 레이저 관통
const a = formed(100, 150), b = formed(100, 100);
const gl = playing([a, b]);
gl.player.x = 100; gl.player.setWeapon('laser');
gl.player.shots.push({ x: 100, y: 170, kind: 'laser', vx: 0, vy: -8, pierce: true, homing: false, hit: new Set() });
run(gl, 30);
check('레이저 한 발이 일렬로 선 두 마리를 모두 잡는다', a.state === 'gone' && b.state === 'gone', `${a.state}/${b.state}`);
check('레이저 한 발은 같은 적을 두 번 때리지 않는다', (() => {
  const t = formed(100, 150); t.hp = 5;
  const g2 = playing([t]);
  run(g2, 1);                                   // 대열 자리로 옮겨진 뒤의 위치에서 쏜다
  g2.player.shots.push({ x: t.x, y: t.y + 3, kind: 'laser', vx: 0, vy: -0.2, pierce: true, homing: false, hit: new Set() });
  run(g2, 12);
  return t.hp === 4;
})());

// 아이템 먹기
const gp = playing([]);
gp.items.push({ x: gp.player.x, y: PLAYER_Y, type: 'laser' });
gp.collectItems();
check('무기 아이템을 먹으면 무기가 바뀐다', gp.player.weapon === 'laser' && gp.player.weaponT === 900 && gp.items.length === 0 && gp.popups.some((q) => q.key === 'item.laser'));

// 적이 품은 아이템: 스테이지가 오르면 무기도 나온다
const gc = new Game({ rng: seq(0.01, 0.99) }); gc.start(); gc.stage = 1; gc.startStage();
check('1 스테이지(보통)에서 품은 적은 무기를 품지 않는다', gc.enemies.every((e) => !e.carries || !WEAPONS.includes(e.carries)));

// 보스: 사나워질 때 무기를 떨어뜨린다
const gb = new Game({ rng: seq(0.5) }); gb.start(); gb.stage = 5; gb.startStage(); gb.phase = 'play';
gb.boss.state = 'fight'; gb.boss.y = 74;
gb.damageBoss(gb.boss.maxHp - Math.floor(gb.boss.maxHp * 2 / 3) + 1);
check('보스가 2단계가 되면 무기 하나를 떨어뜨린다', gb.boss.phase === 2 && gb.items.length === 1 && WEAPONS.includes(gb.items[0].type), JSON.stringify(gb.items));
gb.damageBoss(1);
check('같은 단계에서는 더 떨어뜨리지 않는다', gb.items.length === 1);

done();
