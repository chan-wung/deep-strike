import { W } from './paths.js';
import { overlap } from './geom.js';

/** 5 · 10 · 15 · 20 스테이지의 보스 번호 (1부터) */
export const bossIndex = (stage) => Math.max(1, Math.round(stage / 5));
export const BOSS_HOME_Y = 74;

/**
 * 보스의 공통 뼈대. 체력이 줄면 3단계로 사나워지고, enter(내려옴) → fight → dying(쓰러지는 연출) → dead.
 * 보스마다 fight(env) 만 다르게 만든다.
 * env: { targetX, shoot(x, y, 각도, 속도), minion(x, y, 종류), rand() }
 */
export class Boss {
  /** hpMul: 난이도에 따른 체력 배율. halfW·up·down: 맞는 영역(중심에서 좌우 반폭, 위·아래) */
  constructor(stage, hpMul = 1, { kind, nameKey, halfW = 30, up = 28, down = 24 }) {
    this.kind = kind;
    this.nameKey = nameKey;
    this.level = bossIndex(stage);
    this.maxHp = Math.round((60 + 30 * (this.level - 1)) * hpMul);
    this.hp = this.maxHp;
    this.x = W / 2;
    this.y = -40;
    this.state = 'enter';
    this.t = 0;
    this.flash = 0;
    this.timer = 0;
    this.swing = 0;          // 좌우 흔들림의 위상. 속도(단계)가 바뀌어도 위치가 튀지 않게 누적해 쓴다
    this.dead = false;
    this.halfW = halfW; this.up = up; this.down = down;
  }

  get phase() {
    const r = this.hp / this.maxHp;
    return r > 2 / 3 ? 1 : r > 1 / 3 ? 2 : 3;
  }

  /** 화면에 어느 정도 들어오고 아직 쓰러지는 중이 아닐 때만 맞는다 */
  get targetable() { return (this.state === 'enter' || this.state === 'fight') && this.y > 8; }

  rect() { return { x0: this.x - this.halfW, x1: this.x + this.halfW, y0: this.y - this.up, y1: this.y + this.down }; }

  /** 몸으로 플레이어(rect)를 들이받았나. 몸통 공격이 있는 보스만 다시 정의한다 */
  contact() { return false; }

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
      if (this.y >= BOSS_HOME_Y) { this.y = BOSS_HOME_Y; this.state = 'fight'; this.t = 0; }
      return;
    }
    if (this.state === 'dying') {
      if (--this.timer <= 0) { this.state = 'dead'; this.dead = true; }
      return;
    }
    if (this.state === 'fight') this.fight(env);
  }

  fight() { /* 보스마다 다르다 */ }

  overlaps(r) { return overlap(this.rect(), r); }
}
