import { W } from './paths.js';
import { PLAYER_Y } from './player.js';
import { Boss, BOSS_HOME_Y } from './boss.js';
import { CURTAIN_SLOTS, CURTAIN_GAP, curtainX } from './manta.js';
import { LUNGE_DEPTH } from './angler.js';
import { TAU } from './geom.js';

/**
 * 20 스테이지(마지막)의 심해의 왕 리바이어던. 앞의 세 보스의 공격을 단계마다 하나씩 더 섞어 쓴다.
 *   1단계: 3갈래 조준탄 + 느린 장막 (크라켄 · 거대 가오리)
 *   2단계: 빙글 도는 먹물 고리와 해파리가 더해지고, 장막이 빨라진다
 *   3단계: 입을 벌리고 돌진하고(심해 아귀) 폭탄 복어를 떨어뜨린다. 고리가 촘촘하다
 */
export class Leviathan extends Boss {
  constructor(stage, hpMul = 1) {
    super(stage, hpMul, { kind: 'leviathan', nameKey: 'boss.leviathan', halfW: 46, up: 30, down: 28 });
    this.aimCd = 70;
    this.curtainCd = 120;
    this.ringCd = 110;
    this.spawnCd = 300;
    this.lungeCd = 420;
    this.lunge = null;          // { dir: 1 내려감 · -1 올라감 }
    this.gapAt = 3;
    this.spin = 0;
    this.volley = 0;
  }

  /** 입을 벌리고 돌진하는 중에만 몸에 닿으면 맞는다 */
  contact(r) { return this.state === 'fight' && !!this.lunge && this.overlaps(r); }

  /** 지난번 틈과 두 칸 이상 떨어진 새 틈 */
  nextGap(rand) {
    const max = CURTAIN_SLOTS - CURTAIN_GAP;
    let g = Math.floor(rand() * (max + 1));
    if (Math.abs(g - this.gapAt) < 2) g = (g + 4) % (max + 1);
    return g;
  }

  fight(env) {
    const p = this.phase;
    if (!this.lunge) {
      this.swing += [0.012, 0.016, 0.02][p - 1];
      const home = W / 2 + Math.sin(this.swing) * 62;
      this.x += Math.max(-1.6, Math.min(1.6, home - this.x));            // 돌진에서 돌아온 뒤에도 순간이동하지 않고 다가간다
      this.y = BOSS_HOME_Y + Math.sin(this.t * 0.04) * 4;
      if (p === 3 && --this.lungeCd <= 0) { this.lungeCd = 380; this.lunge = { dir: 1 }; }
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
    if (this.lunge) return;                                                // 돌진하는 동안은 쏘지 않는다

    const sp = Math.min(1.5 + 0.05 * this.level, 2.4);
    const gx = this.x, gy = this.y + 22;
    const aim = Math.atan2(PLAYER_Y - gy, env.targetX - gx);

    if (--this.aimCd <= 0) {
      this.aimCd = [75, 65, 55][p - 1];
      for (const o of p === 1 ? [-0.25, 0, 0.25] : [-0.4, -0.2, 0, 0.2, 0.4]) env.shoot(gx, gy, aim + o, sp + 0.1);
    }
    if (--this.curtainCd <= 0) {
      this.curtainCd = [170, 140, 120][p - 1];
      this.gapAt = this.nextGap(env.rand);
      for (let i = 0; i < CURTAIN_SLOTS; i++) {
        if (i >= this.gapAt && i < this.gapAt + CURTAIN_GAP) continue;
        env.shoot(curtainX(i), gy, Math.PI / 2, sp * 0.85);
      }
    }
    if (p >= 2 && --this.ringCd <= 0) {
      this.ringCd = p === 2 ? 130 : 100;
      this.spin += 0.31;
      const n = p === 2 ? 10 : 14;
      for (let i = 0; i < n; i++) env.shoot(gx, gy, this.spin + i * TAU / n, sp * 0.8);
    }
    if (p >= 2 && --this.spawnCd <= 0) {
      this.spawnCd = p === 2 ? 320 : 260;
      env.minion(this.x, this.y + 18, p === 3 && ++this.volley % 2 ? 'mine' : 'bee');
    }
  }
}
