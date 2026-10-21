import { H } from './paths.js';
import { overlap, boxAt } from './geom.js';
import { PLAYER_Y, TWIN_GAP } from './player.js';

/**
 * 기체마다 다른 필살기(폭탄). 쓰면 game.wave 에 { kind, ... } 가 생기고, 매 틱 step 이 true 를 돌려주면 끝난다.
 * start(game) 는 필살기 상태를, step(game, s) 는 한 틱을 맡는다. 셋 다 화면 전체를 노리는 큰 기술이고,
 * 진행되는 동안 잠수함은 맞지 않는다. 적을 잡으면 일반 격추와 똑같이 점수·콤보가 들어온다.
 */

/** 대해일 (노랑): 화면 폭 전체의 물결이 바닥에서 위로 쓸어 올라가며 지나간 자리의 적 탄을 모두 지우고 적에게 피해를 준다 */
export const WAVE_SPEED = 6;
const WAVE_DAMAGE = 2;
const WAVE_BOSS_DAMAGE = 20;

/** 어뢰 폭풍 (다트): 유도 어뢰가 한꺼번에 날아가 적을 하나씩 추적한다. 보스가 있으면 STORM_BOSS_EVERY 발마다 한 발씩 보스에게 가고,
 * 다른 적이 없어도 보스에게 가는 어뢰는 STORM_BOSS_MAX 발까지다 (발당 STORM_BOSS_DAMAGE) */
export const STORM_MISSILES = 24;
const STORM_PER_TICK = 3;
const STORM_DAMAGE = 2;
export const STORM_BOSS_DAMAGE = 2;
const STORM_BOSS_EVERY = 4;
export const STORM_BOSS_MAX = 12;
const STORM_TURN = 0.16;
const STORM_SAFE = 120;
const STORM_LIFE = 150;
const STORM_CLEAR_R = 70;

/** 심해 폭격 (해머): 화면 전체를 5열 × 3줄 15번의 폭발이 왼쪽에서 오른쪽으로 연쇄해서 덮는다 */
export const CARPET_RADIUS = 46;
export const CARPET_COLS = [28, 70, 112, 154, 196];
export const CARPET_ROWS = [70, 150, 235];
const CARPET_STEP = 10;
const CARPET_ROW_LAG = 3;
const CARPET_DAMAGE = 3;
const CARPET_BOSS_DAMAGE = 7;
const CARPET_SAFE = 90;
export const RING_TICKS = 16;

const center = (g) => g.player.x + (g.player.twin ? TWIN_GAP / 2 : 0);
const keepSafe = (g) => { g.player.invuln = Math.max(g.player.invuln, 2); };
const dist = (a, x, y) => Math.hypot(a.x - x, a.y - y);

/** 적에게 n 만큼 피해: 체력이 다하면 격추, 아니면 맞은 자리에서 터진다 */
function hurt(g, e, n) {
  e.hp -= n;
  if (e.hp <= 0) g.kill(e, true); else g.boom(e.x, e.y);
}

export const SPECIALS = {
  wave: {
    start: (g) => ({ kind: 'wave', x: center(g), y: H + 10, hit: new Set(), boss: false }),
    step(g, w) {
      w.y -= WAVE_SPEED;
      keepSafe(g);
      g.bullets = g.bullets.filter((b) => b.y < w.y);              // 물결 아래에 잠긴 탄은 지워진다
      for (const e of g.enemies) {
        if (!e.hittable || w.hit.has(e.id) || e.y < w.y) continue;
        w.hit.add(e.id);
        hurt(g, e, WAVE_DAMAGE);
      }
      const b = g.boss;
      if (b && !w.boss && b.targetable && b.y + 24 >= w.y) {
        w.boss = true;
        g.damageBoss(WAVE_BOSS_DAMAGE);
      }
      return w.y < -20;
    },
  },

  storm: {
    start: (g) => ({ kind: 'storm', x: center(g), t: 0, fired: 0, missiles: [], bossShots: 0 }),
    step(g, s) {
      if (s.t === 0) g.bullets = g.bullets.filter((b) => Math.hypot(b.x - s.x, b.y - PLAYER_Y) > STORM_CLEAR_R);   // 쏘는 순간 주변 탄은 사라진다
      if (s.t++ < STORM_SAFE) keepSafe(g);
      for (let k = 0; k < STORM_PER_TICK && s.fired < STORM_MISSILES; k++, s.fired++) {
        const i = s.fired;
        s.missiles.push({
          x: s.x + (i % 2 ? 6 : -6), y: PLAYER_Y - 6, px: s.x, py: PLAYER_Y - 6,
          a: -Math.PI / 2 + ((i % 8) - 3.5) * 0.3,                   // 부채꼴로 퍼졌다가 목표 쪽으로 휜다
          sp: 2.5, life: STORM_LIFE, tgt: pickTarget(g, i, s),
        });
      }
      for (const m of s.missiles) flyMissile(g, m, s);
      s.missiles = s.missiles.filter((m) => m.life > 0);
      return s.fired >= STORM_MISSILES && s.missiles.length === 0;
    },
  },

  carpet: {
    start() {
      const blasts = [];
      CARPET_COLS.forEach((x, c) => CARPET_ROWS.forEach((y, r) => blasts.push({ x, y, at: c * CARPET_STEP + r * CARPET_ROW_LAG })));
      blasts.sort((a, b) => a.at - b.at);
      return { kind: 'carpet', t: 0, blasts, next: 0, rings: [] };
    },
    step(g, s) {
      if (s.t++ < CARPET_SAFE) keepSafe(g);
      while (s.next < s.blasts.length && s.blasts[s.next].at <= s.t) {
        const b = s.blasts[s.next++];
        blast(g, b.x, b.y);
        s.rings.push({ x: b.x, y: b.y, t: 0 });
        if (s.next === s.blasts.length) { g.bullets = []; g.flash(10); }       // 마지막 폭발: 남은 탄까지 모두 지운다
      }
      for (const r of s.rings) r.t++;
      s.rings = s.rings.filter((r) => r.t < RING_TICKS);
      return s.next >= s.blasts.length && s.rings.length === 0;
    },
  },
};

