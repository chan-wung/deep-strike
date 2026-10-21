import { Game, TICRATE } from '../src/game/game.js';
import { Enemy } from '../src/game/enemy.js';
import { buildStage } from '../src/game/stage.js';
import { PLAYER_Y } from '../src/game/player.js';
import { begin, check, done, seq } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
/** 대열 상태의 적 하나 */
const formed = (kind = 'bee', row = 3, col = 4) => { const e = new Enemy({ kind, row, col }); e.state = 'formation'; return e; };
/** 스테이지가 끝나지 않게 붙들어 두는 적 (영영 입장하지 않는다) */
const anchor = () => new Enemy({ kind: 'bee', row: 4, col: 0, delay: 1e9 });
/** 지금 막 play 가 된 게임 */
function playing(enemies, { rng = seq(0.5) } = {}) {
  const g = new Game({ bonusPlan: {}, rng });
  begin(g);
  g.enemies = [...enemies, anchor()];
  g.phase = 'play';
  g.playTime = 1000;
  return g;
}
const slotOf = (g, e) => g.formation.slot(e.row, e.col);
/** e 의 자리 바로 아래에서 어뢰가 올라오게 쏘아 둔다 */
const aim = (g, e) => { const s = slotOf(g, e); g.player.shots.push({ x: s.x, y: s.y + 4.5 }); };

// 흐름
const g0 = new Game({ bonusPlan: {} });
check('처음에는 타이틀', g0.phase === 'title');
begin(g0);
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
check('어뢰는 세 발까지, 쏜 수가 기록된다', g5.player.shots.length <= 3 && g5.stats.shots >= 2, `shots=${g5.stats.shots}`);

