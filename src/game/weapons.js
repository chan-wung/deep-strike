/**
 * 새 무기: 아이템으로 먹으면 15초 동안 기본 어뢰 대신 쓴다.
 *  spread : 3갈래 부채꼴
 *  laser  : 빠른 광선이 적을 꿰뚫는다 (한 발이 같은 적은 한 번만 맞힌다)
 *  homing : 가까운 적을 향해 휘어 간다
 * 어떤 아이템이 언제 나오는지(스테이지·난이도별 분배)도 여기서 정한다.
 */
export const WEAPONS = ['spread', 'laser', 'homing'];
export const WEAPON_TICKS = 900;

/** 무기 모양: shots 는 한 기체가 한 번에 쏘는 발 수, angles 는 위쪽(-π/2) 기준 벌어짐 */
export const WEAPON_DEF = {
  torpedo: { shots: 1, angles: [0], speed: 4.5, cooldown: 7 },
  spread: { shots: 3, angles: [-0.26, 0, 0.26], speed: 4.2, cooldown: 8 },
  laser: { shots: 1, angles: [0], speed: 8, cooldown: 9, pierce: true },
  homing: { shots: 1, angles: [0], speed: 3.4, cooldown: 9, homing: true },
};

/** 무기가 처음 나오는 스테이지 (보통 기준) */
export const WEAPON_FROM = { spread: 2, laser: 4, homing: 7 };
/** 난이도에 따라 무기가 나오는 시점이 앞서거나 늦는다 */
const FROM_SHIFT = { easy: -1, normal: 0, hard: 1 };
FROM_SHIFT.endless = FROM_SHIFT.hard;                // 무한은 어려움과 같다

/**
 * 아이템 가중치. 쉬우면 방어막·유도탄이 후하고, 어려우면 방어막은 짜고 레이저·해일 충전이 많다.
 * 보통의 앞 세 개(rapid·shield·charge)는 무기가 없던 때와 같은 3:3:2 다.
 */
export const ITEM_WEIGHTS = {
  easy: { rapid: 3, shield: 4, charge: 2, spread: 3, laser: 2, homing: 3 },
  normal: { rapid: 3, shield: 3, charge: 2, spread: 3, laser: 2, homing: 2 },
  hard: { rapid: 3, shield: 2, charge: 3, spread: 2, laser: 3, homing: 1 },
};
ITEM_WEIGHTS.endless = ITEM_WEIGHTS.hard;            // 무한은 어려움과 같다

/** 이 난이도에서 무기가 처음 나오는 스테이지 */
export const weaponFrom = (weapon, difficulty) => Math.max(1, WEAPON_FROM[weapon] + (FROM_SHIFT[difficulty] ?? 0));

/** 이 스테이지·난이도에서 나올 수 있는 아이템과 가중치: [[종류, 가중치], ...] */
export function itemPool(stage, difficulty) {
  const w = ITEM_WEIGHTS[difficulty] || ITEM_WEIGHTS.normal;
  return Object.entries(w).filter(([type]) => !WEAPON_FROM[type] || stage >= weaponFrom(type, difficulty));
}

/** 가중치대로 하나 뽑는다 (난수 한 번) */
export function pickItem(rng, stage, difficulty) {
  const pool = itemPool(stage, difficulty);
  let r = rng() * pool.reduce((s, [, k]) => s + k, 0);
  for (const [type, k] of pool) { if ((r -= k) < 0) return type; }
  return pool[pool.length - 1][0];
}

/** 보스가 사나워질 때 떨어뜨릴 무기 하나 (나올 수 있는 무기가 없으면 null) */
export function pickWeapon(rng, stage, difficulty) {
  const pool = itemPool(stage, difficulty).filter(([type]) => WEAPON_FROM[type]);
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))][0];
}
