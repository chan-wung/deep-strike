import { Game } from '../src/game/game.js';
import { Enemy, KINDS } from '../src/game/enemy.js';
import { SHAPES, SHAPE_ORDER } from '../src/game/formation.js';
import { buildStage, regularIndex, shapeName, mixCounts, entryPattern, isBoss, isBonus, pickBonusPlan, BONUS_KINDS, DEFAULT_PLAN } from '../src/game/stage.js';
import { createBoss, BOSS_CLASSES } from '../src/game/bosses.js';
import { Kraken } from '../src/game/kraken.js';
import { Angler, DARK_LEN, LUNGE_DEPTH } from '../src/game/angler.js';
import { Leviathan } from '../src/game/leviathan.js';
import { Manta, CURTAIN_SLOTS, CURTAIN_GAP, curtainX } from '../src/game/manta.js';
import { BOSS_HOME_Y } from '../src/game/boss.js';
import { PLAYER_Y } from '../src/game/player.js';
import { H, W } from '../src/game/paths.js';
import { setLang, t } from '../src/app/i18n.js';
import { begin, check, done, seq } from './lib.mjs';

const OLD = { 3: 'school', 7: 'school', 11: 'school' };      // 예전 고정 보너스 자리
const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
const count = (list, kind) => list.filter((e) => e.kind === kind).length;
const formed = (kind = 'bee', row = 3, col = 4) => { const e = new Enemy({ kind, row, col }); e.state = 'formation'; return e; };
const anchor = () => new Enemy({ kind: 'bee', row: 4, col: 0, delay: 1e9 });
function playing(enemies, { stage = 1, rng = seq(0.5) } = {}) {
  const g = new Game({ bonusPlan: {} });                // 난수열은 만든 뒤에 심는다 (생성·시작이 난수를 쓰기 때문)
  begin(g); g.stage = stage; g.startStage();
  g.rng = rng;
  g.enemies = [...enemies, anchor()];
  g.phase = 'play'; g.playTime = 1000;
  return g;
}
const stubEnv = (rand = () => 0.5) => { const shots = [], minions = []; return { shots, minions, targetX: 112, rand, shoot: (x, y, a, s) => shots.push({ x, y, a, s }), minion: (x, y, kind) => minions.push({ x, y, kind }) }; };

// 대열 모양
check('대열 모양은 5가지', SHAPE_ORDER.length === 5 && SHAPE_ORDER.every((n) => SHAPES[n]));
for (const name of SHAPE_ORDER) {
  const rows = SHAPES[name];
  const total = rows.reduce((n, r) => n + r.length, 0);
  check(`${name}: 5줄, 40칸, 윗줄은 가운데 4칸, 칸 번호는 0~9 에 겹치지 않는다`,
    rows.length === 5 && total === 40 && rows[0].join() === '3,4,5,6' && rows.every((r) => new Set(r).size === r.length && r.every((c) => c >= 0 && c <= 9)), `${name}=${total}`);
}
check('보통 스테이지 순번: 1,2,4,6,8,9,12 → 0..6 (3·7·11 은 보너스, 5·10·15 는 보스라 세지 않는다)', [1, 2, 4, 6, 8, 9, 12].map((s) => regularIndex(s, OLD)).join() === '0,1,2,3,4,5,6');
check('스테이지마다 모양이 바뀐다 (직사각형 → 피라미드 → 역삼각형 → 다이아몬드 → 날개 → 다시)', [1, 2, 4, 6, 8, 9, 12].map((s) => shapeName(s, OLD)).join() === 'rect,pyramid,vee,diamond,wings,rect,pyramid');

