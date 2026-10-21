/**
 * 잠수함 기체. 기본 공격(base, weapons.js 의 WEAPON_DEF 이름)·이동 속도·시작 폭탄 수·필살기(special, specials.js)가 다르다.
 * 새 게임을 시작할 때 고르고, 아이템 무기가 끝나면 자기 기본 공격으로 돌아온다.
 * gold 는 히든 기체: 비밀 커맨드로 해금하거나 '랜덤'을 골랐을 때 낮은 확률로 걸린다. 다른 기체보다 모든 면에서 강하다.
 */
export const SHIP_ORDER = ['yellow', 'dart', 'hammer'];
export const HIDDEN_SHIP = 'gold';
/** 기체 고르기에서 기체 대신 고르는 '랜덤' */
export const RANDOM = 'random';
/** 랜덤으로 시작할 때 히든 기체가 걸릴 확률 */
export const GOLD_CHANCE = 0.05;

export const SHIPS = {
  yellow: { base: 'torpedo', speed: 1.7, bombs: 3, special: 'wave' },     // 균형형 · 대해일
  dart: { base: 'needle', speed: 2.1, bombs: 2, special: 'storm' },       // 빠르고 가벼움 · 어뢰 폭풍
  hammer: { base: 'heavy', speed: 1.4, bombs: 4, special: 'carpet' },     // 느리지만 강함 · 심해 폭격
  gold: { base: 'gold', speed: 2.2, bombs: 5, special: 'gold' },          // 히든: 빠르고 강하다 · 황금 해일 (대해일 + 어뢰 폭풍)
};

export const DEFAULT_SHIP = 'yellow';
export const isShip = (id) => id in SHIPS;
