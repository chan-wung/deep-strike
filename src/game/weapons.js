/**
 * 새 무기: 아이템으로 먹으면 15초 동안 기본 어뢰 대신 쓴다.
 *  spread : 3갈래 부채꼴
 *  laser  : 빠른 광선이 적을 꿰뚫는다 (한 발이 같은 적은 한 번만 맞힌다)
 *  homing : 가까운 적을 향해 휘어 간다
 * 어떤 아이템이 언제 나오는지(스테이지별 분배)도 여기서 정한다.
 */
export const WEAPONS = ['spread', 'laser', 'homing', 'blast', 'sonic'];
export const WEAPON_TICKS = 900;

/**
 * 무기 모양: shots 는 한 기체가 한 번에 쏘는 발 수, angles 는 위쪽(-π/2) 기준 벌어짐.
 * plain 은 곧장 위로 가는 기본 공격(기체마다 다르다): offsets 는 나란히 나가는 줄의 좌우 간격, k 는 어뢰 속도에 곱하는 배율,
 * maxHit 는 관통 어뢰가 꿰뚫을 수 있는 적의 수, rounds · rapidRounds 는 화면에 동시에 있을 수 있는 묶음 수(기본 2 · 연사 중 8)
 */
export const WEAPON_DEF = {
  torpedo: { shots: 1, angles: [0], speed: 4.5, cooldown: 7, plain: true },
  needle: { shots: 2, angles: [0], speed: 3.8, cooldown: 6, plain: true, kind: 'needle', offsets: [-3, 3], k: 1.15, rounds: 1, rapidRounds: 4 },
  heavy: { shots: 1, angles: [0], speed: 4.2, cooldown: 10, plain: true, kind: 'heavy', pierce: true, maxHit: 2, w: 2.6, k: 1.12 },
  spread: { shots: 3, angles: [-0.26, 0, 0.26], speed: 4.2, cooldown: 8 },
  laser: { shots: 1, angles: [0], speed: 8, cooldown: 9, pierce: true },
  homing: { shots: 1, angles: [0], speed: 3.4, cooldown: 9, homing: true },
  blast: { shots: 1, angles: [0], speed: 3.8, cooldown: 10, blast: true },
  sonic: { shots: 1, angles: [0], speed: 3, cooldown: 12, pierce: true, life: 60, w0: 4 },
};

/** 영구 강화 아이템: 먹을 때마다 한 단계씩 (최대 UPGRADE_MAX), 잠수함을 잃으면 사라진다 */
export const UPGRADES = ['boost', 'velo', 'reload'];

/** 무기가 처음 나오는 스테이지 */
export const WEAPON_FROM = { spread: 2, laser: 4, homing: 7, blast: 5, sonic: 9 };

/** 아이템 가중치. 앞 세 개(rapid·shield·charge)는 무기가 없던 때와 같은 3:3:2 다 */
export const ITEM_WEIGHTS = { rapid: 3, shield: 3, charge: 2, spread: 3, laser: 2, homing: 2, blast: 2, sonic: 2, boost: 1, velo: 1, reload: 1 };

/** 이 스테이지에서 나올 수 있는 아이템과 가중치: [[종류, 가중치], ...] */
export function itemPool(stage) {
  return Object.entries(ITEM_WEIGHTS).filter(([type]) => !WEAPON_FROM[type] || stage >= WEAPON_FROM[type]);
}

/** 가중치대로 하나 뽑는다 (난수 한 번) */
export function pickItem(rng, stage) {
  const pool = itemPool(stage);
  let r = rng() * pool.reduce((s, [, k]) => s + k, 0);
  for (const [type, k] of pool) { if ((r -= k) < 0) return type; }
  return pool[pool.length - 1][0];
}

/** 보스가 사나워질 때 떨어뜨릴 무기 하나 (나올 수 있는 무기가 없으면 null) */
export function pickWeapon(rng, stage) {
  const pool = itemPool(stage).filter(([type]) => WEAPON_FROM[type]);
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))][0];
}
