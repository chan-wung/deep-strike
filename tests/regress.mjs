import { Game, DIFFICULTIES, OVER_LOCK } from '../src/game/game.js';
import { Enemy } from '../src/game/enemy.js';
import { check, done } from './lib.mjs';

const tickUntil = (g, phase, limit = 5000) => { for (let i = 0; i < limit && g.phase !== phase; i++) g.tick(); };
const bossGame = (stage, rng) => {
  const g = new Game({ rng });
  g.stage = stage; g.startStage(); g.lives = 5;
  tickUntil(g, 'play');
  return g;
};
const lcg = (seed) => { let s = seed; return () => (s = s * 16807 % 2147483647) / 2147483647; };

// 1. 아귀 돌진에 죽은 뒤 되살아나도 곧바로 또 죽지 않는다
{
  let trials = 0, again = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const g = bossGame(10, lcg(seed));
    for (let i = 0; i < 3000 && g.phase === 'play'; i++) { g.player.x = 112; g.tick(); }   // 중앙에서 돌진을 맞는다
    if (g.phase !== 'dying') continue;
    trials++;
    tickUntil(g, 'play');
    for (let i = 0; i < 60; i++) { g.tick(); if (g.phase === 'dying') { again++; break; } }
  }
  check('아귀 돌진에 죽은 경우를 시험했다', trials > 0, `trials=${trials}`);
  check('되살아난 직후에는 또 죽지 않는다', again === 0, `again=${again}/${trials}`);
  const g = bossGame(5, lcg(1));
  g.hitPlayer(); tickUntil(g, 'play');
  check('되살아나면 잠시 무적이다', g.player.invuln > 0);
  const s = new Game({ rng: lcg(2) }); s.start(); tickUntil(s, 'play');
  check('스테이지 시작에는 무적을 주지 않는다', s.player.invuln === 0);
}

// 2. 클리어·사망 연출 중에도 내 어뢰는 계속 날아간다
{
  const g = new Game({ rng: lcg(3) }); g.start();
  tickUntil(g, 'play');
  g.setFire(true);
  for (let i = 0; i < 20; i++) g.tick();
  g.enemies.forEach((e) => { e.state = 'gone'; });
  g.tick();
  check('클리어 단계로 넘어갔다', g.phase === 'clear' && g.player.shots.length > 0);
  const before = g.player.shots.map((s) => s.y);
  for (let i = 0; i < 10; i++) g.tick();
  check('클리어 중 어뢰가 허공에 멈추지 않는다', g.phase === 'clear' && g.player.shots.every((s, i) => s.y < before[i]) );
  for (let i = 0; i < 60; i++) g.tick();
  check('클리어 중 어뢰가 화면 밖으로 날아가 사라진다', g.phase === 'clear' && g.player.shots.length === 0);

  const d = new Game({ rng: lcg(4) }); d.start();
  tickUntil(d, 'play');
  d.setFire(true);
  for (let i = 0; i < 20; i++) d.tick();
  const y0 = d.player.shots.map((s) => s.y);
  d.player.shield = false; d.player.twin = false; d.player.invuln = 0;
  d.hitPlayer();
  d.tick();
  check('사망 연출 중 어뢰가 움직인다', d.phase === 'dying' && d.player.shots.some((s, i) => s.y < y0[i]));
}

// 3. 변조된 난이도 이름은 무시한다
{
  const g = new Game();
  for (const bad of ['toString', 'constructor', '__proto__', 'hasOwnProperty', '', null, undefined]) g.setDifficulty(bad);
  check('Object.prototype 이름으로 난이도가 바뀌지 않는다', g.difficulty === 'normal' && g.cfg === DIFFICULTIES.normal);
  g.setDifficulty('hard');
  check('정상 난이도는 바뀐다', g.difficulty === 'hard');
  g.setDifficulty('toString');
  check('변조 뒤에도 새 게임이 시작된다', (() => { try { g.newGame(); return true; } catch { return false; } })());
}

// 4. 쓰러지는 중인 보스는 더 맞지 않는다 (해일·어뢰도 가짜 보스 피격음을 내지 않는다)
{
  const g = bossGame(5, lcg(5));
  while (g.boss.state !== 'fight') g.tick();
  g.boss.hp = 1;
  g.damageBoss(1);
  const score = g.score, bosses = g.stats.bosses;
  g.events.length = 0;
  g.damageBoss(10);
  check('쓰러지는 보스에 피해를 줘도 이벤트가 없다', !g.events.includes('bosshit') && !g.events.includes('bossdown'), g.events.join());
  check('점수·격파 수가 두 번 오르지 않는다', g.score === score && g.stats.bosses === bosses);
}

// 5. 게임 오버 직후 연타로 결과 화면을 건너뛰지 않는다
{
  const g = new Game({ rng: lcg(6) }); g.start();
  g.score = 100; g.finish();
  g.naming = false;
  g.start();
  check('게임 오버 직후에는 키를 눌러도 다시 시작하지 않는다', g.phase === 'over');
  for (let i = 0; i < OVER_LOCK; i++) g.tick();
  g.start();
  check('잠깐 지나면 다시 시작한다', g.phase === 'ready' && g.score === 0);
}

// 6. 명중률: 한 발은 몇 명을 맞혀도 한 번, 확산탄은 알갱이마다 쏜 수로 센다
{
  const mk = () => { const g = new Game({ rng: lcg(7) }); g.start(); tickUntil(g, 'play'); g.enemies = []; g.boss = null; g.bonus = true; return g; };
  const g = mk();
  g.player.setWeapon('spread'); g.player.setFire(true); g.tick();
  check('확산탄 한 번에 세 발을 쏜 것으로 센다', g.stats.shots === 3, `shots=${g.stats.shots}`);
  const h = mk();
  h.bonus = false;
  h.player.x = 100;
  h.player.setWeapon('laser');
  h.player.shots.push({ x: 100, y: 150, kind: 'laser', vx: 0, vy: -8, pierce: true, hit: new Set() });
  h.stats.shots = 1;
  h.enemies = [150, 154, 146].map((y) => { const e = new Enemy({ kind: 'bee' }); e.state = 'formation'; e.x = 100; e.y = y; e.hp = 1; return e; });
  h.shotsVsEnemies();
  check('레이저가 세 마리를 꿰뚫어도 명중은 한 번', h.score > 0 && h.enemies.every((e) => e.state === 'gone') && h.stats.hits === 1, `hits=${h.stats.hits}`);
}
done();
