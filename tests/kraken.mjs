import { Game, TICRATE, ULT_MAX } from '../src/game/game.js';
import { Kraken, KRAKEN_Y } from '../src/game/kraken.js';
import { Enemy } from '../src/game/enemy.js';
import { isBoss, isBonus, buildStage } from '../src/game/stage.js';
import { PLAYER_Y } from '../src/game/player.js';
import { check, done, seq } from './lib.mjs';

const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
const formed = (kind = 'bee', row = 3, col = 4) => { const e = new Enemy({ kind, row, col }); e.state = 'formation'; return e; };
const anchor = () => new Enemy({ kind: 'bee', row: 4, col: 0, delay: 1e9 });
function playing(enemies, { rng = seq(0.5) } = {}) {
  const g = new Game({ rng });
  g.start();
  g.enemies = [...enemies, anchor()];
  g.phase = 'play';
  g.playTime = 1000;
  return g;
}

// 스테이지 종류
check('5 · 10 · 15 는 보스 스테이지', isBoss(5) && isBoss(10) && isBoss(15) && !isBoss(4));
check('보너스는 보스와 겹치면 보스가 먼저', isBonus(3) && isBonus(7) && isBonus(11) && !isBonus(15) && isBonus(19));
check('보스 스테이지에는 대열이 없다', buildStage(5).length === 0);

// 크라켄 단독
const stubEnv = () => { const shots = [], minions = []; return { shots, minions, targetX: 112, shoot: (x, y, a, s) => shots.push({ x, y, a, s }), minion: (x, y) => minions.push({ x, y }) }; };
const k1 = new Kraken(5), k2 = new Kraken(10);
check('체력은 스테이지가 오를수록 커진다', k1.maxHp === 60 && k2.maxHp === 90 && k1.level === 1 && k2.level === 2);
check('체력 비율로 3단계', k1.phase === 1 && (k1.hp = 35, k1.phase === 2) && (k1.hp = 15, k1.phase === 3));
const k = new Kraken(5);
check('처음엔 화면 위에서 맞지 않는다', !k.targetable && k.state === 'enter');
const env = stubEnv();
for (let i = 0; i < 200 && k.state === 'enter'; i++) k.step(env);
check('내려와서 fight', k.state === 'fight' && k.y === KRAKEN_Y && k.targetable);
for (let i = 0; i < 80; i++) k.step(env);
check('1단계: 3갈래 탄', env.shots.length === 3 && env.shots.every((s) => Math.sin(s.a) > 0), `shots=${env.shots.length}`);
k.hp = Math.floor(k.maxHp / 2); k.spawnCd = 1;
const env2 = stubEnv();
for (let i = 0; i < 80; i++) k.step(env2);
check('2단계: 해파리를 풀어 놓고 부채꼴/조준탄을 쏜다', env2.minions.length >= 1 && env2.shots.length >= 3);
k.hp = 5;
const env3 = stubEnv();
for (let i = 0; i < 60; i++) k.step(env3);
check('3단계: 먹물 고리(12발 이상)', env3.shots.length >= 12);
check('맞으면 깜빡이고 체력이 준다', (() => { const q = new Kraken(5); q.y = 62; q.state = 'fight'; const hp = q.hp; q.damage(1); return q.hp === hp - 1 && q.flash > 0; })());
const kd = new Kraken(5); kd.y = 62; kd.state = 'fight';
check('체력이 0 이 되는 타격은 true, 그 뒤 dying', kd.damage(1000) === true && kd.state === 'dying' && !kd.targetable && kd.hp === 0);
for (let i = 0; i < 121; i++) kd.step(env);
check('쓰러지는 연출이 끝나면 dead', kd.dead && kd.state === 'dead');

// 게임 속 보스 스테이지
const gb = new Game({ rng: seq(0.5) });
gb.start(); gb.stage = 5; gb.startStage();
check('5 스테이지: 크라켄, 적 목록은 비어 있다, 보너스 아님', gb.boss && gb.enemies.length === 0 && !gb.bonus);
run(gb, 2 * TICRATE + 200);
check('준비가 끝나면 크라켄이 자리를 잡고 탄을 쏜다', gb.phase === 'play' && gb.boss.state === 'fight' && gb.bullets.length > 0);
check('보스 스테이지에 빈 enemies 로 바로 클리어되지 않는다', gb.phase === 'play');
check('보스 스테이지에서는 납치하지 않는다', !gb.canCapture());

const gh = new Game({ rng: seq(0.5) });
gh.start(); gh.stage = 5; gh.startStage(); gh.phase = 'play';
gh.boss.y = 62; gh.boss.state = 'fight';
gh.player.shots.push({ x: gh.boss.x, y: gh.boss.y + 20 });
gh.stats.shots = 1;
const hp0 = gh.boss.hp;
run(gh, 1);
check('어뢰가 크라켄에 맞으면 체력 1 감소, 게이지 +1, 명중 기록', gh.boss.hp === hp0 - 1 && gh.gauge === 1 && gh.stats.hits === 1);

