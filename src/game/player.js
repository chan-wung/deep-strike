import { W } from './paths.js';

export const PLAYER_Y = 262;
const SPEED = 1.7;
const SHOT_SPEED = 4.5;
const COOLDOWN = 7;
/** 쌍둥이 잠수함의 두 번째 기체가 붙는 간격 */
export const TWIN_GAP = 14;

/** 잠수함. 구출하면 옆에 한 대가 더 붙어(twin) 어뢰가 두 줄로 나가고 맞는 폭도 넓어진다 */
export class Player {
  constructor() { this.reset(); }

  reset(keepTwin = false) {
    this.x = W / 2;
    this.twin = keepTwin ? this.twin : false;
    this.shots = [];
    this.cooldown = 0;
    this.invuln = 0;
    this.move = 0;
    this.target = null;       // 터치로 끌고 있을 때 가려는 x
    this.firing = false;
  }

  get maxX() { return W - 8 - (this.twin ? TWIN_GAP : 0); }

  /** 맞는 영역 (두 대면 그만큼 넓다) */
  rect() {
    return { x0: this.x - 6, x1: this.x + 6 + (this.twin ? TWIN_GAP : 0), y0: PLAYER_Y - 6, y1: PLAYER_Y + 6 };
  }

  setMove(dir) { this.move = dir; if (dir) this.target = null; }
  setFire(on) { this.firing = on; }
  moveTo(x) { this.target = x; }

  /** 어뢰는 한 줄(쌍둥이면 두 줄)씩 나가고 화면에 두 번(쌍둥이 네 발)까지만 있을 수 있다. 쏜 발수를 돌려준다 */
  tryFire() {
    const volley = this.twin ? 2 : 1;
    if (this.shots.length + volley > volley * 2) return 0;
    this.shots.push({ x: this.x, y: PLAYER_Y - 8 });
    if (this.twin) this.shots.push({ x: this.x + TWIN_GAP, y: PLAYER_Y - 8 });
    return volley;
  }

  /** 한 틱. canFire 가 false 면 움직이기만 한다. 쏜 어뢰 수를 돌려준다 */
  step(canFire = true) {
    if (this.move) this.x += this.move * SPEED;
    else if (this.target !== null) {
      const dx = this.target - this.x;
      this.x += Math.max(-SPEED * 1.8, Math.min(SPEED * 1.8, dx));
    }
    this.x = Math.max(8, Math.min(this.maxX, this.x));
    if (this.invuln > 0) this.invuln--;
    for (const s of this.shots) s.y -= SHOT_SPEED;
    this.shots = this.shots.filter((s) => s.y > -8 && !s.dead);
    if (this.cooldown > 0) this.cooldown--;
    if (canFire && this.firing && this.cooldown <= 0) {
      const n = this.tryFire();
      if (n) { this.cooldown = COOLDOWN; return n; }
    }
    return 0;
  }
}
