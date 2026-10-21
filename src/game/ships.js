/**
 * 잠수함 기체. 기본 공격(base, weapons.js 의 WEAPON_DEF 이름)·이동 속도·시작 폭탄 수·필살기(special, specials.js)가 다르다.
 * 새 게임을 시작할 때 고르고, 아이템 무기가 끝나면 자기 기본 공격으로 돌아온다.
 */
export const SHIP_ORDER = ['yellow', 'dart', 'hammer'];

export const SHIPS = {
  yellow: { base: 'torpedo', speed: 1.7, bombs: 3, special: 'wave' },     // 균형형 · 대해일
  dart: { base: 'needle', speed: 2.1, bombs: 2, special: 'storm' },       // 빠르고 가벼움 · 어뢰 폭풍
  hammer: { base: 'heavy', speed: 1.4, bombs: 4, special: 'carpet' },     // 느리지만 강함 · 심해 폭격
};

export const DEFAULT_SHIP = 'yellow';
export const isShip = (id) => SHIP_ORDER.includes(id);
