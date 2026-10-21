import { Game, TICRATE, LIVES, LATE_FROM, ITEM_TYPES, ITEM_LIFE } from '../src/game/game.js';
import { Enemy } from '../src/game/enemy.js';
import { buildStage } from '../src/game/stage.js';
import { Player, RAPID_TICKS } from '../src/game/player.js';
import { PLAYER_Y } from '../src/game/player.js';
import { H } from '../src/game/paths.js';
import { check, done, seq } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
const formed = (kind = 'bee', row = 3, col = 4) => { const e = new Enemy({ kind, row, col }); e.state = 'formation'; return e; };
const anchor = () => new Enemy({ kind: 'bee', row: 4, col: 0, delay: 1e9 });
function playing(enemies, { rng = seq(0.5) } = {}) {
  const g = new Game({ bonusPlan: {}, rng });
  g.start();
  g.enemies = [...enemies, anchor()];
  g.phase = 'play';
  g.playTime = 1000;
  return g;
}

// 난이도는 하나: 잠수함 3대, 11 스테이지부터 조금 더 어렵다
const gn = new Game({ bonusPlan: {} }); gn.start();
check('잠수함 3대로 시작', gn.lives === LIVES && LIVES === 3);
const lateAt = (stage) => { const q = new Game({ bonusPlan: {} }); q.start(); q.stage = stage; return q; };
check(`${LATE_FROM} 스테이지부터 동시 급강하가 하나 는다`, LATE_FROM === 11 && lateAt(11).maxDivers === Math.min(2 + (11 >> 1), 6) + 1 && lateAt(10).maxDivers === Math.min(2 + (10 >> 1), 6));
const bulletSpeed = (stage) => { const q = lateAt(stage); q.makeEnv().shoot(10, 10, Math.PI / 2, 2); return q.bullets[0].vy; };
check('적 탄은 11 스테이지부터 1.1배 빠르다', Math.abs(bulletSpeed(10) - 2) < 1e-9 && Math.abs(bulletSpeed(11) - 2.2) < 1e-9);
check('크라켄 체력은 60 (난이도 배율 없음)', (() => { const q = lateAt(5); q.startStage(); return q.boss.maxHp === 60; })());
check('기록에는 난이도가 없다', (() => { const q = new Game({ bonusPlan: {} }); q.start(); q.lives = 1; q.score = 10; q.bullets.push({ x: q.player.x, y: PLAYER_Y, vx: 0, vy: 0 }); q.phase = 'play'; q.enemies = [formed()]; run(q, 100); return q.lastRecord && q.lastRecord.diff === undefined; })());

// 아이템: 품은 적이 미리 정해져 있고(반짝임), 잡으면 반드시 떨어뜨린다
check('아이템은 세 종류', ITEM_TYPES.join() === 'rapid,shield,charge');
const stageCarriers = (rngSeq, stage = 1, plan = {}) => { const g = new Game({ bonusPlan: plan }); g.start(); g.stage = stage; g.startStage(); g.rng = seq(...rngSeq); g.enemies = buildStage(stage, null, plan); g.assignItems(g.enemies); return g.enemies; };
check('품을 확률이 안 되면 아무도 안 품는다', stageCarriers([0.5]).every((e) => e.carries === null));
check('확률이 되면 두 번째 난수로 종류가 정해진다 (이 경우 모두 방어막)', stageCarriers([0.01, 0.4]).every((e) => e.carries === 'shield'));
check('종류는 난수에 따라 rapid / shield / charge', (() => { const e = stageCarriers([0.01, 0.0])[0], f = stageCarriers([0.01, 0.7])[0]; return e.carries === 'rapid' && f.carries === 'charge'; })());
check('보너스 물고기는 아이템을 품지 않는다', stageCarriers([0.01, 0.4], 3, { 3: 'school' }).every((e) => e.carries === null));
check('새 게임 스테이지에서 실제로 일부 적이 품고 나온다', (() => { let n = 0, x = 12345; const g = new Game({ bonusPlan: {}, rng: () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; } }); for (let i = 0; i < 20; i++) { g.stage = 1; g.startStage(); n += g.enemies.filter((e) => e.carries).length; } return n > 40 && n < 160; })());