// 스테이지 구성
for (const s of [1, 2, 4, 6, 8, 9, 12, 13, 14, 16, 17, 18, 22, 40]) {
  if (isBoss(s) || isBonus(s)) continue;
  const list = buildStage(s);
  const slots = new Set(list.map((e) => `${e.row},${e.col}`));
  const want = new Set(SHAPES[shapeName(s)].flatMap((cols, r) => cols.map((c) => `${r},${c}`)));
  check(`스테이지 ${s}: 40마리, 5웨이브×8, 모양(${shapeName(s)})대로 자리가 겹치지 않게`, list.length === 40 && slots.size === 40 && [...slots].every((x) => want.has(x)) && [0, 1, 2, 3, 4].every((w) => list.filter((e) => e.wave === w).length === 8));
  check(`스테이지 ${s}: 문어 4마리는 그대로 윗줄`, list.filter((e) => e.kind === 'boss').length === 4 && list.filter((e) => e.kind === 'boss').every((e) => e.row === 0));
}
check('스테이지 1 은 전과 같은 구성 (문어 4 · 복어 16 · 해파리 20)', (() => { const l = buildStage(1); return count(l, 'boss') === 4 && count(l, 'butterfly') === 16 && count(l, 'bee') === 20; })());
check('새 적의 수: 스테이지 1 은 없고 2 부터 뱀장어', (() => { const m1 = mixCounts(1), m2 = mixCounts(2); return Object.values(m1).every((v) => v === 0) && m2.eel === 4 && m2.ray === 0; })());
check('가오리는 4, 거북은 6, 폭탄 복어는 8 스테이지부터', (() => { const a = mixCounts(4), b = mixCounts(6), c = mixCounts(8); return a.ray === 3 && a.turtle === 0 && b.turtle === 2 && b.mine === 0 && c.mine === 3; })());
check('스테이지가 오를수록 새 적이 늘어난다 (최대치까지)', (() => { const a = mixCounts(8), b = mixCounts(40); return a.eel === 7 && a.ray === 5 && a.turtle === 3 && b.eel === 12 && b.ray === 10 && b.turtle === 8 && b.mine === 10; })());
for (const s of [2, 4, 6, 8, 9, 12, 14]) {
  const l = buildStage(s), m = mixCounts(s);
  check(`스테이지 ${s}: 만들어진 새 적의 수가 mixCounts 와 같다`, ['eel', 'ray', 'turtle', 'mine'].every((k) => count(l, k) === m[k]));
}
check('새 적은 제 줄에서만 나온다 (뱀장어·폭탄은 3~4줄, 가오리·거북은 1~2줄)', (() => {
  const l = buildStage(14);
  return l.filter((e) => e.kind === 'eel' || e.kind === 'mine').every((e) => e.row >= 3) && l.filter((e) => e.kind === 'ray' || e.kind === 'turtle').every((e) => e.row === 1 || e.row === 2);
})());
check('같은 스테이지는 언제나 같은 구성 (난수 없음)', JSON.stringify(buildStage(8).map((e) => [e.kind, e.row, e.col, e.entry, e.delay])) === JSON.stringify(buildStage(8).map((e) => [e.kind, e.row, e.col, e.entry, e.delay])));
check('스테이지마다 새 적의 위치가 달라진다', JSON.stringify(buildStage(8).filter((e) => e.kind === 'eel').map((e) => [e.row, e.col])) !== JSON.stringify(buildStage(9).filter((e) => e.kind === 'eel').map((e) => [e.row, e.col])));

// 입장 패턴
check('스테이지 1 입장 경로 0,1,2,3,0 · 스테이지 2 는 1,0,3,2,1 (전과 같다)', (() => {
  const w = (s) => [0, 1, 2, 3, 4].map((k) => buildStage(s).find((e) => e.wave === k).entry).join();
  return w(1) === '0,1,2,3,0' && w(2) === '1,0,3,2,1';
})());
check('스테이지 4: 둘로 갈라 들어오는 웨이브는 홀수 번째가 반대쪽 경로', (() => {
  const l = buildStage(4, null, OLD), p = entryPattern(4, OLD);
  const w1 = l.filter((e) => e.wave === 1);
  return p.dual[1] === 1 && w1.filter((_, i) => i % 2 === 0).every((e) => e.entry === 2) && w1.filter((_, i) => i % 2 === 1).every((e) => e.entry === 3)
    && l.filter((e) => e.wave === 0).every((e) => e.entry === 0);
})());
check('입장 간격이 패턴마다 다르다 (스테이지 1: 10틱, 2: 8틱, 4: 12틱)', (() => {
  const gap = (s) => { const l = buildStage(s, null, OLD); return l[1].delay - l[0].delay; };
  return gap(1) === 10 && gap(2) === 8 && gap(4) === 12;
})());

// 새 적의 능력치
check('새 적: 거북은 체력 3, 나머지는 1, 점수는 급강하가 두 배', KINDS.turtle.hp === 3 && KINDS.eel.hp === 1 && KINDS.ray.hp === 1 && KINDS.mine.hp === 1 && ['eel', 'ray', 'turtle', 'mine'].every((k) => KINDS[k].dive === KINDS[k].score * 2));

