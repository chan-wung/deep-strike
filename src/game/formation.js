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

const cols = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const WING = [...cols(0, 3), ...cols(6, 9)];
/** 스테이지마다 바뀌는 대열 모양. 줄마다의 칸 번호이고 모두 합쳐 40칸이다 */
export const SHAPES = {
  rect: ROW_COLS,                                                                   // 직사각형
  pyramid: [cols(3, 6), cols(2, 7), cols(0, 9), cols(0, 9), cols(0, 9)],            // 피라미드: 위가 좁다
  vee: [cols(3, 6), cols(0, 9), cols(0, 9), cols(1, 8), cols(1, 8)],                // 역삼각형: 위가 넓다
  diamond: [cols(3, 6), cols(1, 8), cols(0, 9), cols(0, 9), cols(1, 8)],            // 다이아몬드
  wings: [cols(3, 6), WING, WING, cols(0, 9), cols(0, 9)],                          // 양 날개: 가운데가 비었다
};
export const SHAPE_ORDER = ['rect', 'pyramid', 'vee', 'diamond', 'wings'];

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
