import { Game } from '../src/game/game.js';
import { Enemy } from '../src/game/enemy.js';
import { Player, PLAYER_Y, TWIN_GAP } from '../src/game/player.js';
import { WEAPONS, WEAPON_AMMO, itemPool, pickItem, pickWeapon } from '../src/game/weapons.js';
import { begin, check, done, seq } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
const kinds = (stage) => itemPool(stage).map(([k]) => k).join();
const formed = (x, y) => { const e = new Enemy({ kind: 'bee', row: 3, col: 4 }); e.state = 'formation'; e.x = x; e.y = y; return e; };
const anchor = () => new Enemy({ kind: 'bee', row: 4, col: 0, delay: 1e9 });
function playing(enemies) {
  const g = new Game({ bonusPlan: {}, rng: seq(0.5) });
  begin(g);
  g.enemies = [...enemies, anchor()];
  g.phase = 'play';
  g.playTime = 1000;
  return g;
}

// 분배: 스테이지에 따라 무기가 열린다
check('무기는 다섯 종류', WEAPONS.join() === 'spread,laser,homing,blast,sonic');
check('1 스테이지는 무기 없이 기본 아이템과 영구 강화뿐', kinds(1) === 'rapid,shield,charge,boost,velo,reload');
check('확산 2, 레이저 4, 유도 7 스테이지부터', kinds(2).includes('spread') && !kinds(3).includes('laser') && kinds(4).includes('laser') && !kinds(6).includes('homing') && kinds(7).includes('homing'));
check('pickItem: 1 스테이지는 3:3:2:1:1:1 (난수 구간별)', pickItem(() => 0.1, 1) === 'rapid' && pickItem(() => 0.5, 1) === 'shield' && pickItem(() => 0.7, 1) === 'charge' && pickItem(() => 0.95, 1) === 'reload');
check('pickItem: 아주 깊은 스테이지에서는 모든 종류가 나온다', (() => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickItem(() => i / 200, 20));
  return seen.size === 11;
})());
check('pickItem: 아직 안 열린 무기는 절대 안 나온다', (() => { for (let i = 0; i < 100; i++) if (pickItem(() => i / 100, 3) === 'laser') return false; return true; })());
check('pickWeapon: 무기만 고르고, 열린 무기가 없으면 null', WEAPONS.includes(pickWeapon(() => 0.5, 5)) && pickWeapon(() => 0.5, 1) === null && pickWeapon(() => 0.99, 5) === 'blast');

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

// 탄수제: 무기마다 정해진 탄수만큼 쏘면 기본 어뢰로
const pw = new Player();
pw.setWeapon('laser');
check('무기마다 탄수가 정해져 있다', WEAPONS.every((w) => WEAPON_AMMO[w] > 0) && WEAPON_AMMO.laser === 70 && pw.weapon === 'laser' && pw.ammo === 70);
for (let i = 0; i < 300; i++) pw.step(false);
check('쏘지 않고 시간이 흘러도 탄은 줄지 않는다', pw.weapon === 'laser' && pw.ammo === 70);
pw.setFire(true);
let volleys = 0;
for (let i = 0; i < 2000 && pw.weapon === 'laser'; i++) if (pw.step(true)) volleys++;
check('한 번 쏠 때마다 탄이 하나 줄고, 다 쏘면 기본 어뢰', volleys === 70 && pw.weapon === 'torpedo' && pw.ammo === 0, `volleys=${volleys}`);
pw.setFire(false);
pw.setWeapon('homing'); pw.setFire(true); for (let i = 0; i < 40; i++) pw.step(true);
const left = pw.ammo;
pw.setWeapon('spread');
check('다른 무기를 먹으면 교체되고 탄이 새로 찬다', left < WEAPON_AMMO.homing && pw.weapon === 'spread' && pw.ammo === WEAPON_AMMO.spread);
pw.setFire(false); pw.step(false);
const sp = new Player(); sp.setWeapon('spread'); sp.setFire(true); sp.step(true);
check('확산탄은 세 갈래를 쏴도 탄은 하나만 쓴다', sp.shots.length === 3 && sp.ammo === WEAPON_AMMO.spread - 1);
pw.setWeapon('nope');
check('모르는 무기는 무시', pw.weapon === 'spread');
pw.reset(true);
check('스테이지를 넘어가도(reset(true)) 무기와 남은 탄 유지', pw.weapon === 'spread' && pw.ammo === WEAPON_AMMO.spread);
pw.reset(false);
check('잠수함을 잃으면(reset) 무기가 사라진다', pw.weapon === 'torpedo' && pw.ammo === 0);

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
check('무기 아이템을 먹으면 무기가 바뀐다', gp.player.weapon === 'laser' && gp.player.ammo === WEAPON_AMMO.laser && gp.items.length === 0 && gp.popups.some((q) => q.key === 'item.laser'));

