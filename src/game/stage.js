import { Enemy } from './enemy.js';
import { W, spiralPath, whalePath } from './paths.js';
import { SHAPES, SHAPE_ORDER, ROW_KIND } from './formation.js';

/** 보스 스테이지: 5 · 10 · 15 · 20 */
export const isBoss = (stage) => stage % 5 === 0;
/** 보너스 패턴 */
export const BONUS_KINDS = ['school', 'vortex', 'target', 'whale', 'pearl'];
export const BONUS_FISH = 40;
export const BONUS_WHALE_HP = 24;
export const BONUS_PEARLS = 24;
export const BONUS_TARGETS = 30;
/** 보너스 스테이지가 들어갈 수 있는 자리: 10 스테이지 구간마다 하나 (1 · 보스 · 보스 바로 앞뒤는 뺀다) */
const BONUS_SLOTS = [[2, 3, 4, 6, 7, 8, 9], [12, 13, 14, 16, 17, 18, 19]];
/** 난수를 안 줄 때 쓰는 기본 계획 */
export const DEFAULT_PLAN = { 7: 'school', 17: 'school' };

/** 한 판의 보너스 계획 { 스테이지: 패턴 }: 구간마다 한 스테이지를 뽑고, 두 패턴은 서로 다르다 */
export function pickBonusPlan(rng) {
  const kinds = shuffle([...BONUS_KINDS], rng);
  return Object.fromEntries(BONUS_SLOTS.map((slots, i) => [slots[Math.floor(rng() * slots.length)], kinds[i]]));
}

/** 보너스 스테이지: 3 · 7 · 11 같은 고정이 아니라 plan 에 든 스테이지다 (보스 스테이지와 겹치면 보스가 먼저) */
export const isBonus = (stage, plan = DEFAULT_PLAN) => !isBoss(stage) && stage in plan;
export const bonusKind = (stage, plan = DEFAULT_PLAN) => (isBonus(stage, plan) ? plan[stage] : null);
const WAVE_SIZE = 8;
const WAVES = 5;

/** 보통 스테이지의 순번(0부터). 보너스·보스 스테이지는 세지 않는다 */
export function regularIndex(stage, plan = DEFAULT_PLAN) {
  let n = -1;
  for (let s = 1; s <= stage; s++) if (!isBoss(s) && !isBonus(s, plan)) n++;
  return Math.max(0, n);
}

/** 이 스테이지의 대열 모양 이름 */
export const shapeName = (stage, plan = DEFAULT_PLAN) => SHAPE_ORDER[regularIndex(stage, plan) % SHAPE_ORDER.length];

/**
 * 입장 패턴: entries 는 웨이브마다 쓰는 입장 경로(0·1 위 왼쪽/오른쪽, 2·3 왼쪽/오른쪽 옆),
 * dual 이 1 인 웨이브는 한 웨이브가 두 갈래(반대쪽 경로)로 동시에 들어온다. gap 은 한 마리씩 들어오는 간격(틱)
 */
const ENTRY_PATTERNS = [
  { entries: [0, 1, 2, 3, 0], dual: [0, 0, 0, 0, 0], gap: 10 },
  { entries: [1, 0, 3, 2, 1], dual: [0, 0, 0, 0, 0], gap: 8 },
  { entries: [0, 2, 1, 3, 0], dual: [0, 1, 0, 1, 1], gap: 12 },
  { entries: [2, 0, 3, 1, 2], dual: [1, 0, 1, 0, 1], gap: 9 },
];
export const entryPattern = (stage, plan = DEFAULT_PLAN) => ENTRY_PATTERNS[regularIndex(stage, plan) % ENTRY_PATTERNS.length];

/**
 * 스테이지가 오르며 대열의 해파리·복어 일부가 새 적으로 바뀐다. from 스테이지부터 base 마리,
 * every 스테이지마다 하나씩 늘어 max 까지. rows 는 바뀔 수 있는 줄
 */
const MIX = [
  { kind: 'eel', from: 2, rows: [3, 4], base: 4, every: 2, max: 12 },
  { kind: 'ray', from: 4, rows: [1, 2], base: 3, every: 2, max: 10 },
  { kind: 'turtle', from: 6, rows: [1, 2], base: 2, every: 2, max: 8 },
  { kind: 'mine', from: 8, rows: [3, 4], base: 3, every: 2, max: 10 },
];

/** 이 스테이지에 나오는 새 적의 수 */
export function mixCounts(stage) {
  const out = {};
  for (const m of MIX) out[m.kind] = stage < m.from ? 0 : Math.min(m.max, m.base + Math.floor((stage - m.from) / m.every));
  return out;
}

