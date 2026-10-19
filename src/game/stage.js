import { Enemy } from './enemy.js';
import { SHAPES, SHAPE_ORDER, ROW_KIND } from './formation.js';

/** 보스 스테이지: 5 · 10 · 15 ... */
export const isBoss = (stage) => stage % 5 === 0;
/** 보너스 스테이지: 3 · 7 · 11 ... (보스 스테이지와 겹치면 보스가 먼저) */
export const isBonus = (stage) => stage % 4 === 3 && !isBoss(stage);
export const BONUS_FISH = 40;
const WAVE_SIZE = 8;
const WAVES = 5;

/** 보통 스테이지의 순번(0부터). 보너스·보스 스테이지는 세지 않는다 */
export function regularIndex(stage) {
  let n = -1;
  for (let s = 1; s <= stage; s++) if (!isBoss(s) && !isBonus(s)) n++;
  return Math.max(0, n);
}

/** 이 스테이지의 대열 모양 이름 */
export const shapeName = (stage) => SHAPE_ORDER[regularIndex(stage) % SHAPE_ORDER.length];

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
export const entryPattern = (stage) => ENTRY_PATTERNS[regularIndex(stage) % ENTRY_PATTERNS.length];

/**
 * 스테이지가 오르며 대열의 해파리·복어 일부가 새 적으로 바뀐다. from 스테이지부터 base 마리,
 * every 스테이지마다 하나씩 늘어 max 까지. rows 는 바뀔 수 있는 줄
 */
const MIX = [
  { kind: 'eel', from: 2, rows: [3, 4], base: 4, every: 2, max: 10 },
  { kind: 'ray', from: 4, rows: [1, 2], base: 3, every: 2, max: 8 },
  { kind: 'turtle', from: 6, rows: [1, 2], base: 2, every: 2, max: 6 },
  { kind: 'mine', from: 8, rows: [3, 4], base: 3, every: 2, max: 8 },
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

/** 한 스테이지의 적 전체. 5웨이브 × 8마리가 입장 경로를 따라 차례로 들어온다 */
export function buildStage(stage) {
  if (isBoss(stage)) return [];          // 보스 스테이지의 적은 game.boss 와 보스가 풀어 놓는 졸개뿐
  if (isBonus(stage)) {
    const list = [];
    for (let w = 0; w < WAVES; w++) {
      for (let i = 0; i < WAVE_SIZE; i++) {
        list.push(new Enemy({ kind: 'fish', wave: w, delay: 30 + w * 150 + i * 10, entry: [0, 1, 2, 3, 0][w], slotless: true, bonus: true }));
      }
    }
    return list;
  }

  const ri = regularIndex(stage);
  const rows = SHAPES[shapeName(stage)];
  const slots = [];
  rows.forEach((cols, row) => cols.forEach((col) => slots.push({ row, col, kind: ROW_KIND[row] })));

  const counts = mixCounts(stage);
  for (const m of MIX) {
    const eligible = slots.filter((s) => m.rows.includes(s.row) && s.kind === ROW_KIND[s.row]);
    for (const s of spread(eligible, counts[m.kind], ri)) s.kind = m.kind;
  }

  const pat = entryPattern(stage);
  return slots.map((s, n) => {
    const wave = Math.floor(n / WAVE_SIZE), i = n % WAVE_SIZE;
    const entry = pat.dual[wave] && i % 2 ? pat.entries[wave] ^ 1 : pat.entries[wave];   // 둘로 갈라 들어오면 홀수 번째는 반대쪽 경로
    return new Enemy({ ...s, wave, delay: 30 + wave * 170 + i * pat.gap, entry });
  });
}