// 새 적의 움직임
const sweepEnv = { slot: () => ({ x: 112, y: 60 }), diveSpeed: 2, shotsPerDive: 1, fire: () => { throw new Error('뱀장어는 쏘지 않는다'); } };
const eel = formed('eel', 3, 0); eel.x = 40; eel.y = 80;
eel.beginSweep(112);
check('뱀장어: 탄 없이 빠르게(1.25배) 돌진 상태로', eel.state === 'dive' && eel.speedMul === 1.25 && eel.shotsLeft === 0);
let minY = 1e9, maxY = -1e9, maxX = -1e9;
for (let i = 0; i < 2000 && eel.state === 'dive'; i++) { eel.step(sweepEnv); minY = Math.min(minY, eel.y); maxY = Math.max(maxY, eel.y); maxX = Math.max(maxX, eel.x); }
check('뱀장어: 왼쪽에서 내려와 중간 높이에서 오른쪽 화면 밖까지 가로지른다', maxX > W - 10 && maxY > 125 && maxY < 200, `maxX=${maxX.toFixed(0)} maxY=${maxY.toFixed(0)}`);
check('뱀장어: 다 가로지르면 위에서 다시 들어온다', eel.state === 'toSlot' && eel.y === -16 && eel.speedMul === 1);
const eel2 = formed('eel', 3, 9); eel2.x = 180; eel2.y = 80; eel2.beginSweep(60);
let minX = 1e9; for (let i = 0; i < 2000 && eel2.state === 'dive'; i++) { eel2.step(sweepEnv); minX = Math.min(minX, eel2.x); }
check('뱀장어: 오른쪽에서 시작하면 왼쪽으로 가로지른다', minX < 10);

const ray = formed('ray', 1, 3); ray.x = 100; ray.y = 60;
ray.beginZigzag({ shotsPerDive: 2 }, 112, 1);
let rmin = 1e9, rmax = -1e9, fired = 0;
const rayEnv = { slot: () => ({ x: 100, y: 60 }), diveSpeed: 2, fire: () => fired++ };
for (let i = 0; i < 2000 && ray.state === 'dive'; i++) { ray.step(rayEnv); rmin = Math.min(rmin, ray.x); rmax = Math.max(rmax, ray.x); }
check('가오리: 좌우로 크게 지그재그하며 내려온다', rmax - rmin > 60, `폭=${(rmax - rmin).toFixed(0)}`);
check('가오리: 한 번만 쏜다', fired === 1);

const tu = formed('turtle', 1, 3);
tu.beginHeavy({ shotsPerDive: 1 }, 112, 1);
check('거북: 느리게(0.65배) 내려오며 두 번 쏜다', tu.speedMul === 0.65 && tu.shotsLeft === 2 && tu.state === 'dive');

// 게임 안에서
const launchOne = (kind, stage, rngSeq = [0, 0.9, 0.95]) => {
  const e = formed(kind, kind === 'eel' || kind === 'mine' ? 3 : 1, 3);
  const g = playing([e], { stage, rng: seq(...rngSeq) });
  g.launch();
  return e;
};
check('launch: 뱀장어는 가로지르기, 가오리는 지그재그(탄 1), 거북은 느리게(탄 2), 폭탄 복어는 탄 없이', (() => {
  const a = launchOne('eel', 2), b = launchOne('ray', 4), c = launchOne('turtle', 6), d = launchOne('mine', 8);
  return a.speedMul === 1.25 && a.shotsLeft === 0 && b.shotsLeft === 1 && b.speedMul === 1 && c.speedMul === 0.65 && c.shotsLeft === 2 && d.state === 'dive' && d.shotsLeft === 0;
})());
check('새 적은 돌진 확률에 걸리지 않는다', launchOne('ray', 9, [0, 0.9, 0.0]).speedMul === 1);

const gf = playing([], { stage: 4 });
const rz = formed('ray', 1, 3); rz.x = 100; rz.y = 100; gf.enemies.push(rz);
gf.enemyFire(rz);
check('가오리의 탄은 3갈래', gf.bullets.length === 3 && new Set(gf.bullets.map((b) => b.vx.toFixed(3))).size === 3);
const gf2 = playing([], { stage: 4 });
const be = formed('bee'); be.x = 100; be.y = 100; gf2.enemies.push(be);
gf2.enemyFire(be);
check('다른 적의 탄은 한 발', gf2.bullets.length === 1);

