import { W } from './paths.js';
import { PLAYER_Y } from './player.js';
import { Boss } from './boss.js';

/** 먹물 장막: 가로 9칸에 한 줄로 탄이 내려오고 두 칸만 비어 있다 */
export const CURTAIN_SLOTS = 9;
export const CURTAIN_GAP = 2;
const SLOT_W = 24.5;
export const curtainX = (i) => 14 + i * SLOT_W;

/**
 * 15 스테이지(그리고 30 · 45 ...)의 거대 가오리. 먹물 장막의 빈틈으로 빠져나가며 싸운다.
 *   1단계: 느린 장막
 *   2단계: 더 빠른 장막 + 3갈래 조준탄
 *   3단계: 빠른 장막 + 조준탄 + 폭탄 복어를 떨어뜨린다
 */
export class Manta extends Boss {
  constructor(stage, hpMul = 1) {
    super(stage, hpMul, { kind: 'manta', nameKey: 'boss.manta', halfW: 42, up: 18, down: 20 });
    this.cd = 80;
    this.aimCd = 90;
    this.mineCd = 260;
    this.gapAt = 3;
    this.volley = 0;
  }

  /** 지난번 틈과 두 칸 이상 떨어진 새 틈 */
  nextGap(rand) {
    const max = CURTAIN_SLOTS - CURTAIN_GAP;           // 0 ~ 7
    let g = Math.floor(rand() * (max + 1));
    if (Math.abs(g - this.gapAt) < 2) g = (g + 4) % (max + 1);
    return g;
  }

  fight(env) {
    const p = this.phase;
    this.swing += [0.018, 0.024, 0.032][p - 1];
    this.x = W / 2 + Math.sin(this.swing) * 68;
    this.y = 70 + Math.sin(this.t * 0.045) * 8;
    const sp = 1.25 + 0.05 * this.level;
    if (--this.cd <= 0) {
      this.cd = [150, 120, 95][p - 1];
      this.volley++;
      this.gapAt = this.nextGap(env.rand);
      for (let i = 0; i < CURTAIN_SLOTS; i++) {
        if (i >= this.gapAt && i < this.gapAt + CURTAIN_GAP) continue;
        env.shoot(curtainX(i), this.y + 20, Math.PI / 2, sp);
      }
    }
    if (p >= 2 && --this.aimCd <= 0) {
      this.aimCd = p === 2 ? 100 : 70;
      const aim = Math.atan2(PLAYER_Y - (this.y + 20), env.targetX - this.x);
      for (const o of [-0.25, 0, 0.25]) env.shoot(this.x, this.y + 20, aim + o, sp + 0.3);
    }
    if (p === 3 && --this.mineCd <= 0) {
      this.mineCd = 260;
      env.minion(this.x, this.y + 16, 'mine');
    }
  }
}
