import { Enemy } from './enemy.js';
import { ROW_COLS, ROW_KIND } from './formation.js';

/** 보너스 스테이지: 3 · 7 · 11 ... */
export const isBonus = (stage) => stage % 4 === 3;
export const BONUS_FISH = 40;
const WAVE_SIZE = 8;
const WAVES = 5;

/** 한 스테이지의 적 전체. 5웨이브 × 8마리가 입장 경로를 따라 차례로 들어온다 */
export function buildStage(stage) {
  const flip = stage % 2 === 0;
  if (isBonus(stage)) {
    const list = [];
    for (let w = 0; w < WAVES; w++) {
      for (let i = 0; i < WAVE_SIZE; i++) {
        list.push(new Enemy({ kind: 'fish', wave: w, delay: 30 + w * 150 + i * 10, entry: [0, 1, 2, 3, 0][w], slotless: true, bonus: true }));
      }
    }
    return list;
  }
  const slots = [];
  ROW_COLS.forEach((cols, row) => cols.forEach((col) => slots.push({ row, col, kind: ROW_KIND[row] })));
  const entries = flip ? [1, 0, 3, 2, 1] : [0, 1, 2, 3, 0];
  return slots.map((s, n) => {
    const wave = Math.floor(n / WAVE_SIZE);
    return new Enemy({ ...s, wave, delay: 30 + wave * 170 + (n % WAVE_SIZE) * 10, entry: entries[wave] });
  });
}