const gm = playing([], { stage: 8 });
const mine = formed('mine', 3, 3); mine.x = 100; mine.y = 120; mine.hp = 1; gm.enemies.push(mine);
gm.hitEnemy(mine);
check('폭탄 복어를 잡으면 사방으로 8발이 터진다', gm.bullets.length === 8 && gm.bullets.some((b) => b.vy < 0) && gm.bullets.some((b) => b.vy > 0) && gm.bullets.some((b) => b.vx < 0) && gm.bullets.some((b) => b.vx > 0) && gm.score === 100);
const gm2 = playing([], { stage: 8 });
gm2.bonus = true;
const mine2 = formed('mine', 3, 3); mine2.x = 100; mine2.y = 120; gm2.enemies.push(mine2);
gm2.hitEnemy(mine2);
check('보너스 스테이지에서는 터지지 않는다', gm2.bullets.length === 0);

const gt = playing([], { stage: 6 });
const tt = formed('turtle', 1, 3); tt.x = 100; tt.y = 100; gt.enemies.push(tt);
gt.hitEnemy(tt); gt.hitEnemy(tt);
check('거북은 두 번 맞아도 살아 있다', gt.enemies.includes(tt) && tt.hp === 1 && gt.score === 0);
gt.hitEnemy(tt);
check('세 번째에 잡히고 대열 200점', tt.state === 'gone' && gt.score === 200);
const gtd = playing([], { stage: 6 });
const td = formed('turtle', 1, 3); td.state = 'dive'; td.hp = 1; gtd.enemies.push(td);
gtd.hitEnemy(td);
check('급강하 중인 거북은 400점', gtd.score === 400);

// 편대 급강하
const bees = (n) => Array.from({ length: n }, (_, i) => formed('bee', 3, i));
const squad = (stage, r, n = 6) => { const g = playing(bees(n), { stage, rng: seq(...r) }); g.enemies.pop(); g.launch(); return g.enemies.filter((e) => e.state === 'dive').length; };
check('편대 급강하: 6 스테이지부터, 확률이 되면 세 마리가 함께', squad(6, [0, 0.9, 0.95, 0.0]) === 3);
check('편대 급강하: 확률이 안 되면 혼자', squad(6, [0, 0.9, 0.95, 0.5]) === 1);
check('편대 급강하: 6 스테이지 전에는 없다', squad(4, [0, 0.9, 0.95, 0.0]) === 1);
check('편대 급강하: 12 스테이지는 다섯 마리', squad(12, [0, 0.9, 0.95, 0.0], 8) === 5);
check('편대는 서로 다른 갈래로 내려온다', (() => { const g = playing(bees(6), { stage: 6, rng: seq(0, 0.9, 0.95, 0.0) }); g.enemies.pop(); g.launch(); const ends = g.enemies.filter((e) => e.state === 'dive').map((e) => Math.round(e.path.points.at(-1).x)); return new Set(ends).size === 3; })());

// 보스 3종
check('보스는 크라켄 → 아귀 → 가오리 → 리바이어던 순서다', (() => {
  const k = [5, 10, 15, 20].map((s) => createBoss(s).kind).join();
  return k === 'kraken,angler,manta,leviathan' && BOSS_CLASSES.length === 4 && createBoss(20) instanceof Leviathan;
})());
check('보스 번호가 오를수록 체력이 크다', createBoss(5).maxHp === 60 && createBoss(10).maxHp === 90 && createBoss(15).maxHp === 120 && createBoss(20).maxHp === 150);
check('보스 이름 문구가 영어·한국어에 모두 있다', (() => {
  const out = [];
  for (const lang of ['en', 'ko']) { setLang(lang); for (const s of [5, 10, 15, 20]) { const b = createBoss(s); out.push(t(b.nameKey) !== b.nameKey); } }
  setLang('en');
  return out.every(Boolean);
})());
check('크라켄은 전과 같은 보스 (Boss 를 이어받는다)', createBoss(5) instanceof Kraken && createBoss(10) instanceof Angler && createBoss(15) instanceof Manta);

