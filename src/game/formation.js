import { W } from './paths.js';

/** 대열의 줄별 칸 번호. 0줄 문어 4 · 1~2줄 복어 8+8 · 3~4줄 해파리 10+10 = 40마리 */
export const ROW_COLS = [
  [3, 4, 5, 6],
  [1, 2, 3, 4, 5, 6, 7, 8],
  [1, 2, 3, 4, 5, 6, 7, 8],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
];
export const ROW_KIND = ['boss', 'butterfly', 'butterfly', 'bee', 'bee'];

const SX = 16, SY = 15, TOP = 44, SWAY = 14;

/**
 * 대열의 자리. 다 모이기 전에는 좌우로 흔들리고, 다 모이면(breathing) 흔들기를 멈추고
 * 벌어졌다 오므라들기를 되풀이한다.
 */
export class Formation {
  constructor() {
    this.t = 0;
    this.phase = 0;
    this.swayAmp = SWAY;
    this.sway = 0;
    this.scale = 1;
    this.breathing = false;
  }

  update() {
    this.t++;
    this.swayAmp += ((this.breathing ? 0 : SWAY) - this.swayAmp) * 0.02;
    this.sway = Math.sin(this.t * 0.02) * this.swayAmp;
    if (this.breathing) {
      this.phase += 0.03;
      this.scale = 1 + 0.18 * (0.5 - 0.5 * Math.cos(this.phase));
    }
  }

  slot(row, col) {
    return {
      x: W / 2 + this.sway + (col - 4.5) * SX * this.scale,
      y: TOP + row * SY * (1 + (this.scale - 1) * 0.6),
    };
  }
}
