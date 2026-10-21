import { W } from './paths.js';
import { overlap } from './geom.js';

/** 5 · 10 · 15 · 20 스테이지의 보스 번호 (1부터) */
export const bossIndex = (stage) => Math.max(1, Math.round(stage / 5));
export const BOSS_HOME_Y = 74;
/** 보스 체력: 첫 보스 BOSS_HP_BASE, 보스 번호가 오를 때마다 BOSS_HP_STEP 씩 (100 · 150 · 200 · 250) */
export const BOSS_HP_BASE = 100;
export const BOSS_HP_STEP = 50;
/** 돌진하는 보스(아귀·리바이어던)가 내려가는 가장 깊은 곳 */
export const LUNGE_DEPTH = 232;
const DRIFT_STEP = 1.6;

/**
 * 보스의 공통 뼈대. 체력이 줄면 3단계로 사나워지고, enter(내려옴) → fight → dying(쓰러지는 연출) → dead.
 * 보스마다 fight(env) 만 다르게 만든다.
 * env: { targetX, shoot(x, y, 각도, 속도), minion(x, y, 종류), rand() }
 */
export class Boss {
  /** halfW·up·down: 맞는 영역(중심에서 좌우 반폭, 위·아래) */
  constructor(stage, { kind, nameKey, halfW = 30, up = 28, down = 24 }) {
    this.kind = kind;
    this.nameKey = nameKey;
    this.level = bossIndex(stage);
    this.maxHp = BOSS_HP_BASE + BOSS_HP_STEP * (this.level - 1);
    this.hp = this.maxHp;
    this.x = W / 2;
    this.y = -40;
    this.state = 'enter';
    this.t = 0;
    this.flash = 0;
    this.timer = 0;
    this.swing = 0;          // 좌우 흔들림의 위상. 속도(단계)가 바뀌어도 위치가 튀지 않게 누적해 쓴다
    this.dead = false;
    this.lunge = null;       // 돌진 중이면 { dir: 1 내려감 · -1 올라감 }. 돌진하는 보스만 쓴다
    this.halfW = halfW; this.up = up; this.down = down;
  }

  get phase() {
    const r = this.hp / this.maxHp;
    return r > 2 / 3 ? 1 : r > 1 / 3 ? 2 : 3;
  }

  /** 화면에 어느 정도 들어오고 아직 쓰러지는 중이 아닐 때만 맞는다 */
  get targetable() { return (this.state === 'enter' || this.state === 'fight') && this.y > 8; }

  rect() { return { x0: this.x - this.halfW, x1: this.x + this.halfW, y0: this.y - this.up, y1: this.y + this.down }; }

  /** 입을 벌리고 돌진하는 중에만 몸에 닿으면 맞는다 */
  contact(r) { return this.state === 'fight' && !!this.lunge && this.overlaps(r); }

  /** x 를 target 쪽으로 한 틱에 조금씩 옮긴다 (순간이동하지 않고 다가간다) */
  drift(target) { this.x += Math.max(-DRIFT_STEP, Math.min(DRIFT_STEP, target - this.x)); }

  /** 돌진 한 틱: 플레이어 쪽으로 몰리며 LUNGE_DEPTH 까지 내려갔다가 BOSS_HOME_Y 로 올라오면 끝낸다 */
  lungeStep(env) {
    this.drift(env.targetX);
    if (this.lunge.dir === 1) {
      this.y += 5;
      if (this.y >= LUNGE_DEPTH) this.lunge.dir = -1;
    } else {
      this.y -= 2.2;
      if (this.y <= BOSS_HOME_Y) { this.y = BOSS_HOME_Y; this.lunge = null; }
    }
  }

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