// 적이 품은 아이템: 스테이지가 오르면 무기도 나온다
const gc = new Game({ bonusPlan: {}, rng: seq(0.01, 0.99) }); begin(gc); gc.stage = 1; gc.startStage();
check('1 스테이지(보통)에서 품은 적은 무기를 품지 않는다', gc.enemies.every((e) => !e.carries || !WEAPONS.includes(e.carries)));

// 보스: 사나워질 때 무기를 떨어뜨린다
const gb = new Game({ bonusPlan: {}, rng: seq(0.5) }); begin(gb); gb.stage = 5; gb.startStage(); gb.phase = 'play';
gb.boss.state = 'fight'; gb.boss.y = 74;
gb.damageBoss(gb.boss.maxHp - Math.floor(gb.boss.maxHp * 2 / 3) + 1);
check('보스가 2단계가 되면 무기 하나를 떨어뜨린다', gb.boss.phase === 2 && gb.items.length === 1 && WEAPONS.includes(gb.items[0].type), JSON.stringify(gb.items));
gb.damageBoss(1);
check('같은 단계에서는 더 떨어뜨리지 않는다', gb.items.length === 1);

// 영구 강화: 단계가 쌓이고 잠수함을 잃으면 사라진다
const pu = new Player();
check('강화가 없으면 기본 속도', pu.speed === 1.7 && pu.shotSpeed === 4.5);
pu.boost = 2; pu.velo = 2;
check('추진기·어뢰 가속은 단계마다 빨라진다', pu.speed > 2.2 && Math.abs(pu.shotSpeed - 6.1) < 1e-9);
pu.reload = 1; pu.setFire(true); pu.step();
check('장전기는 쿨다운을 줄이고 화면 탄 수를 늘린다', pu.cooldown === 6);
for (let i = 0; i < 12; i++) pu.step();
check('장전기 1단계: 화면에 세 발까지', pu.shots.length === 3, `shots=${pu.shots.length}`);
pu.reset(true);
check('스테이지를 넘어가도 강화 유지', pu.boost === 2 && pu.velo === 2 && pu.reload === 1);
pu.reset(false);
check('잠수함을 잃으면 강화가 모두 사라진다', pu.boost === 0 && pu.velo === 0 && pu.reload === 0);
const pv = new Player(); pv.velo = 1; pv.setWeapon('laser'); pv.setFire(true); pv.step();
check('어뢰 가속은 새 무기의 탄속도 올린다', Math.abs(pv.shots[0].vy) > 8.7);

const gu = playing([]);
for (const type of ['boost', 'boost', 'boost']) { gu.items.push({ x: gu.player.x, y: PLAYER_Y, type }); gu.collectItems(); }
check('같은 강화를 먹을 때마다 한 단계, 최대 3', gu.player.boost === 3);
const sc = gu.score;
gu.items.push({ x: gu.player.x, y: PLAYER_Y, type: 'boost' }); gu.collectItems();
check('최대 단계에서는 단계가 오르지 않고 점수를 준다', gu.player.boost === 3 && gu.score > sc);

// 폭발 어뢰: 맞은 자리 주변의 적을 모두 잡는다
const ba = formed(100, 150), bb = formed(100, 150), bf = new Enemy({ kind: 'bee', row: 3, col: 0 });
bf.state = 'formation';
const gx = playing([ba, bb, bf]);
run(gx, 1);
gx.player.shots.push({ x: ba.x, y: ba.y + 3, kind: 'blast', vx: 0, vy: -3.8, blast: true, hit: new Set() });
run(gx, 3);
check('폭발 어뢰는 맞은 적 옆의 적도 함께 잡는다', ba.state === 'gone' && bb.state === 'gone', `${ba.state}/${bb.state}`);
check('폭발 범위 밖의 적은 무사하다', bf.state !== 'gone');

// 음파 링: 짧은 사거리, 날아가며 넓어진다
const ps = new Player(); ps.setWeapon('sonic'); ps.setFire(true); ps.step(); ps.setFire(false);
check('음파 링은 관통 탄이다', ps.shots.length === 1 && ps.shots[0].pierce === true && ps.shots[0].w === 4);
for (let i = 0; i < 29; i++) ps.step(false);
check('음파 링은 날아가며 넓어진다', ps.shots.length === 1 && ps.shots[0].w > 4 && ps.shots[0].w <= 14);
const sy = ps.shots[0].y;
check('음파 링은 보스(아래쪽 y≈98)까지 닿는다', PLAYER_Y - 8 - 3 * 60 < 98 && sy > 0);
for (let i = 0; i < 31; i++) ps.step(false);
check('음파 링은 60틱 뒤에 사라진다', ps.shots.length === 0);

done();