// 보스 격파
const gk = new Game({ rng: seq(0.5) });
gk.start(); gk.stage = 5; gk.startStage(); gk.phase = 'play';
gk.boss.y = 62; gk.boss.state = 'fight'; gk.boss.hp = 1;
gk.bullets.push({ x: 10, y: 10, vx: 0, vy: 0 });
gk.enemies.push(formed('bee', 3, 3));
gk.player.shots.push({ x: gk.boss.x, y: gk.boss.y + 20 });
run(gk, 1);
check('격파: 5000점, 게이지 가득, 보스 격파 수, 탄과 해파리 제거', gk.score === 5000 && gk.gauge === ULT_MAX && gk.stats.bosses === 1 && gk.bullets.length === 0 && gk.enemies.length === 0, `score=${gk.score}`);
run(gk, 125);
check('쓰러지는 연출 뒤 clear → 다음 스테이지', gk.phase === 'clear');
run(gk, 2 * TICRATE + 1);
check('6 스테이지는 보통 스테이지', gk.stage === 6 && !gk.boss && gk.enemies.length === 40 && gk.gauge === ULT_MAX);
const g10 = new Game(); g10.start(); g10.stage = 10; g10.startStage(); g10.phase = 'play'; g10.boss.state = 'fight'; g10.boss.y = 62; g10.boss.hp = 1; g10.player.shots.push({ x: g10.boss.x, y: 80 });
run(g10, 1);
check('10 스테이지 보스는 10000점', g10.score === 10000);

// 필살기
const be = formed('bee', 3, 4);
const gu = playing([be]);
check('게이지가 차기 전에는 못 쓴다', !gu.ultReady && gu.ult() === false);
gu.gauge = ULT_MAX;
check('가득 차면 쓸 수 있다', gu.ultReady);
gu.bullets.push({ x: 50, y: 200, vx: 0, vy: 0 }, { x: 60, y: 100, vx: 0, vy: 0 });
const butter = formed('butterfly', 1, 4), octo = formed('boss', 0, 4);
gu.enemies.push(butter, octo);
check('ult(): 게이지 0, 해일 시작', gu.ult() === true && gu.gauge === 0 && gu.wave && gu.wave.y > 288 - 1);
check('쓰는 중에는 다시 못 쓴다', (() => { gu.gauge = ULT_MAX; return !gu.ultReady; })());
gu.gauge = 0;
run(gu, 25);
check('해일이 올라오며 아래쪽 탄부터 지운다 (앞면 y=148: 200 은 지워지고 100 은 남는다)', !gu.bullets.some((b) => b.y === 200) && gu.bullets.some((b) => b.y === 100), `front=${gu.wave.y}`);
check('해일이 지나는 동안 맞지 않는다', gu.player.invuln > 0);
run(gu, 60);
check('해일이 끝나면 사라지고, 일반 적은 모두 잡힌다', gu.wave === null && !gu.enemies.includes(be) && !gu.enemies.includes(butter) && gu.bullets.length === 0);
check('문어(체력 2)도 해일 한 번에 잡힌다', !gu.enemies.includes(octo));
check('해일로 잡은 점수는 들어온다', gu.score === 50 + 80 + 150, `score=${gu.score}`);
check('해일로 잡은 적은 게이지를 채우지 않는다', gu.gauge === 0);

const gg = playing([formed('bee', 3, 4)]);
gg.player.shots.push({ x: gg.enemies[0].x, y: gg.enemies[0].y + 4.5 });
const s0 = gg.formation.slot(3, 4);
gg.enemies[0].x = s0.x; gg.enemies[0].y = s0.y;
gg.player.shots[0] = { x: s0.x, y: s0.y + 4.5 };
run(gg, 1);
check('일반 처치는 게이지를 채운다 (해파리 +3)', gg.gauge === 3, `gauge=${gg.gauge}`);
const gd = playing([]);
const dv = formed('butterfly', 1, 3); dv.state = 'dive'; dv.hp = 1; gd.enemies.push(dv);
gd.hitEnemy(dv);
check('급강하 중 처치는 게이지 두 배 (복어 +8)', gd.gauge === 8);

const gl = playing([formed('bee', 3, 4)]);
gl.gauge = 50;
gl.bullets.push({ x: gl.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(gl, 1 + 91);
check('잠수함을 잃으면 게이지도 잃는다', gl.lives === 2 && gl.gauge === 0);

const gbn = new Game(); gbn.start(); gbn.stage = 3; gbn.startStage(); gbn.phase = 'play'; gbn.gauge = ULT_MAX;
check('보너스 스테이지에서는 필살기를 못 쓴다', !gbn.ultReady && gbn.ult() === false);

const gcap = playing([]);
const bb = formed('boss', 0, 4); bb.state = 'beam'; bb.timer = 100; bb.x = gcap.player.x; bb.y = 170; bb.beamLen = 96;
gcap.enemies.push(bb); gcap.gauge = ULT_MAX; gcap.ult();
run(gcap, 2);
check('해일 중에는 납치되지 않는다', gcap.phase === 'play');

// 기록 (게임 오버)
const go = playing([formed('bee')]);
go.lives = 1; go.score = 1234; go.stage = 4; go.stats = { shots: 10, hits: 6, bosses: 1 };
go.bullets.push({ x: go.player.x, y: PLAYER_Y, vx: 0, vy: 0 });
run(go, 100);
check('게임 오버가 되면 기록이 만들어진다', go.phase === 'over' && go.lastRecord && go.lastRecord.score === 1234 && go.lastRecord.stage === 4 && go.lastRecord.ratio === 60 && go.lastRecord.bosses === 1, JSON.stringify(go.lastRecord));
go.start();
check('새 게임에서는 기록이 비워지고 내 기록 목록은 유지', go.lastRecord === null && go.rank === null && Array.isArray(go.records));
done();