/** 폭풍의 i 번째 어뢰가 노릴 목표: 보스가 있으면 일부는 보스, 나머지는 적을 돌아가며 한 마리씩 (보스에게 가는 수는 제한) */
function pickTarget(g, i, s) {
  const b = g.boss && g.boss.targetable && s.bossShots < STORM_BOSS_MAX ? g.boss : null;
  if (b && i % STORM_BOSS_EVERY === 0) { s.bossShots++; return b; }
  const list = g.enemies.filter((e) => e.hittable);
  if (list.length) return list[i % list.length];
  if (b) s.bossShots++;
  return b;
}

const alive = (g, t) => !!t && (t === g.boss ? t.targetable : t.hittable && t.hp > 0);

/** 목표가 사라졌을 때 가장 가까운 적 (없으면, 보스에게 갈 수 있는 몫이 남았을 때만 보스, 그것도 아니면 null) */
function nearestTarget(g, m, s) {
  let best = null, bd = Infinity;
  for (const e of g.enemies) {
    if (!e.hittable) continue;
    const d = dist(e, m.x, m.y);
    if (d < bd) { best = e; bd = d; }
  }
  if (best) return best;
  if (g.boss && g.boss.targetable && s.bossShots < STORM_BOSS_MAX) { s.bossShots++; return g.boss; }
  return null;
}

/** 어뢰 한 발이 한 틱 날아간다: 목표 쪽으로 조금씩 휘고, 닿으면 피해를 주고 터진다 */
function flyMissile(g, m, s) {
  m.life--;
  m.px = m.x; m.py = m.y;
  if (!alive(g, m.tgt)) m.tgt = nearestTarget(g, m, s);
  const t = m.tgt;
  if (t) {
    let d = Math.atan2(t.y - m.y, t.x - m.x) - m.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.a += Math.max(-STORM_TURN, Math.min(STORM_TURN, d));
  }
  m.sp = Math.min(6, m.sp + 0.25);
  m.x += Math.cos(m.a) * m.sp;
  m.y += Math.sin(m.a) * m.sp;
  if (m.x < -20 || m.x > 244 || m.y < -20 || m.y > H + 20) { m.life = 0; return; }
  if (!t) return;
  const box = boxAt(m.x, m.y, 3, 3);
  if (!overlap(box, t.rect())) return;
  m.life = 0;
  g.fx.push({ x: m.x, y: m.y, t: 0, max: 12, kind: 'enemy' });
  if (t === g.boss) g.damageBoss(STORM_BOSS_DAMAGE); else hurt(g, t, STORM_DAMAGE);
}

/** 폭격의 폭발 하나: 반경 안의 탄을 지우고, 적에게 피해, 보스에게 큰 피해 */
function blast(g, x, y) {
  g.boom(x, y);
  g.shake(3, 12);
  g.bullets = g.bullets.filter((b) => Math.hypot(b.x - x, b.y - y) > CARPET_RADIUS);
  for (const e of [...g.enemies]) {
    if (e.hittable && dist(e, x, y) <= CARPET_RADIUS + 6) hurt(g, e, CARPET_DAMAGE);
  }
  const b = g.boss;
  if (b && b.targetable && dist(b, x, y) <= CARPET_RADIUS + 28) g.damageBoss(CARPET_BOSS_DAMAGE);
}