/** 후보 목록에서 count 개를 고르게 흩어 고른다 (난수 없이, 스테이지마다 시작 위치만 달라진다) */
function spread(list, count, offset) {
  const n = Math.min(count, list.length);
  if (!n) return [];
  const stride = list.length / n;
  const o = offset % Math.max(1, Math.floor(stride));
  return Array.from({ length: n }, (_, i) => list[Math.floor(i * stride + o)]);
}

/** 배열을 섞는다 (피셔–예이츠) */
function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** 보너스 패턴별 적 목록. rng 가 없으면 늘 같은 모양이다. 진주 줍기는 적이 없다 (game.js 가 진주를 흘려보낸다) */
function bonusEnemies(kind, rng) {
  const r = rng || (() => 0.5);
  const fish = (o) => new Enemy({ kind: 'fish', slotless: true, bonus: true, ...o });
  const list = [];
  if (kind === 'school') {                                   // 물고기 떼: 경로 순서·속도·간격이 판마다 다르다
    const entries = rng ? shuffle([0, 1, 2, 3, Math.floor(rng() * 4)], rng) : [0, 1, 2, 3, 0];
    const speed = rng ? 0.9 + rng() * 0.35 : 1, gap = rng ? 8 + Math.floor(rng() * 5) : 10;
    for (let w = 0; w < WAVES; w++) {
      for (let i = 0; i < WAVE_SIZE; i++) list.push(fish({ wave: w, delay: 30 + w * 150 + i * gap, entry: entries[w], speed }));
    }
  } else if (kind === 'vortex') {                            // 소용돌이: 가운데에서 네 갈래 나선으로 퍼진다
    const a0 = r() * Math.PI * 2, dir = r() < 0.5 ? -1 : 1, arms = 4, per = BONUS_FISH / arms;
    for (let k = 0; k < arms; k++) {
      const path = spiralPath(W / 2, 100, a0 + k * Math.PI * 2 / arms, dir);
      for (let i = 0; i < per; i++) list.push(fish({ wave: k, delay: 30 + i * 22 + k * 5, path, speed: 0.85 }));
    }
  } else if (kind === 'target') {                            // 표적 사격: 여기저기 잠깐 나타났다 사라진다
    let prev = { x: W / 2, y: 100 };
    for (let i = 0; i < BONUS_TARGETS; i++) {
      let at = prev;
      for (let tries = 0; tries < 8 && Math.hypot(at.x - prev.x, at.y - prev.y) < 50; tries++) at = { x: 24 + r() * (W - 48), y: 50 + r() * 150 };
      prev = at;
      list.push(fish({ wave: i, delay: 30 + i * 36, at, stay: 180 }));
    }
  } else if (kind === 'whale') {                             // 황금 고래: 크고 단단한 한 마리가 천천히 헤엄친다
    list.push(new Enemy({ kind: 'whale', slotless: true, bonus: true, delay: 40, path: whalePath(r() < 0.5 ? -1 : 1), speed: 0.35 }));
  }
  return list;
}

/**
 * 한 스테이지의 적 전체. 5웨이브 × 8마리가 입장 경로를 따라 차례로 들어온다.
 * rng 를 주면 웨이브마다 들어오는 경로의 순서와 누가 먼저 들어오는지를 섞는다 (대열 모양은 그대로). 없으면 늘 같은 순서
 */
export function buildStage(stage, rng = null, plan = DEFAULT_PLAN) {
  if (isBoss(stage)) return [];          // 보스 스테이지의 적은 game.boss 와 보스가 풀어 놓는 졸개뿐
  if (isBonus(stage, plan)) return bonusEnemies(plan[stage], rng);

  const ri = regularIndex(stage, plan);
  const rows = SHAPES[shapeName(stage, plan)];
  const slots = [];
  rows.forEach((cols, row) => cols.forEach((col) => slots.push({ row, col, kind: ROW_KIND[row] })));

  const counts = mixCounts(stage);
  for (const m of MIX) {
    const eligible = slots.filter((s) => m.rows.includes(s.row) && s.kind === ROW_KIND[s.row]);
    for (const s of spread(eligible, counts[m.kind], ri)) s.kind = m.kind;
  }

  const pat = { ...entryPattern(stage, plan) };
  if (rng) {
    const order = shuffle([0, 1, 2, 3, 4], rng);
    pat.entries = order.map((k) => pat.entries[k]);
    pat.dual = order.map((k) => pat.dual[k]);
    shuffle(slots, rng);
  }
  return slots.map((s, n) => {
    const wave = Math.floor(n / WAVE_SIZE), i = n % WAVE_SIZE;
    const entry = pat.dual[wave] && i % 2 ? pat.entries[wave] ^ 1 : pat.entries[wave];   // 둘로 갈라 들어오면 홀수 번째는 반대쪽 경로
    return new Enemy({ ...s, wave, delay: 30 + wave * 170 + i * pat.gap, entry });
  });
}
