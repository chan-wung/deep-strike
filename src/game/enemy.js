import { H, ENTRY_PATHS, BONUS_PATHS, divePath, beamPath, sweepPath, zigzagPath, pathAt, makePath } from './paths.js';

/** score: 대열에 있을 때 · dive: 급강하 중일 때 · gauge: 잡았을 때 차는 필살기 게이지(급강하 중이면 두 배) */
export const KINDS = {
  bee: { score: 50, dive: 100, hp: 1, gauge: 3 },          // 해파리
  butterfly: { score: 80, dive: 160, hp: 1, gauge: 4 },    // 복어
  boss: { score: 150, dive: 400, hp: 2, gauge: 8 },        // 문어
  fish: { score: 100, dive: 100, hp: 1, gauge: 0 },        // 보너스 물고기
  ship: { score: 100, dive: 100, hp: 1, gauge: 3 },
  eel: { score: 100, dive: 200, hp: 1, gauge: 4 },          // 전기뱀장어: 화면을 가로로 가로지른다
  ray: { score: 120, dive: 240, hp: 1, gauge: 5 },          // 가오리: 지그재그로 내려오며 3갈래 탄
  turtle: { score: 200, dive: 400, hp: 3, gauge: 6 },       // 거북: 체력 3, 느리지만 단단하다
  mine: { score: 100, dive: 200, hp: 1, gauge: 4 },         // 폭탄 복어: 잡으면 사방으로 탄이 터진다        // 구하지 못하고 적이 된 잠수함
};
export const SPD = { enter: 2.4, toSlot: 2.6, exit: 2.6, bonus: 2.7 };
export const BEAM_TICKS = 170;
export const BEAM_MAX = 96;
/** 소용돌이: 문어 아래 8px 부터 길이 beamLen, 폭은 BEAM_HALF0 + 내려간 거리 * BEAM_SLOPE 의 절반 */
export const BEAM_HALF0 = 4;
export const BEAM_SLOPE = 0.3;
export const ENEMY_R = 6;

const DIVING = new Set(['dive', 'beamMove', 'beam', 'exit', 'hold']);
let nextId = 1;

/**
 * state: wait(입장 대기) → enter(입장 경로) → toSlot(자리로) → formation(대열)
 *        formation → dive → (화면 밖) → 위에서 다시 toSlot
 *        문어: formation → beamMove → beam(소용돌이) → exit → toSlot,  납치 중이면 hold
 * 대열이 없는 적(slotless: 보너스 물고기·적이 된 잠수함)은 화면 밖으로 나가면 gone.
 */
export class Enemy {
  constructor({ kind, row = 0, col = 0, wave = 0, delay = 0, entry = 0, slotless = false, bonus = false }) {
    Object.assign(this, { id: nextId++, kind, row, col, wave, delay, entry, slotless, bonus });
    this.hp = KINDS[kind].hp;
    this.state = 'wait';
    this.x = -100; this.y = -100; this.a = Math.PI / 2;
    this.d = 0;
    this.path = null;
    this.carrying = false;     // 납치한 잠수함을 데리고 있다
    this.group = null;         // 같이 출격한 무리 (문어 id)
    this.shotsLeft = 0;
    this.nextShotY = 0;
    this.timer = 0;
    this.beamLen = 0;
    this.speedMul = 1;         // 돌진(dash) 급강하는 더 빠르다
    this.carries = null;       // 품고 있는 아이템 종류. 화면에서 반짝이고, 잡으면 반드시 떨어뜨린다
  }

  get diving() { return DIVING.has(this.state); }
  get hittable() { return this.state !== 'wait' && this.state !== 'gone' && this.y > 0; }
  rect() { return { x0: this.x - ENEMY_R, x1: this.x + ENEMY_R, y0: this.y - ENEMY_R, y1: this.y + ENEMY_R }; }

