import { Game, TICRATE } from '../src/game/game.js';
import { Enemy } from '../src/game/enemy.js';
import { buildStage } from '../src/game/stage.js';
import { PLAYER_Y } from '../src/game/player.js';
import { check, done, seq } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
/** 대열 상태의 적 하나 */
const formed = (kind = 'bee', row = 3, col = 4) => { const e = new Enemy({ kind, row, col }); e.state = 'formation'; return e; };
/** 스테이지가 끝나지 않게 붙들어 두는 적 (영영 입장하지 않는다) */
const anchor = () => new Enemy({ kind: 'bee', row: 4, col: 0, delay: 1e9 });
/** 지금 막 play 가 된 게임 */
function playing(enemies, { rng = seq(0.5) } = {}) {
  const g = new Game({ rng });
  g.start();
  g.enemies = [...enemies, anchor()];
  g.phase = 'play';
  g.playTime = 1000;
  return g;
}
const slotOf = (g, e) => g.formation.slot(e.row, e.col);
/** e 의 자리 바로 아래에서 어뢰가 올라오게 쏘아 둔다 */
const aim = (g, e) => { const s = slotOf(g, e); g.player.shots.push({ x: s.x, y: s.y + 4.5 }); };

// 흐름
const g0 = new Game();
check('처음에는 타이틀', g0.phase === 'title');
g0.start();
check('아무 키나 누르면 ready', g0.phase === 'ready' && g0.lives === 3 && g0.stage === 1);
run(g0, 2 * TICRATE);
check('2초 뒤 play', g0.phase === 'play');
check('스테이지 1 은 보너스가 아니다', !g0.bonus);
g0.pause(); const f0 = g0.frame; run(g0, 30);
check('일시정지 중에는 시계가 멈춘다', g0.frame === f0);
g0.resume(); run(g0, 1);
check('다시 하면 계속', g0.frame === f0 + 1);

// 어뢰와 점수
const bee = formed('bee');
const g1 = playing([bee]);
aim(g1, bee); g1.stats.shots = 1;
run(g1, 1);
check('해파리 한 발: 대열 50점', g1.score === 50 && g1.stats.hits === 1, `score=${g1.score}`);
const boss = formed('boss', 0, 4);
const g2 = playing([boss]);
aim(g2, boss); run(g2, 1);
check('문어 첫 발: 점수 없이 맞기만', g2.score === 0 && boss.hp === 1);
aim(g2, boss); run(g2, 1);
check('문어 둘째 발: 150점', g2.score === 150, `score=${g2.score}`);

const g3 = playing([]);
const dv = formed('butterfly', 1, 3); dv.state = 'dive'; dv.hp = 1;
g3.enemies.push(dv);
g3.hitEnemy(dv);
check('급강하 중인 복어: 160점', g3.score === 160);
const g4 = playing([]);
const bo = formed('boss', 0, 4); bo.state = 'dive'; bo.hp = 1; bo.group = bo.id;
const mates = [formed('butterfly', 1, 3), formed('butterfly', 1, 4)];
mates.forEach((m) => { m.state = 'dive'; m.group = bo.id; });
g4.enemies.push(bo, ...mates);
g4.hitEnemy(bo);
check('호위 둘을 데리고 급강하하는 문어: 1600점', g4.score === 1600, `score=${g4.score}`);
const g4b = playing([]);
const bo2 = formed('boss', 0, 4); bo2.state = 'dive'; bo2.hp = 1; bo2.group = bo2.id;
const m2 = formed('butterfly', 1, 3); m2.state = 'dive'; m2.group = bo2.id;
g4b.enemies.push(bo2, m2);
g4b.hitEnemy(bo2);
check('호위 하나: 800점', g4b.score === 800);

// 어뢰 수
const g5 = playing([formed('bee')]);
g5.setFire(true); run(g5, 30);
check('어뢰는 두 발까지, 쏜 수가 기록된다', g5.player.shots.length <= 2 && g5.stats.shots >= 2, `shots=${g5.stats.shots}`);

