import { W } from './paths.js';
import { PLAYER_Y } from './player.js';

export const KRAKEN_Y = 74;
const TAU = Math.PI * 2;

/**
 * 보스 스테이지(5 · 10 · 15 ...)의 크라켄. 체력이 줄면 3단계로 사나워진다.
 *   1단계: 플레이어를 겨눈 3갈래 먹물
 *   2단계: 5갈래 부채꼴과 조준탄을 번갈아, 해파리를 풀어 놓는다
 *   3단계: 빙글 도는 먹물 고리와 빠른 조준탄, 해파리를 더 자주
 * env: { targetX, shoot(x, y, 각도, 속도), minion(x, y) }
 */
export class Kraken {
  /** hpMul: 난이도에 따른 체력 배율 */
  constructor(stage, hpMul = 1) {
    this.level = Math.max(1, Math.round(stage / 5));
    this.maxHp = Math.round((60 + 30 * (this.level - 1)) * hpMul);
    this.hp = this.maxHp;
    this.x = W / 2;
    this.y = -40;
    this.state = 'enter';        // enter → fight → dying → dead
    this.t = 0;
    this.cd = 60;
    this.spawnCd = 300;
    this.volley = 0;
    this.spin = 0;
    this.flash = 0;
    this.timer = 0;
    this.dead = false;
  }

  get phase() {
    const r = this.hp / this.maxHp;
    return r > 2 / 3 ? 1 : r > 1 / 3 ? 2 : 3;
  }

  /** 화면에 어느 정도 들어오고 아직 쓰러지는 중이 아닐 때만 맞는다 */
  get targetable() { return (this.state === 'enter' || this.state === 'fight') && this.y > 8; }

  rect() { return { x0: this.x - 30, x1: this.x + 30, y0: this.y - 28, y1: this.y + 24 }; }

  /** n 만큼 맞는다. 이 타격으로 쓰러지면 true */
  damage(n) {
    if (!this.targetable) return false;
    this.hp = Math.max(0, this.hp - n);
    this.flash = 5;
    if (this.hp > 0) return false;
    this.state = 'dying';
    this.timer = 120;
    return true;
  }

  step(env) {
    if (this.flash > 0) this.flash--;
    this.t++;
    if (this.state === 'enter') {
      this.y += 1;
      if (this.y >= KRAKEN_Y) { this.y = KRAKEN_Y; this.state = 'fight'; this.t = 0; }
      return;
    }
    if (this.state === 'dying') {
      if (--this.timer <= 0) { this.state = 'dead'; this.dead = true; }
      return;
    }
    if (this.state !== 'fight') return;

    const p = this.phase;
    this.x = W / 2 + Math.sin(this.t * [0.012, 0.017, 0.024][p - 1]) * 70;
    this.y = KRAKEN_Y + Math.sin(this.t * 0.05) * 4;
    const sp = Math.min(1.4 + 0.06 * this.level, 2.4) + (p === 3 ? 0.2 : 0);
    if (--this.cd <= 0) {
      this.cd = [80, 70, 50][p - 1];
      this.volley++;
      const gx = this.x, gy = this.y + 18;
      const aim = Math.atan2(PLAYER_Y - gy, env.targetX - gx);
      if (p === 1) {
        for (const o of [-0.28, 0, 0.28]) env.shoot(gx, gy, aim + o, sp);
      } else if (p === 2) {
        if (this.volley % 2) for (const o of [-0.6, -0.3, 0, 0.3, 0.6]) env.shoot(gx, gy, Math.PI / 2 + o, sp);
        else for (const o of [-0.2, 0, 0.2]) env.shoot(gx, gy, aim + o, sp + 0.2);
      } else {
        this.spin += 0.35;
        for (let i = 0; i < 12; i++) env.shoot(gx, gy, this.spin + i * TAU / 12, sp * 0.85);
        if (this.volley % 2 === 0) env.shoot(gx, gy, aim, sp + 0.4);
      }
    }
    if (p >= 2 && --this.spawnCd <= 0) {
      this.spawnCd = p === 2 ? 300 : 220;
      env.minion(this.x, this.y + 16);
    }
  }
}