// 심해 아귀
const an = new Angler(10);
const aenv = stubEnv();
for (let i = 0; i < 300 && an.state === 'enter'; i++) an.step(aenv);
check('아귀: 내려와서 fight', an.state === 'fight' && an.y === BOSS_HOME_Y && an.targetable);
for (let i = 0; i < 100; i++) an.step(aenv);
check('아귀 1단계: 미끼에서 두 갈래 먹물', aenv.shots.length === 2, `shots=${aenv.shots.length}`);
check('아귀 1단계에는 암전이 없다', an.darkness === 0);
check('돌진 전에는 몸에 닿아도 안전', !an.contact({ x0: an.x - 6, x1: an.x + 6, y0: an.y - 6, y1: an.y + 6 }));
for (let i = 0; i < 400 && !an.lunge; i++) an.step(aenv);
check('아귀: 주기가 되면 입을 벌리고 돌진', !!an.lunge && an.lunge.dir === 1);
const shots0 = aenv.shots.length;
let deepest = 0;
for (let i = 0; i < 40; i++) { an.step(aenv); deepest = Math.max(deepest, an.y); }
check('돌진 중에는 먹물을 쏘지 않고 아래로 깊이 내려온다', aenv.shots.length === shots0 && deepest > 150, `deepest=${deepest.toFixed(0)}`);
an.y = LUNGE_DEPTH; an.lunge = { dir: 1 }; an.x = 112;
const pr = { x0: 106, x1: 118, y0: PLAYER_Y - 6, y1: PLAYER_Y + 6 };
check('돌진 중 몸에 닿으면 맞는다', an.contact(pr) === true);
an.lunge = null;
check('돌진이 아니면 같은 자리라도 안 맞는다', an.contact(pr) === false);
an.lunge = { dir: -1 }; an.y = 150;
for (let i = 0; i < 200 && an.lunge; i++) an.step(aenv);
check('돌진 뒤에는 제자리로 돌아간다', an.lunge === null && an.y <= BOSS_HOME_Y + 4);
const an2 = new Angler(10); an2.state = 'fight'; an2.y = 74; an2.hp = Math.floor(an2.maxHp * 0.5); an2.darkCd = 3;
const aenv2 = stubEnv();
let peak = 0;
for (let i = 0; i < DARK_LEN + 20; i++) { an2.step(aenv2); peak = Math.max(peak, an2.darkness); }
check('아귀 2단계: 암전이 걸렸다 풀린다 (서서히 어두워짐)', peak > 0.9 && an2.darkness < 1, `peak=${peak.toFixed(2)}`);
check('암전은 DARK_LEN 틱 뒤에 끝난다', (() => { const q = new Angler(10); q.state = 'fight'; q.hp = 40; q.darkT = DARK_LEN; q.step(stubEnv()); q.step(stubEnv()); return q.darkness === 0; })());
const gl = playing([formed()], { stage: 10 });
gl.boss.state = 'fight'; gl.boss.lunge = { dir: 1 }; gl.boss.y = 232; gl.boss.x = gl.player.x;
run(gl, 1);
check('게임: 아귀의 돌진에 맞으면 죽는다', gl.phase === 'dying');
const gs = playing([formed()], { stage: 10 });
gs.boss.state = 'fight'; gs.boss.y = 74; gs.boss.x = gs.player.x; gs.player.invuln = 0;
run(gs, 5);
check('게임: 돌진이 아니면 아귀 아래에 있어도 안전', gs.phase === 'play');

