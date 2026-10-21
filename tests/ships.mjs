import { Game, TICRATE, SELECT_LOCK } from '../src/game/game.js';
import { Enemy } from '../src/game/enemy.js';
import { Player } from '../src/game/player.js';
import { createBoss } from '../src/game/bosses.js';
import { SHIPS, SHIP_ORDER } from '../src/game/ships.js';
import { STORM_MISSILES, CARPET_RADIUS, CARPET_COLS, CARPET_ROWS } from '../src/game/specials.js';
import { addRecord, parseBoards } from '../src/app/records.js';
import { logicalPoint } from '../src/ui/touch.js';
import { shipCardAt, selectGoAt, shipArrowAt } from '../src/render/render.js';
import { begin, check, done, seq } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
const formed = (kind = 'bee', row = 3, col = 4) => { const e = new Enemy({ kind, row, col }); e.state = 'formation'; return e; };
/** 스테이지가 끝나지 않게 붙들어 두는 적 */
const anchor = () => new Enemy({ kind: 'bee', row: 4, col: 0, delay: 1e9 });
/** ship 으로 시작해 지금 막 play 가 된 게임 */
function playing(ship, enemies = []) {
  const g = new Game({ bonusPlan: {}, rng: seq(0.5) });
  g.chooseShip(ship);
  begin(g);
  g.enemies = [...enemies, anchor()];
  g.phase = 'play';
  g.playTime = 1000;
  return g;
}
/** (x, y) 에 가만히 떠 있는 적 (표적처럼 오래 머문다) */
const at = (kind, x, y) => { const e = new Enemy({ kind, slotless: true }); e.state = 'stay'; e.timer = 1e6; e.x = x; e.y = y; return e; };

// 기체 정의
check('기체는 세 가지', SHIP_ORDER.length === 3 && SHIP_ORDER.every((id) => SHIPS[id]));
check('노랑은 기존과 같다 (속도 1.7, 폭탄 3, 해일)', SHIPS.yellow.speed === 1.7 && SHIPS.yellow.bombs === 3 && SHIPS.yellow.special === 'wave');
check('다트는 빠르고 폭탄이 적다, 해머는 느리고 많다', SHIPS.dart.speed > SHIPS.yellow.speed && SHIPS.dart.bombs < 3 && SHIPS.hammer.speed < SHIPS.yellow.speed && SHIPS.hammer.bombs > 3);

// 기체 고르기: 타이틀 → 기체 고르기 화면 → 출발
const gs = new Game({ bonusPlan: {} });
check('처음에는 노랑', gs.ship === 'yellow');
check('타이틀에서는 기체를 못 고른다', gs.selectShip(1) === false && gs.ship === 'yellow');
gs.start();
check('타이틀에서 시작하면 기체 고르기 화면 (일시정지는 안 된다)', gs.phase === 'select' && gs.canPause === false && gs.music === null);
gs.start();
check('타이틀을 넘긴 입력이 곧바로 출발이 되지 않는다', gs.phase === 'select');
run(gs, SELECT_LOCK);
gs.selectShip(1);
check('→ 로 다음 기체', gs.ship === 'dart' && gs.events.includes('select'));
gs.selectShip(-1); gs.selectShip(-1);
check('← 로 이전 기체, 처음에서는 마지막으로 돌아간다', gs.ship === 'hammer');
gs.selectShip(1);
check('마지막에서 → 는 처음으로', gs.ship === 'yellow');
check('카드를 눌러 직접 고른다', gs.pickShip('dart') === true && gs.ship === 'dart' && gs.pickShip('ufo') === false && gs.ship === 'dart');
gs.chooseShip('nope');
check('알 수 없는 저장 값은 무시', gs.ship === 'dart');
gs.pickShip('hammer'); gs.start();
check('출발: 고른 기체와 그 기체의 폭탄 수로 시작', gs.phase === 'ready' && gs.player.ship === 'hammer' && gs.bombs === 4 && gs.player.weapon === 'heavy');
check('판 도중에는 기체를 못 바꾼다', gs.selectShip(1) === false && gs.pickShip('dart') === false && gs.ship === 'hammer');

// 기본 공격
const pd = new Player(); pd.setShip('dart'); pd.firing = true;
const n = pd.step(true);
check('다트: 한 번에 바늘 두 줄, 좌우로 나란히', n === 1 && pd.shots.length === 2 && pd.shots[0].x !== pd.shots[1].x && pd.shots[0].kind === 'needle');
const py = new Player(); py.firing = true; py.step(true);
check('노랑: 그대로 어뢰 한 발 {x, y}', py.shots.length === 1 && py.shots[0].kind === undefined);
const sy = py.shots[0].y, sd = pd.shots[0].y;
py.step(false); pd.step(false);
check('바늘은 어뢰보다 느리다', sd - pd.shots[0].y < sy - py.shots[0].y);
const pdt = new Player(); pdt.setShip('dart'); const pyt = new Player();
pdt.setMove(1); pyt.setMove(1); pdt.step(false); pyt.step(false);
check('다트가 노랑보다 빨리 움직인다', pdt.x > pyt.x);
const ph = new Player(); ph.setShip('hammer'); ph.setMove(1); ph.step(false);
check('해머는 노랑보다 느리다', ph.x < pyt.x);
const pw = new Player(); pw.setShip('dart'); pw.setWeapon('laser');
check('아이템 무기는 기체 기본 공격을 덮는다', pw.weapon === 'laser' && pw.weaponT > 0);
for (let i = 0; i < 900; i++) pw.step(false);
check('아이템 무기가 끝나면 이 기체의 기본 공격(바늘)으로 돌아온다', pw.weapon === 'needle');
pw.setWeapon('spread'); pw.reset(false);
check('잠수함을 잃으면 기본 공격(바늘)으로, 기체는 그대로', pw.weapon === 'needle' && pw.ship === 'dart');

