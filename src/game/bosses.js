import { bossIndex } from './boss.js';
import { Kraken } from './kraken.js';
import { Angler } from './angler.js';
import { Manta } from './manta.js';

/** 보스 스테이지마다 크라켄 → 심해 아귀 → 거대 가오리 순으로 돌아가며 나온다 (번호가 오를수록 체력이 커진다) */
export const BOSS_CLASSES = [Kraken, Angler, Manta];

export function createBoss(stage, hpMul = 1) {
  const Cls = BOSS_CLASSES[(bossIndex(stage) - 1) % BOSS_CLASSES.length];
  return new Cls(stage, hpMul);
}
