import { W } from './paths.js';
import { PLAYER_Y } from './player.js';
import { Boss, BOSS_HOME_Y } from './boss.js';
import { TAU } from './geom.js';

export const LUNGE_DEPTH = 232;
/** 화면이 어두워지는 시간(틱) */
export const DARK_LEN = 210;

/**
 * 10 스테이지(그리고 25 · 40 ...)의 심해 아귀. 머리의 빛 미끼에서 먹물을 쏘고, 주기적으로 입을 벌리고 아래로 돌진한다(몸에 닿으면 죽는다).
 *   1단계: 미끼에서 두 갈래 먹물, 돌진
 *   2단계: 부채꼴 · 조준탄, 더 자주 돌진, 가끔 화면이 어두워진다 (미끼 주변만 보인다)
 *   3단계: 먹물 고리와 조준탄, 돌진이 잦고 암전이 길다
 */
export class Angler extends Boss {
  constructor(stage, hpMul = 1) {
    super(stage, hpMul, { kind: 'angler', nameKey: 'boss.angler', halfW: 34, up: 26, down: 26 });
    this.cd = 70;
    this.lungeCd = 360;
    this.lunge = null;          // { dir: 1 내려감 · -1 올라감 }
    this.darkCd = 300;
    this.darkT = 0;             // 0 이면 밝다, 1 이상이면 암전 중 (경과 틱)
    this.volley = 0;
    this.spin = 0;
  }

  get lureX() { return this.x + Math.sin(this.t * 0.08) * 10; }
  get lureY() { return this.y + 34; }

  /** 암전 정도 0~1 (서서히 어두워졌다 밝아진다) */
  get darkness() {
    if (this.darkT <= 0) return 0;
    return Math.max(0, Math.min(1, this.darkT / 30, (DARK_LEN - this.darkT) / 30));
  }

  /** 입을 벌리고 돌진하는 중에만 몸에 닿으면 맞는다 */
  contact(r) { return this.state === 'fight' && !!this.lunge && this.overlaps(r); }

  fight(env) {
    const p = this.phase;
    if (!this.lunge) {
      this.swing += 0.01 * (1 + 0.4 * (p - 1));
      const home = W / 2 + Math.sin(this.swing) * 64;
      this.x += Math.max(-1.6, Math.min(1.6, home - this.x));            // 돌진에서 돌아온 뒤에도 순간이동하지 않고 다가간다
      this.y = BOSS_HOME_Y + Math.sin(this.t * 0.05) * 3;
      if (--this.lungeCd <= 0) { this.lungeCd = [420, 340, 260][p - 1]; this.lunge = { dir: 1 }; }
    } else {
      this.x += Math.max(-1.6, Math.min(1.6, env.targetX - this.x));      // 플레이어 쪽으로 몰린다
      if (this.lunge.dir === 1) {
        this.y += 5;
        if (this.y >= LUNGE_DEPTH) this.lunge.dir = -1;
      } else {
        this.y -= 2.2;
        if (this.y <= BOSS_HOME_Y) { this.y = BOSS_HOME_Y; this.lunge = null; }
      }
    }

    if (p >= 2) {                                                          // 암전
      if (this.darkT > 0) { if (++this.darkT > DARK_LEN) this.darkT = 0; }
      else if (--this.darkCd <= 0) { this.darkCd = p === 2 ? 620 : 480; this.darkT = 1; }
    }

    if (!this.lunge && --this.cd <= 0) {
      this.cd = [90, 100, 70][p - 1];
      this.volley++;
      const gx = this.lureX, gy = this.lureY;
      const aim = Math.atan2(PLAYER_Y - gy, env.targetX - gx);
      const sp = Math.min(1.4 + 0.06 * this.level, 2.4);
      if (p === 1) {
        for (const o of [-0.2, 0.2]) env.shoot(gx, gy, aim + o, sp);
      } else if (p === 2) {
        if (this.volley % 2) for (let k = -3; k <= 3; k++) env.shoot(gx, gy, Math.PI / 2 + k * 0.3, sp);
        else for (const o of [-0.25, 0, 0.25]) env.shoot(gx, gy, aim + o, sp + 0.2);
      } else {
        this.spin += 0.3;
        for (let i = 0; i < 10; i++) env.shoot(gx, gy, this.spin + i * TAU / 10, sp * 0.85);
        env.shoot(gx, gy, aim, sp + 0.4);
      }
    }
  }
}