// 해머의 관통 어뢰: 적 둘만 꿰뚫는다
const gh = playing('hammer', [at('bee', 100, 150), at('bee', 100, 130), at('bee', 100, 110)]);
gh.player.shots.push({ x: 100, y: 156, kind: 'heavy', k: 1, w: 2.6, pierce: true, maxHit: 2, hit: new Set() });
for (let i = 0; i < 10 && gh.player.shots.length; i++) { gh.player.moveShots(); gh.shotsVsEnemies(); }
const left = gh.enemies.filter((e) => e.kind === 'bee' && e.state !== 'gone' && e.y < 140);
check('해머 어뢰: 둘을 잡고 사라진다 (셋째는 살아남는다)', gh.stats.hits === 1 && gh.player.shots.length === 0 && gh.enemies.filter((e) => e.kind === 'bee' && e.state === 'gone').length === 2, `hits=${gh.stats.hits} left=${left.length}`);

// 어뢰 폭풍 (다트): 유도 어뢰가 적을 하나씩 추적한다
const t1 = at('butterfly', 40, 100), t2 = at('bee', 180, 120), t3 = at('bee', 110, 60);
const gn = playing('dart', [t1, t2, t3]);
gn.player.x = 112;
gn.bullets.push({ x: 120, y: 240, vx: 0, vy: 0 }, { x: 20, y: 40, vx: 0, vy: 0 });
check('다트의 필살기는 어뢰 폭풍', gn.special === 'storm' && gn.ult() === true && gn.wave.kind === 'storm' && gn.bombs === 1 && gn.flashT > 0);
run(gn, 1);
check('쏘는 순간 주변의 탄은 사라지고, 먼 탄은 남는다', !gn.bullets.some((b) => b.x === 120) && gn.bullets.some((b) => b.x === 20));
check('한 틱에 여러 발씩 나간다 (총 24발)', gn.wave.missiles.length === 3 && STORM_MISSILES === 24);
run(gn, 6);
check('쏘는 동안 맞지 않는다', gn.player.invuln > 0);
run(gn, 200);
check('폭풍이 끝나면 사라지고, 적 셋이 모두 잡힌다', gn.wave === null && [t1, t2, t3].every((e) => e.state === 'gone'), `states=${[t1, t2, t3].map((e) => e.state)}`);
check('폭풍으로 잡은 점수가 들어온다', gn.score === 80 + 50 + 50, `score=${gn.score}`);
// 적이 하나도 없으면 어뢰는 허공으로 날아가 사라진다
const gnn = playing('dart', []);
gnn.ult(); run(gnn, 200);
check('적이 없으면 어뢰는 그냥 날아가 사라지고 폭풍도 끝난다', gnn.wave === null);
// 보스: 다른 적이 없어도 보스에게 가는 어뢰는 12발까지 (발당 2)
const gsb = playing('dart'); gsb.stage = 5; gsb.boss = createBoss(5); gsb.boss.state = 'fight'; gsb.boss.y = 74; gsb.boss.x = 112;
gsb.boss.step = () => {};
gsb.player.x = 112; const bhp = gsb.boss.hp;
gsb.ult(); run(gsb, 200);
check('어뢰 폭풍은 보스에게 24 피해 (12발 × 2)', bhp - gsb.boss.hp === 24, `hp ${bhp} -> ${gsb.boss.hp}`);
const sb1 = at('bee', 40, 150), sb2 = at('bee', 180, 150);
const gsb2 = playing('dart', [sb1, sb2]); gsb2.stage = 5; gsb2.boss = createBoss(5); gsb2.boss.state = 'fight'; gsb2.boss.y = 74; gsb2.boss.x = 112; gsb2.boss.step = () => {};
gsb2.ult(); run(gsb2, 200);
check('다른 적이 있어도 보스에게 가는 어뢰는 최대 12발 (피해 12~24), 적도 잡는다', (() => { const d = gsb2.boss.maxHp - gsb2.boss.hp; return d >= 12 && d <= 24; })() && sb1.state === 'gone' && sb2.state === 'gone', `hp=${gsb2.boss.hp}`);