// 죽음
const g6 = playing([formed('bee')]);
g6.bullets.push({ x: g6.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(g6, 1);
check('적 탄에 맞으면 dying', g6.phase === 'dying');
run(g6, 91);
check('잠시 뒤 목숨 하나를 잃고 다시 준비', g6.lives === 2 && g6.phase === 'ready' && g6.readyKind === 'ready');
const g6b = playing([formed('bee')]);
g6b.lives = 1;
g6b.bullets.push({ x: g6b.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(g6b, 100);
check('마지막 잠수함을 잃으면 게임 오버', g6b.phase === 'over');
g6b.start();
check('게임 오버에서 키를 누르면 새 게임', g6b.phase === 'ready' && g6b.lives === 3 && g6b.score === 0);

const g7 = playing([formed('bee')]);
const diver = formed('bee', 3, 5); diver.state = 'dive'; diver.beginDive({ shotsPerDive: 0 }, 112, 1); diver.x = g7.player.x; diver.y = PLAYER_Y;
g7.enemies.push(diver);
diver.path = { points: [{ x: g7.player.x, y: PLAYER_Y }, { x: g7.player.x, y: PLAYER_Y + 100 }], cum: [0, 100], length: 100 };
diver.d = 0;
run(g7, 1);
check('급강하하는 적에게 부딪혀도 죽는다', g7.phase === 'dying' || g7.player.invuln > 0);

// 쌍둥이
const g8 = playing([formed('bee')]);
g8.player.twin = true;
g8.bullets.push({ x: g8.player.x + 14, y: PLAYER_Y, vx: 0, vy: 0 });
run(g8, 1);
check('쌍둥이는 한 대만 잃고 계속', g8.phase === 'play' && !g8.player.twin && g8.player.invuln > 0 && g8.lives === 3);
g8.bullets.push({ x: g8.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(g8, 1);
check('깜빡이는 동안은 맞지 않는다', g8.phase === 'play');

// 납치
const cb = formed('boss', 0, 4);
const g9 = playing([cb]);
cb.state = 'beam'; cb.timer = 100; cb.x = g9.player.x; cb.y = 170; cb.beamLen = 96;
check('예비 잠수함이 있으면 납치할 수 있다', g9.canCapture() === false, '(이미 소용돌이 중이라 새로 납치 못함)');
run(g9, 1);
check('소용돌이 안에 있으면 captured', g9.phase === 'captured' && g9.capture && cb.state === 'hold');
run(g9, 160);
check('납치되면 목숨 하나를 잃고 다시 준비', g9.lives === 2 && g9.phase === 'ready' && g9.capture === null);
check('문어는 잠수함을 데리고 대열로 돌아간다', cb.carrying && (cb.state === 'toSlot' || cb.state === 'formation'));
run(g9, 400);
check('납치한 문어가 대열에 자리잡는다', cb.state === 'formation' && cb.carrying);

const gc = playing([formed('bee')]);
check('보통 때는 납치 가능', gc.canCapture());
gc.lives = 1;
check('예비 잠수함이 없으면 납치하지 않는다', !gc.canCapture());
gc.lives = 3; gc.player.twin = true;
check('쌍둥이면 납치하지 않는다', !gc.canCapture());
gc.player.twin = false; gc.enemies[0].carrying = true;
check('이미 납치 중이면 또 납치하지 않는다', !gc.canCapture());

// 구출
const rb = formed('boss', 0, 4); rb.hp = 1; rb.carrying = true; rb.state = 'dive'; rb.x = 112; rb.y = 120;
const gr = playing([rb]);
gr.hitEnemy(rb);
check('급강하하는 납치 문어를 잡으면 잠수함이 풀려난다', gr.rescue !== null && gr.score === 400);
for (let i = 0; i < 300 && gr.rescue; i++) gr.tick();
check('구출된 잠수함이 옆에 붙어 쌍둥이', gr.player.twin && gr.rescue === null && gr.phase === 'play');
gr.player.setMove(1); run(gr, 400);
check('쌍둥이도 화면 안에 머문다', gr.player.rect().x1 <= 224);

const hb = formed('boss', 0, 4); hb.hp = 1; hb.carrying = true;
const gh = playing([hb]);
gh.hitEnemy(hb);
check('대열에서 잡으면 구출되지 않고 적 잠수함이 덤빈다', gh.rescue === null && gh.enemies.some((e) => e.kind === 'ship' && e.diving));
const gs = gh.enemies.find((e) => e.kind === 'ship');
gs.hp = 1; gh.hitEnemy(gs);
check('적 잠수함을 잡으면 100점', gh.score === 400 + 100 || gh.score === 150 + 100);

// 출격
const gl = new Game({ rng: seq(0.5, 0, 0.1, 0.1) });
gl.start();
gl.enemies = buildStage(1);
gl.enemies.forEach((e) => { e.state = 'formation'; });
gl.phase = 'play'; gl.playTime = 1000; gl.diveTimer = 1;
run(gl, 1);
check('대열이 다 모이면 출격한다: 문어는 소용돌이를 펼치러 간다', gl.enemies[0].state === 'beamMove');
const gl2 = new Game({ rng: seq(0.5, 0, 0.1, 0.1) });
gl2.start();
gl2.lives = 1;
gl2.enemies = buildStage(1);
gl2.enemies.forEach((e) => { e.state = 'formation'; });
gl2.phase = 'play'; gl2.playTime = 1000; gl2.diveTimer = 1;
run(gl2, 1);
const out = gl2.enemies.filter((e) => e.state === 'dive');
check('예비가 없으면 문어는 호위 복어 둘과 함께 급강하', gl2.enemies[0].state === 'dive' && out.length === 3 && out.filter((e) => e.kind === 'butterfly').length === 2);

// 스테이지
const bs = formed('bee');
const gk = playing([bs]);
gk.enemies = [bs];
aim(gk, bs); run(gk, 1);
check('모두 처치하면 clear', gk.phase === 'clear');
run(gk, 2 * TICRATE);
check('다음 스테이지로 ready', gk.stage === 2 && gk.phase === 'ready' && gk.readyKind === 'stage' && gk.enemies.length === 40);

const gt = playing([]);
gt.player.twin = true;
gt.enemies = [];
gt.startStage();
check('쌍둥이는 다음 스테이지에도 이어진다', gt.player.twin);

// 보너스 스테이지
const gb = new Game();
gb.start(); gb.stage = 3; gb.startStage();
check('3 스테이지는 보너스 (물고기 40마리)', gb.bonus && gb.enemies.length === 40);
gb.phase = 'play';
for (const e of [...gb.enemies]) { e.state = 'enter'; e.y = 100; e.hp = 1; gb.hitEnemy(e); }
run(gb, 1);
check('보너스 40마리를 모두 맞히면 퍼펙트 10000점', gb.phase === 'bonusResult' && gb.result.perfect && gb.score === 4000 + 10000, `score=${gb.score}`);
run(gb, 4 * TICRATE);
check('결과를 보여 준 뒤 4 스테이지', gb.stage === 4 && !gb.bonus && gb.phase === 'ready');
const gb2 = new Game();
gb2.start(); gb2.stage = 3; gb2.startStage(); gb2.phase = 'play';
gb2.enemies.slice(0, 10).forEach((e) => { e.state = 'enter'; e.y = 100; e.hp = 1; gb2.hitEnemy(e); });
gb2.enemies.forEach((e) => { e.state = 'gone'; });
run(gb2, 1);
check('일부만 맞히면 맞힌 만큼만', gb2.phase === 'bonusResult' && !gb2.result.perfect && gb2.score === 1000 && gb2.result.hits === 10);
const gb3 = playing([]);
gb3.bonus = true;
gb3.bullets.push({ x: gb3.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(gb3, 1);
check('보너스 스테이지에서는 맞지 않는다', gb3.phase === 'play');

// 점수와 목숨
const gx = playing([]);
gx.addScore(19990); gx.addScore(10);
check('20000점에 목숨 +1', gx.lives === 4);
gx.addScore(50000);
check('70000점에 목숨 +1', gx.lives === 5);
gx.addScore(70000);
check('이후 70000점마다 +1', gx.lives === 6);
check('최고 점수가 갱신된다', gx.hiScore === gx.score);

// 재진입한 적도 다시 맞힐 수 있다
const gz = playing([]);
check('문어 소용돌이를 피해 가만히 있으면 안전 (플레이어가 범위 밖)', (() => {
  const b = formed('boss', 0, 4); b.state = 'beam'; b.timer = 100; b.x = 30; b.y = 170; b.beamLen = 96;
  gz.enemies.push(b);
  gz.player.x = 180;
  run(gz, 5);
  return gz.phase === 'play';
})());
done();