  /** env: { slot(row, col), playTime, diveSpeed, fire(e) } */
  step(env) {
    switch (this.state) {
      case 'wait':
        if (env.playTime < this.delay) return;
        this.path = (this.bonus ? BONUS_PATHS : ENTRY_PATHS)[this.entry];
        this.d = 0;
        this.state = 'enter';
        this.follow(0);
        break;
      case 'enter':
        this.d += this.bonus ? SPD.bonus : SPD.enter;
        if (this.follow(this.d)) this.state = this.bonus ? 'gone' : 'toSlot';
        break;
      case 'toSlot': {
        const s = env.slot(this.row, this.col);
        const dx = s.x - this.x, dy = s.y - this.y, dist = Math.hypot(dx, dy);
        if (dist <= SPD.toSlot) { this.x = s.x; this.y = s.y; this.a = Math.PI / 2; this.state = 'formation'; }
        else { this.x += dx / dist * SPD.toSlot; this.y += dy / dist * SPD.toSlot; this.a = Math.atan2(dy, dx); }
        break;
      }
      case 'formation': {
        const s = env.slot(this.row, this.col);
        this.x = s.x; this.y = s.y; this.a = Math.PI / 2;
        break;
      }
      case 'dive':
        this.d += env.diveSpeed * this.speedMul;
        if (this.follow(this.d)) this.leave(env); else this.maybeFire(env);
        break;
      case 'beamMove':
        this.d += env.diveSpeed;
        if (this.follow(this.d)) { this.state = 'beam'; this.timer = BEAM_TICKS; this.a = Math.PI / 2; }
        break;
      case 'beam':
        this.beamLen = Math.min(BEAM_MAX, (BEAM_TICKS - this.timer) * 2.5);
        if (--this.timer <= 0) { this.beamLen = 0; this.state = 'exit'; }
        break;
      case 'exit':
        this.y += SPD.exit;
        if (this.y > H + 16) this.leave(env);
        break;
      default: break;     // hold · gone
    }
  }

  /** 경로를 d 만큼 따라간 자리로 옮긴다. 끝났으면 true */
  follow(d) {
    const p = pathAt(this.path, d);
    this.x = p.x; this.y = p.y; this.a = p.a;
    return p.end;
  }

  /** 화면 아래로 나갔다: 대열이 있으면 위에서 다시 들어오고, 없으면 사라진다 */
  leave(env) {
    this.group = null;
    this.speedMul = 1;
    if (this.slotless) { this.state = 'gone'; return; }
    const s = env.slot(this.row, this.col);
    this.x = s.x; this.y = -16;
    this.state = 'toSlot';
  }

  /** 돌진: 곡선 없이 플레이어 쪽으로 곧장, 더 빠르게 내리꽂힌다. 탄은 쏘지 않는다 */
  beginDash(tx) {
    const x = this.x, y = this.y, ty = H + 24;
    this.path = makePath([{ x, y }, { x: x + (tx - x) / 3, y: y + (ty - y) / 3 }, { x: x + 2 * (tx - x) / 3, y: y + 2 * (ty - y) / 3 }, { x: tx, y: ty }]);
    this.d = 0;
    this.state = 'dive';
    this.speedMul = 1.7;
    this.shotsLeft = 0;
  }

  /** 전기뱀장어: 탄 없이 화면을 가로로 가로지른다 */
  beginSweep(tx) {
    this.path = sweepPath(this.x, this.y, tx);
    this.d = 0;
    this.speedMul = 1.25;
    this.state = 'dive';
    this.shotsLeft = 0;
  }

  /** 가오리: 지그재그로 내려오며 한 번 3갈래로 쏜다 */
  beginZigzag(env, tx, d) {
    this.path = zigzagPath(this.x, this.y, tx, d);
    this.d = 0;
    this.speedMul = 1;
    this.state = 'dive';
    this.shotsLeft = 1;
    this.nextShotY = this.y + 60;
  }

  /** 거북: 느리게 내려오며 두 번 쏜다 */
  beginHeavy(env, tx, d) {
    this.beginDive(env, tx, d);
    this.speedMul = 0.65;
    this.shotsLeft = 2;
  }

  beginDive(env, tx, d) {
    this.path = divePath(this.x, this.y, tx, d);
    this.d = 0;
    this.speedMul = 1;
    this.state = 'dive';
    this.shotsLeft = env.shotsPerDive;
    this.nextShotY = this.y + 30;
  }

  beginBeam(tx, d) {
    this.path = beamPath(this.x, this.y, tx, d);
    this.d = 0;
    this.state = 'beamMove';
  }

  maybeFire(env) {
    if (this.shotsLeft > 0 && this.y > this.nextShotY && this.y < 230) {
      env.fire(this);
      this.shotsLeft--;
      this.nextShotY = this.y + 50;
    }
  }

  /** 플레이어가 죽거나 잡혔을 때: 출격 중인 적은 대열로 돌아간다 */
  recall() {
    if (!this.diving) return;
    this.beamLen = 0;
    this.group = null;
    this.speedMul = 1;
    this.state = this.slotless ? 'gone' : 'toSlot';
  }
}

/** 점 (px, py) 가 이 문어의 소용돌이 안에 있나 */
export function inBeam(boss, px, py) {
  if (boss.state !== 'beam') return false;
  const dy = py - (boss.y + 8);
  if (dy < 0 || dy > boss.beamLen) return false;
  return Math.abs(px - boss.x) < BEAM_HALF0 + dy * BEAM_SLOPE;
}
