import { W } from './paths.js';
import { PLAYER_Y } from './player.js';
import { Boss, BOSS_HOME_Y } from './boss.js';
import { TAU } from './geom.js';

export const KRAKEN_Y = BOSS_HOME_Y;

/**
 * 5 스테이지(그리고 20 · 35 ...)의 크라켄. 체력이 줄면 3단계로 사나워진다.
 *   1단계: 플레이어를 겨눈 3갈래 먹물
 *   2단계: 5갈래 부채꼴과 조준탄을 번갈아, 해파리를 풀어 놓는다
 *   3단계: 빙글 도는 먹물 고리와 빠른 조준탄, 해파리를 더 자주
 */
export class Kraken extends Boss {
  constructor(stage, hpMul = 1) {
    super(stage, hpMul, { kind: 'kraken', nameKey: 'boss.kraken', halfW: 30, up: 28, down: 24 });
    this.cd = 60;
    this.spawnCd = 300;
    this.volley = 0;
    this.spin = 0;
  }

  fight(env) {
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