const bee = formed(); bee.carries = 'shield';
const gi = playing([bee]);
gi.hitEnemy(bee);
check('아이템을 품은 적을 잡으면 반드시 떨어뜨린다 (방어막)', gi.items.length === 1 && gi.items[0].type === 'shield', JSON.stringify(gi.items));
const y0 = gi.items[0].y; run(gi, 10);
check('아이템은 천천히 아래로 흘러간다', gi.items.length === 1 && gi.items[0].y > y0);
gi.items[0].x = gi.player.x; gi.items[0].y = PLAYER_Y;
run(gi, 1);
check('잠수함에 닿으면 먹는다', gi.items.length === 0 && gi.player.shield === true && gi.events.includes('pickup'));
const gm = playing([formed()]);
gm.hitEnemy(gm.enemies[0]);
check('아무것도 품지 않은 적은 떨어뜨리지 않는다', gm.items.length === 0);
const gw = playing([formed()]);
gw.enemies[0].carries = 'charge'; gw.enemies[0].hp = 1;
gw.kill(gw.enemies[0], true);
check('해일로 잡아도 품은 아이템은 떨어진다', gw.items.length === 1 && gw.items[0].type === 'charge');
const gdv = playing([]);
const dvv = formed('butterfly', 1, 3); dvv.carries = 'rapid'; dvv.state = 'dive'; dvv.hp = 1; gdv.enemies.push(dvv);
gdv.hitEnemy(dvv);
check('급강하 중에 잡아도 떨어진다', gdv.items.length === 1 && gdv.items[0].type === 'rapid');
const gmin = new Game({ bonusPlan: {}, rng: seq(0.01, 0.0, 0.5) });
gmin.start(); gmin.stage = 5; gmin.startStage(); gmin.rng = seq(0.01, 0.0, 0.5);
gmin.spawnMinion(100, 80);
check('크라켄이 풀어 놓는 해파리도 아이템을 품을 수 있다', gmin.enemies.length === 1 && gmin.enemies[0].carries === 'rapid');
const gr = playing([formed()]); gr.enemies[0].carries = 'rapid';
gr.hitEnemy(gr.enemies[0]);
gr.items[0].x = gr.player.x; gr.items[0].y = PLAYER_Y; run(gr, 1);
check('연사 강화를 먹으면 남은 시간이 생긴다', gr.player.rapid > RAPID_TICKS - 5 && gr.player.rapid <= RAPID_TICKS);
const gc = playing([formed()]); gc.enemies[0].carries = 'charge';
gc.hitEnemy(gc.enemies[0]);
const bombs0 = gc.bombs;
gc.items[0].x = gc.player.x; gc.items[0].y = PLAYER_Y; run(gc, 1);
check('해일 충전을 먹으면 폭탄 +1', gc.bombs === bombs0 + 1, `bombs=${gc.bombs}`);
const gfall = playing([formed()]); gfall.enemies[0].carries = 'shield';
gfall.hitEnemy(gfall.enemies[0]);
gfall.collectItems = () => {};          // 우연히 닿아 먹히지 않게
run(gfall, 400);
const bx = gfall.items[0];
check('못 먹은 아이템은 화면 안에서 튕겨 다닌다', gfall.items.length === 1 && bx.x >= 8 && bx.x <= 216 && bx.y >= 40 && bx.y <= 280, JSON.stringify(bx));
run(gfall, ITEM_LIFE);
check('튕겨 다니다 시간이 지나면 사라진다', gfall.items.length === 0);

// 연사 강화
const pn = new Player(); pn.setFire(true);
const pr = new Player(); pr.setFire(true); pr.rapid = RAPID_TICKS;
let fn = 0, fr = 0;
for (let i = 0; i < 20; i++) { fn += pn.step() ? 1 : 0; fr += pr.step() ? 1 : 0; pn.shots = pn.shots.slice(0, 0); pr.shots = pr.shots.slice(0, 0); }
check('연사 강화는 더 자주 쏜다', fr > fn, `normal=${fn} rapid=${fr}`);
const p3 = new Player(); p3.rapid = RAPID_TICKS; p3.setFire(true);
for (let i = 0; i < 40; i++) p3.step();
check('연사 강화는 탄이 줄줄이 이어 나간다 (같은 간격으로 여러 발)', p3.shots.length >= 6 && p3.shots.slice(1).every((s, i) => Math.abs(s.y - p3.shots[i].y - 18) < 1e-9), `shots=${p3.shots.length}`);
const pe = new Player(); pe.rapid = 3;
for (let i = 0; i < 5; i++) pe.step();
check('시간이 지나면 끝난다', pe.rapid === 0);
check('다음 스테이지로 가도 아이템 효과는 이어진다, 잠수함을 잃으면 사라진다', (() => { const q = new Player(); q.rapid = 100; q.shield = true; q.reset(true); const keep = q.rapid === 100 && q.shield; q.reset(false); return keep && q.rapid === 0 && !q.shield; })());