// 심해 폭격 (해머): 화면 전체를 연쇄 폭발로
const turtle = at('turtle', 100, 150), nearBee = at('bee', 200, 70), lowBee = at('bee', 30, 235), topBee = at('bee', 112, 20);
const gd = playing('hammer', [turtle, nearBee, lowBee, topBee]);
gd.player.x = 112;
gd.bullets.push({ x: 60, y: 110, vx: 0, vy: 0 }, { x: 210, y: 260, vx: 0, vy: 0 });
check('해머의 필살기는 심해 폭격', gd.special === 'carpet' && gd.ult() === true && gd.bombs === 3 && gd.wave.kind === 'carpet');
check('열다섯 번의 폭발을 예약한다 (5열 × 3줄)', gd.wave.blasts.length === 15 && CARPET_COLS.length * CARPET_ROWS.length === 15);
run(gd, 5);
check('폭발이 왼쪽부터 시작한다', gd.wave.next > 0 && gd.wave.next < 15);
run(gd, 100);
check('폭격이 끝나면 사라지고, 화면 곳곳의 적이 모두 잡힌다 (체력 3 거북도)', gd.wave === null && [turtle, nearBee, lowBee, topBee].every((e) => e.state === 'gone'), `states=${[turtle, nearBee, lowBee, topBee].map((e) => e.state)}`);
check('마지막 폭발에서 남은 탄이 모두 사라진다', gd.bullets.length === 0);
const gdb = playing('hammer'); gdb.stage = 5; gdb.boss = createBoss(5); gdb.boss.state = 'fight'; gdb.boss.y = 74; gdb.boss.x = 112;
gdb.boss.step = () => {};
gdb.player.x = 112; const hp0 = gdb.boss.hp;
gdb.ult(); run(gdb, 100);
check('폭격은 보스에게 큰 피해 (폭발마다 7)', hp0 - gdb.boss.hp >= 21 && (hp0 - gdb.boss.hp) % 7 === 0, `hp ${hp0} -> ${gdb.boss.hp}`);
check('폭격 반경은 46', CARPET_RADIUS === 46);

// 해일은 노랑 그대로
const gy = playing('yellow', [at('bee', 100, 100)]);
gy.player.x = 100; gy.ult(); run(gy, 60);
check('노랑의 해일은 화면 어디의 해파리든 잡는다', gy.special === 'wave' && gy.score === 50 && gy.wave === null, `score=${gy.score}`);

// 잠수함을 잃으면 폭탄은 이 기체의 처음 개수로
const gb = playing('dart'); gb.bombs = 0; gb.hitPlayer(); run(gb, 60);
check('다트가 잠수함을 잃으면 폭탄은 2개로 돌아간다', gb.lives === 2 && gb.bombs === 2, `lives=${gb.lives} bombs=${gb.bombs}`);

// 기록
const rec = { name: 'AAA', score: 500, stage: 3, ship: 'dart' };
check('기록에 기체가 남는다', addRecord([], rec).list[0].ship === 'dart');
check('기체가 없던 옛 기록은 노랑', parseBoards(JSON.stringify([{ score: 100, stage: 1 }]))[0].ship === 'yellow');
check('알 수 없는 기체 이름은 노랑', addRecord([], { ...rec, ship: 'ufo' }).list[0].ship === 'yellow');
const go = playing('hammer'); go.lives = 1; go.hitPlayer(); run(go, 60);
check('게임 오버 기록에 이번 기체가 들어간다', go.phase === 'over' && go.lastRecord.ship === 'hammer');
go.selectShip(1);
check('결과 화면에서도 기체를 고를 수 있다 (이름 입력 중에는 못 고른다)', go.ship === 'yellow' || go.naming);

// 터치 좌표 변환
const p = logicalPoint({ left: 0, top: 0, width: 224, height: 288 }, 112, 144);
check('터치: 캔버스가 꽉 찼을 때 좌표 변환', p.x === 112 && p.y === 144);
const wide = logicalPoint({ left: 0, top: 0, width: 600, height: 288 }, 300, 144);
check('터치: 옆이 남는(contain) 캔버스의 가운데는 논리 가운데', Math.abs(wide.x - 112) < 0.01 && Math.abs(wide.y - 144) < 0.01);

// 기체 고르기 화면의 터치 좌표
check('카드 셋이 가로로 나란히: 왼쪽·가운데·오른쪽', shipCardAt('select', 40, 120) === 0 && shipCardAt('select', 112, 120) === 1 && shipCardAt('select', 184, 120) === 2);
check('카드 사이 틈과 카드 위아래는 카드가 아니다', shipCardAt('select', 76, 120) === -1 && shipCardAt('select', 40, 20) === -1 && shipCardAt('select', 40, 260) === -1);
check('고르기 화면이 아니면 카드가 없다', shipCardAt('title', 40, 120) === -1 && shipCardAt('over', 40, 120) === -1);
check('출발 버튼은 아래쪽', selectGoAt('select', 252) === true && selectGoAt('select', 120) === false && selectGoAt('over', 252) === false);
check('결과 화면의 ◀ ▶ 는 따로', shipArrowAt('over', 112 - 72, 236) === -1 && shipArrowAt('over', 112 + 72, 236) === 1 && shipArrowAt('select', 40, 236) === 0 && shipArrowAt('title', 40, 172) === 0);
done();