// 거대 가오리
const mt = new Manta(15);
const menv = stubEnv(() => 0.5);
for (let i = 0; i < 300 && mt.state === 'enter'; i++) mt.step(menv);
for (let i = 0; i < 90; i++) mt.step(menv);
const slotOf = (s) => Math.round((s.x - 14) / 24.5);
const first = menv.shots.map(slotOf);
check('가오리 장막: 가로 9칸 중 2칸만 비어 있다 (탄 7발, 모두 아래로)', menv.shots.length === 7 && menv.shots.every((s) => Math.abs(s.a - Math.PI / 2) < 1e-9) && CURTAIN_SLOTS - CURTAIN_GAP === 7, `shots=${menv.shots.length}`);
const missing = [...Array(CURTAIN_SLOTS).keys()].filter((i) => !first.includes(i));
check('빈 두 칸은 이웃해 있다', missing.length === 2 && missing[1] - missing[0] === 1, `빈칸=${missing}`);
check('장막의 x 는 정해진 칸 위치', menv.shots.every((s) => Math.abs(s.x - curtainX(slotOf(s))) < 1e-9));
const before = menv.shots.length;
for (let i = 0; i < 160; i++) mt.step(menv);
const second = menv.shots.slice(before).map(slotOf);
const gap2 = [...Array(CURTAIN_SLOTS).keys()].filter((i) => !second.slice(0, 7).includes(i));
check('다음 장막의 틈은 지난번과 두 칸 이상 떨어진다', gap2.length === 2 && Math.abs(gap2[0] - missing[0]) >= 2, `${missing} → ${gap2}`);
check('가오리 3단계에서만 폭탄 복어를 떨어뜨린다', (() => {
  const a = new Manta(15); a.state = 'fight'; a.hp = a.maxHp; a.mineCd = 1;
  const e1 = stubEnv(); for (let i = 0; i < 5; i++) a.step(e1);
  const b = new Manta(15); b.state = 'fight'; b.hp = Math.floor(b.maxHp * 0.2); b.mineCd = 1;
  const e2 = stubEnv(); for (let i = 0; i < 5; i++) b.step(e2);
  return e1.minions.length === 0 && e2.minions.length === 1 && e2.minions[0].kind === 'mine';
})());
check('가오리 2단계부터 조준 3갈래가 더해진다', (() => {
  const a = new Manta(15); a.state = 'fight'; a.hp = Math.floor(a.maxHp * 0.5); a.aimCd = 1; a.cd = 999;
  const e = stubEnv(); a.step(e);
  return e.shots.length === 3;
})());
const gmt = playing([formed()], { stage: 15 });
gmt.spawnMinion(100, 80, 'mine');
check('게임: 보스가 풀어 놓은 폭탄 복어는 탄 없이 덤벼든다', gmt.enemies.some((e) => e.kind === 'mine' && e.state === 'dive' && e.shotsLeft === 0));

// 1~20 스테이지와 보너스 패턴 5종을 자동으로 돌려도 멈추지 않는다
let crashed = null;
const cases = [...Array.from({ length: 20 }, (_, i) => [i + 1, null]), ...BONUS_KINDS.map((k) => [3, k])];
for (const [s, kind] of cases) {
  if (crashed) break;
  try {
    const g = new Game({ bonusPlan: {}, rng: seq(0.2, 0.7, 0.4, 0.9, 0.1) });
    begin(g); g.stage = s; if (kind) g.bonusPlan = { [s]: kind }; g.startStage();
    g.player.invuln = 1e9;
    g.setFire(true);
    for (let i = 0; i < 3000; i++) { g.moveTo(40 + (i % 140)); g.tick(); if (g.phase === 'over') break; }
    if (!['play', 'ready', 'clear', 'bonusResult', 'captured', 'dying', 'over'].includes(g.phase)) crashed = `stage ${s} ${kind || ''} phase=${g.phase}`;
    if (g.enemies.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.y))) crashed = `stage ${s} ${kind || ''} NaN`;
  } catch (err) { crashed = `stage ${s} ${kind || ''}: ${err.message}`; }
}
check('스테이지 1~20 과 보너스 5종을 자동으로 돌려도 오류·NaN 없이 진행된다', crashed === null, crashed || '');
check('상수', H === 288 && isBoss(5) && isBoss(20) && isBonus(7) && isBonus(17) && !isBonus(3));
check('기본 보너스 계획은 구간마다 하나', Object.keys(DEFAULT_PLAN).join() === '7,17');
for (let seed = 0; seed < 60; seed++) {
  const r = (() => { let x = seed * 7919 + 13; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; })();
  const plan = pickBonusPlan(r), st = Object.keys(plan).map(Number);
  if (!(st.length === 2 && st[0] >= 2 && st[0] <= 9 && st[1] >= 12 && st[1] <= 19 && !st.some(isBoss) && new Set(Object.values(plan)).size === 2 && Object.values(plan).every((k) => BONUS_KINDS.includes(k)))) { check('보너스 계획: 구간마다 하나, 보스 제외, 패턴이 서로 다르다', false, JSON.stringify(plan)); break; }
  if (seed === 59) check('보너스 계획: 구간마다 하나, 보스 제외, 패턴이 서로 다르다 (60판)', true);
}
const plans = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(pickBonusPlan(() => ((i * 0.618 + 0.07) % 1)))));
check('판마다 보너스 계획이 달라진다', plans.size > 5);
const bk = (kind, rng = null) => buildStage(3, rng, { 3: kind });
check('보너스 물고기 떼: 40마리', bk('school').length === 40 && bk('school', seq(0.3, 0.6, 0.1, 0.8)).every((e) => e.kind === 'fish'));
check('보너스 소용돌이: 40마리가 나선 경로로', bk('vortex').length === 40 && bk('vortex').every((e) => e.customPath));
check('보너스 표적: 30개, 제자리에서 잠깐 나타난다', bk('target').length === 30 && bk('target').every((e) => e.at && e.stay > 0));
check('보너스 고래: 한 마리', bk('whale').length === 1 && bk('whale')[0].kind === 'whale');
check('보너스 진주: 적 없음 (진주는 게임이 흘려보낸다)', bk('pearl').length === 0);
check('물고기 떼는 난수를 주면 매번 다르다', JSON.stringify(bk('school', seq(0.1, 0.5, 0.9)).map((e) => [e.entry, e.delay])) !== JSON.stringify(bk('school', seq(0.9, 0.2, 0.4)).map((e) => [e.entry, e.delay])));