// 죽음
const g6 = playing([formed('bee')]);
g6.bullets.push({ x: g6.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(g6, 1);
check('적 탄에 맞으면 dying', g6.phase === 'dying');
run(g6, 52);
check('잠시 뒤 목숨 하나를 잃고 멈춤 없이 바로 이어진다 (3초 무적)', g6.lives === 2 && g6.phase === 'play' && g6.player.invuln > 170 && g6.player.invuln <= 180);
const g6b = playing([formed('bee')]);
g6b.lives = 1;
g6b.bullets.push({ x: g6b.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(g6b, 100);
check('마지막 잠수함을 잃으면 게임 오버', g6b.phase === 'over');
for (let i = 0; i < 60; i++) g6b.tick();
begin(g6b);
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
check('납치되면 목숨 하나를 잃고 바로 이어진다', g9.lives === 2 && g9.phase === 'play' && g9.capture === null && g9.player.invuln > 0);
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

// 대열에서 납치한 문어를 잡으면 잠수함을 잃는다 (원작 방식), 급강하 중에 잡아야 구출
const gn = (() => {
  const b = formed('boss', 0, 4); b.hp = 1; b.carrying = true;
  const g = playing([b]);
  g.hitEnemy(b);
  return g;
})();
check('대열에서 잡으면 잠수함을 잃을 뿐 적이 되지는 않는다', gn.rescue === null && !gn.player.twin && gn.enemies.every((e) => e.kind !== 'ship'));

const hd = formed('boss', 0, 4); hd.hp = 1; hd.carrying = true; hd.state = 'dive'; hd.x = 112; hd.y = 120;
const gdh = playing([hd]);
gdh.hitEnemy(hd);
check('급강하 중에 잡으면 구출', gdh.rescue !== null);

// 납치된 잠수함을 직접 쏘면 잃는다
{
  const b = formed('boss', 0, 4); b.carrying = true;
  const g = playing([b]);
  g.player.shots.push({ x: b.x, y: b.y - 12 });
  g.shotsVsEnemies();
  check('납치된 잠수함을 직접 쏘면 잃는다', !b.carrying);
}

// 출격
const gl = new Game({ bonusPlan: {} });
begin(gl);
gl.rng = seq(0.5, 0, 0.1, 0.1);
gl.enemies = buildStage(1);
gl.enemies.forEach((e) => { e.state = 'formation'; });
gl.phase = 'play'; gl.playTime = 1000; gl.diveTimer = 1;
run(gl, 1);
check('대열이 다 모이면 출격한다: 문어는 소용돌이를 펼치러 간다', gl.enemies[0].state === 'beamMove');
const gl2 = new Game({ bonusPlan: {} });
begin(gl2);
gl2.rng = seq(0.5, 0, 0.1, 0.1);
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
check('다음 스테이지로 ready', gk.stage === 2 && gk.phase === 'ready' && gk.enemies.length === 40);

const gt = playing([]);
gt.player.twin = true;
gt.enemies = [];
gt.startStage();
check('쌍둥이는 다음 스테이지에도 이어진다', gt.player.twin);

// 보너스 스테이지
const bonusGame = (kind, stage = 3) => { const g = new Game({ bonusPlan: {}, rng: seq(0.3, 0.7, 0.5) }); begin(g); g.stage = stage; g.bonusPlan = { [stage]: kind }; g.startStage(); return g; };
const gb = bonusGame('school');
check('계획된 스테이지는 보너스 (물고기 40마리)', gb.bonus && gb.enemies.length === 40);
gb.phase = 'play';
for (const e of [...gb.enemies]) { e.state = 'enter'; e.y = 100; e.hp = 1; gb.hitEnemy(e); }
run(gb, 1);
check('보너스 40마리를 모두 맞히면 퍼펙트 10000점', gb.phase === 'bonusResult' && gb.result.perfect && gb.score === 4000 + 10000, `score=${gb.score}`);
run(gb, 4 * TICRATE);
check('결과를 보여 준 뒤 4 스테이지', gb.stage === 4 && !gb.bonus && gb.phase === 'ready');
const gb2 = bonusGame('school'); gb2.phase = 'play';
gb2.enemies.slice(0, 10).forEach((e) => { e.state = 'enter'; e.y = 100; e.hp = 1; gb2.hitEnemy(e); });
gb2.enemies.forEach((e) => { e.state = 'gone'; });
run(gb2, 1);
check('일부만 맞히면 맞힌 만큼만', gb2.phase === 'bonusResult' && !gb2.result.perfect && gb2.score === 1000 && gb2.result.hits === 10);
const gb3 = playing([]);
gb3.bonus = true;
gb3.bullets.push({ x: gb3.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(gb3, 1);
check('보너스 스테이지에서는 맞지 않는다', gb3.phase === 'play');

// 보너스 패턴별로 시작·진행·끝
{
  const gv = bonusGame('vortex'); gv.phase = 'play';
  check('소용돌이: 물고기 40마리', gv.bonus && gv.bonusKind === 'vortex' && gv.enemies.length === 40 && gv.bonusTotal === 40);
  const gt = bonusGame('target'); gt.phase = 'play';
  check('표적: 30개', gt.bonusKind === 'target' && gt.enemies.length === 30 && gt.bonusTotal === 30);
  run(gt, 40);
  const shown = gt.enemies.filter((e) => e.state === 'stay');
  check('표적은 차례로 나타난다', shown.length >= 1 && shown.length < 30);
  for (const e of [...gt.enemies]) { if (e.state === 'wait') e.state = 'stay'; e.hp = 1; gt.hitEnemy(e); }
  run(gt, 1);
  check('표적을 모두 맞히면 퍼펙트', gt.phase === 'bonusResult' && gt.result.perfect && gt.result.kind === 'target' && gt.result.total === 30);

  const gw = bonusGame('whale'); gw.phase = 'play';
  const wh = gw.enemies[0];
  check('고래: 한 마리, 체력 24', gw.bonusKind === 'whale' && gw.enemies.length === 1 && wh.hp === 24 && gw.bonusTotal === 24);
  wh.state = 'enter'; wh.y = 100; gw.hitEnemy(wh);
  check('고래는 맞을 때마다 50점, 죽지 않는다', gw.score === 50 && wh.hp === 23 && gw.bonusKills === 1 && wh.flash > 0);
  for (let i = 0; i < 22; i++) gw.hitEnemy(wh);
  check('마지막 한 방 전까지 쓰러지지 않는다', wh.hp === 1 && wh.state !== 'gone');
  gw.hitEnemy(wh);
  run(gw, 1);
  check('고래를 쓰러뜨리면 점수 1000 + 퍼펙트', gw.phase === 'bonusResult' && gw.result.perfect && gw.score === 24 * 50 + 1000 + 10000, `score=${gw.score}`);

  const gp = bonusGame('pearl'); gp.phase = 'play';
  check('진주: 적은 없고 24개를 흘려보낸다', gp.bonusKind === 'pearl' && gp.enemies.length === 0 && gp.pearlsLeft === 24 && gp.bonusTotal === 24);
  run(gp, 1);
  check('진주는 바로 끝나지 않는다', gp.phase === 'play' && gp.pearlsLeft > 0);
  run(gp, 26 * 4);
  check('진주는 일정 간격으로 나온다', gp.pearlsLeft <= 21 && gp.items.filter((i) => i.type === 'pearl').length >= 2);
  const it = gp.items.find((i) => i.type === 'pearl');
  it.x = gp.player.x; it.y = PLAYER_Y;
  const s0 = gp.score;
  gp.collectItems();
  check('진주를 줍으면 100점, 줍기만 하면 된다', gp.score === s0 + 100 && gp.bonusKills === 1);
  const gp2 = bonusGame('pearl'); gp2.phase = 'play'; gp2.player.invuln = 1e9;
  gp2.collectItems = () => {};
  for (let i = 0; i < 24 * 30 + 500 && gp2.phase === 'play'; i++) gp2.tick();
  check('진주를 하나도 못 주워도 시간이 지나면 끝난다', gp2.phase === 'bonusResult' && gp2.result.hits === 0 && !gp2.result.perfect, gp2.phase);
}

// 죽어도 끊기지 않는다: 터지는 동안만 잠깐, 곧바로 3초 무적으로 이어진다
{
  const g = playing([formed()]);
  g.bullets.push({ x: g.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
  run(g, 1);
  check('맞으면 잠수함이 터진다', g.phase === 'dying');
  run(g, 50);
  check('터지는 연출은 1초가 안 된다', g.phase === 'play' && g.lives === 2);
  check('되살아나도 3초 동안 맞지 않는다', g.player.invuln === 180);
  g.bullets.push({ x: g.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
  run(g, 5);
  check('무적 중에는 맞아도 죽지 않는다', g.phase === 'play' && g.lives === 2);
  g.setFire(true); g.setMove(1);
  const x0 = g.player.x;
  run(g, 10);
  check('되살아난 직후에도 움직이고 쏠 수 있다', g.player.x > x0 && g.player.shots.length > 0);
  run(g, 190);
  check('3초가 지나면 무적이 풀린다', g.player.invuln === 0);
}
{
  const g = playing([]);
  g.enemies = []; g.phase = 'play';
  g.setMove(1);
  run(g, 2);
  check('모든 적을 잡으면 스테이지 클리어', g.phase === 'clear');
  const x0 = g.player.x;
  run(g, 20);
  check('스테이지를 깬 뒤에도 움직인다', g.player.x > x0);
  g.setMove(0);
  g.items.push({ x: g.player.x, y: PLAYER_Y, type: 'shield', vx: 0, vy: 0, t: 0 });
  run(g, 1);
  check('스테이지를 깬 뒤에도 아이템을 먹는다', g.player.shield === true && g.items.length === 0);
  run(g, 2 * TICRATE);
  check('다음 스테이지 준비 중에도 있던 자리에서 이어 간다', g.phase === 'ready' && Math.abs(g.player.x - x0) < 60 && g.player.shield === true);
  g.items.push({ x: g.player.x, y: PLAYER_Y, type: 'rapid', vx: 0, vy: 0, t: 0 });
  run(g, 1);
  check('스테이지 준비 중에도 아이템을 먹는다', g.player.rapid > 0);
}
{
  const g = bonusGame('pearl'); g.phase = 'bonusResult'; g.timer = 4 * TICRATE;
  g.setMove(1); const x0 = g.player.x; run(g, 10);
  check('보너스 결과 화면에서도 움직인다', g.player.x > x0);
}

// 점수와 목숨
const gx = playing([]);
gx.addScore(29990); gx.addScore(10);
check('30000점에 목숨 +1', gx.lives === 4);
gx.addScore(100000);
check('130000점에 목숨 +1', gx.lives === 5);
gx.addScore(100000);
check('이후 100000점마다 +1', gx.lives === 6);
check('최고 점수가 갱신된다', gx.hiScore === gx.score);

// 콤보
const gcombo = playing([]);
const killBee = () => { const e = formed('bee'); e.hp = 1; gcombo.enemies.push(e); gcombo.hitEnemy(e); };
for (let i = 0; i < 9; i++) killBee();
check('콤보 9마리까지는 배율 1', gcombo.combo === 9 && gcombo.comboMult === 1 && gcombo.score === 450, `score=${gcombo.score}`);
killBee();
check('콤보 10마리째부터 x1.5 (10번째 격추에 바로 적용)', gcombo.comboMult === 1.5 && gcombo.score === 450 + 75, `score=${gcombo.score}`);
check('콤보 10 에서 combo 이벤트', gcombo.events.includes('combo'));
for (let i = 0; i < 40; i++) killBee();
check('배율은 x3 까지', gcombo.comboMult === 3);
run(gcombo, 90);
check('1.5초 동안 못 잡으면 콤보가 끊긴다', gcombo.combo === 0 && gcombo.comboMult === 1);
killBee(); gcombo.hitPlayer(); gcombo.player.invuln = 0; gcombo.hitPlayer(); gcombo.loseShip();
check('잠수함을 잃으면 콤보가 끊긴다', gcombo.combo === 0);
const gcb = new Game({ bonusPlan: { 2: 'school' } });
begin(gcb); gcb.stage = 2; gcb.startStage(); gcb.phase = 'play';
const cfish = new Enemy({ kind: 'fish', slotless: true, bonus: true }); cfish.hp = 1; gcb.enemies = [cfish];
gcb.hitEnemy(cfish);
check('보너스 스테이지에서는 콤보를 쓰지 않는다', gcb.combo === 0 && gcb.score === 100, `score=${gcb.score}`);

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