// 방어막
const gs = playing([formed()]);
gs.player.shield = true;
gs.bullets.push({ x: gs.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(gs, 1);
check('방어막은 한 번 막는다 (죽지 않고, 방어막은 사라지고, 잠시 무적)', gs.phase === 'play' && !gs.player.shield && gs.player.invuln > 0 && gs.lives === 3 && gs.events.includes('shield'));
gs.player.invuln = 0;
gs.bullets.push({ x: gs.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(gs, 1);
check('두 번째는 맞는다', gs.phase === 'dying');
const gt = playing([formed()]);
gt.player.shield = true; gt.player.twin = true;
gt.bullets.push({ x: gt.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(gt, 1);
check('방어막이 있으면 쌍둥이도 지킨다', gt.player.twin && !gt.player.shield);

// 돌진
const dashRun = (stage, r) => {
  const g = new Game({ bonusPlan: {} });
  g.start(); g.stage = stage; g.startStage();
  g.rng = seq(...r);
  const e = formed('bee', 3, 4); e.x = 112; e.y = 90;
  g.enemies = [e, anchor()]; g.phase = 'play';
  g.launch();
  return e;
};
const dash = dashRun(4, [0, 0.9, 0.05]);
check('4 스테이지부터 돌진 급강하가 나온다', dash.state === 'dive' && dash.speedMul > 1.5 && dash.shotsLeft === 0);
check('돌진은 곧장 화면 아래까지 간다', dash.path.points.at(-1).y > H && Math.abs(dash.path.points[Math.floor(dash.path.points.length / 2)].x - (112 + (dash.path.points.at(-1).x - 112) / 2)) < 30);
check('돌진 확률이 안 되면 보통 급강하', dashRun(4, [0, 0.9, 0.95]).speedMul === 1);
check('3 스테이지 이하에서는 돌진이 없다', dashRun(2, [0, 0.9, 0.0]).speedMul === 1);
const dd = dashRun(4, [0, 0.9, 0.05]); const dn = dashRun(4, [0, 0.9, 0.95]);
const env = { slot: () => ({ x: 112, y: 50 }), diveSpeed: 2, shotsPerDive: 0, fire: () => {} };
for (let i = 0; i < 20; i++) { dd.step(env); dn.step(env); }
check('돌진이 더 빠르다', dd.d > dn.d * 1.5, `${dd.d} vs ${dn.d}`);
dd.recall();
check('쓰러지면 속도 배율 초기화', dd.speedMul === 1);

// 효과음 이벤트와 화면 흔들림
const ev = playing([formed()], { rng: seq(0.5) });
ev.events.length = 0;
ev.setFire(true); run(ev, 2);
check('어뢰를 쏘면 shot 이벤트', ev.events.includes('shot'));
ev.events.length = 0;
ev.hitEnemy(ev.enemies[0]);
check('적을 잡으면 boom 이벤트', ev.events.includes('boom'));
const eu = playing([formed()]); eu.events.length = 0; eu.ult();
check('필살기는 ult 이벤트와 화면 흔들림', eu.events.includes('ult') && eu.shakeT > 0);
const ec = playing([formed()]); ec.events.length = 0;
for (let i = 0; i < 200; i++) ec.emit('x');
check('이벤트 대기열은 64개까지만', ec.events.length === 64);
const es = playing([formed()]); es.events.length = 0;
es.bullets.push({ x: es.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(es, 1);
check('맞아 죽으면 dead 이벤트와 큰 흔들림', es.events.includes('dead') && es.shakeT > 0 && es.shakeMag === 4);
const t0 = es.shakeT; run(es, 30);
check('흔들림은 시간이 지나면 잦아든다', es.shakeT < t0 && es.shakeT >= 0);
const eo = playing([formed()]); eo.lives = 1; eo.events.length = 0;
eo.bullets.push({ x: eo.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(eo, 100);
check('마지막 잠수함을 잃으면 gameover 이벤트', eo.events.includes('gameover'));
const ew = new Game({ bonusPlan: {} }); ew.start(); ew.stage = 5; ew.events.length = 0; ew.startStage();
check('보스 스테이지가 시작되면 warning 이벤트', ew.events.includes('warning'));
const eb = new Game({ bonusPlan: {} }); eb.start(); eb.stage = 5; eb.startStage(); eb.phase = 'play'; eb.boss.y = 62; eb.boss.state = 'fight'; eb.boss.hp = 1; eb.events.length = 0;
eb.player.shots.push({ x: eb.boss.x, y: 80 }); run(eb, 1);
check('크라켄을 쓰러뜨리면 bossdown 이벤트와 흔들림', eb.events.includes('bossdown') && eb.shakeMag === 6);
check('TICRATE', TICRATE === 60);
done();