// 리바이어던 (마지막 보스)
const lv = new Leviathan(20); lv.state = 'fight'; lv.t = 1;
check('리바이어던: 체력 150, 크기가 크다', lv.maxHp === 150 && lv.halfW >= 44);
{
  const e = stubEnv(); lv.fight(e);
  const e2 = stubEnv(); for (let i = 0; i < 300; i++) lv.fight(e2);
  check('리바이어던 1단계: 조준탄과 장막을 쏜다', e2.shots.length > 10 && e2.minions.length === 0);
  const l2 = new Leviathan(20); l2.state = 'fight'; l2.hp = Math.floor(l2.maxHp * 0.5);
  const e3 = stubEnv(); for (let i = 0; i < 400; i++) l2.fight(e3);
  check('리바이어던 2단계: 고리를 쏘고 해파리를 풀어 놓는다', e3.shots.length > e2.shots.length && e3.minions.some((m) => m.kind === 'bee'));
  const l3 = new Leviathan(20); l3.state = 'fight'; l3.hp = Math.floor(l3.maxHp * 0.2); l3.lungeCd = 1;
  const e4 = stubEnv(); l3.fight(e4);
  check('리바이어던 3단계: 돌진을 시작하고 돌진 중에는 몸에 닿으면 맞는다', !!l3.lunge && l3.contact({ x0: l3.x - 5, x1: l3.x + 5, y0: l3.y - 5, y1: l3.y + 5 }));
  check('돌진 중에는 쏘지 않는다', e4.shots.length === 0);
  let deepest = 0; const e5 = stubEnv(); for (let i = 0; i < 200 && l3.lunge; i++) { l3.fight(e5); deepest = Math.max(deepest, l3.y); }
  check('돌진한 뒤 제자리로 돌아온다', !l3.lunge && l3.y < 100 && deepest > 150);
  const l4 = new Leviathan(20); l4.state = 'fight'; l4.hp = Math.floor(l4.maxHp * 0.2); l4.spawnCd = 1; l4.volley = 0;
  const e6 = stubEnv(); l4.fight(e6);
  check('리바이어던 3단계: 폭탄 복어도 떨어뜨린다', e6.minions.some((m) => m.kind === 'mine'));
}
const shufA = buildStage(1, seq(0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8)), shufB = buildStage(1, seq(0.9, 0.1, 0.6, 0.4, 0.2, 0.8, 0.3));
const sig = (l) => JSON.stringify(l.map((e) => [e.row, e.col, e.entry, e.delay]));
check('난수를 주면 입장 순서가 달라진다', sig(shufA) !== sig(shufB) && sig(shufA) !== sig(buildStage(1)));
check('섞어도 구성은 같다 (문어 4 · 복어 16 · 해파리 20)', count(shufA, 'boss') === 4 && count(shufA, 'butterfly') === 16 && count(shufA, 'bee') === 20);
done();
