import { W } from './paths.js';
import { WEAPON_DEF, WEAPON_AMMO } from './weapons.js';
import { SHIPS, DEFAULT_SHIP, HIDDEN_SHIP, isShip } from './ships.js';

export const PLAYER_Y = 262;
const SHOT_SPEED = 4.5;
const RAPID_COOLDOWN = 4;
/** 유도탄이 한 틱에 꺾을 수 있는 각도 (라디안) */
const TURN = 0.07;
/** 영구 강화: 최대 단계와 단계마다 늘어나는 양 */
export const UPGRADE_MAX = 3;
const BOOST_STEP = 0.3;
const VELO_STEP = 0.8;
const MIN_COOLDOWN = 3;
/** 음파 링이 넓어지는 한계 (반폭) */
const SONIC_MAX_W = 14;
/** 연사 강화 아이템이 지속되는 틱 수 (10초) */
export const RAPID_TICKS = 600;
/** 쌍둥이 잠수함의 두 번째 기체가 붙는 간격 */
export const TWIN_GAP = 14;

/** 잠수함. 구출하면 옆에 한 대가 더 붙어(twin) 어뢰가 두 줄로 나가고 맞는 폭도 넓어진다 */
export class Player {
  constructor() { this.reset(); }

  /** keepTwin: 다음 스테이지로 넘어갈 때처럼 쌍둥이와 아이템 효과를 이어 간다 */
  reset(keepTwin = false) {
    this.ship ??= DEFAULT_SHIP;                     // 기체는 판마다 고르는 것이라 잠수함을 잃어도 그대로다
    this.x = keepTwin ? this.x : W / 2;             // 다음 스테이지로 넘어갈 때는 있던 자리에서 이어 간다
    this.twin = keepTwin ? this.twin : false;
    this.rapid = keepTwin ? this.rapid : 0;         // 연사 강화 남은 틱
    this.shield = keepTwin ? this.shield : false;   // 방어막: 한 번 맞는 것을 막는다
    this.weapon = keepTwin ? this.weapon : this.base;   // 새 무기와 남은 틱: 잠수함을 잃으면 사라지고 기체의 기본 공격으로 돌아온다
    this.ammo = keepTwin ? this.ammo : 0;           // 아이템 무기의 남은 탄수 (0 이면 기본 공격)
    this.boost = keepTwin ? this.boost : 0;         // 영구 강화(단계): 추진기·어뢰 가속·장전기. 잠수함을 잃으면 사라진다
    this.velo = keepTwin ? this.velo : 0;
    this.reload = keepTwin ? this.reload : 0;
    this.shots = [];
    this.cooldown = 0;
    this.invuln = 0;
    this.quiet = false;       // true 면 맞지 않는 동안에도 깜빡이지 않는다 (방어막이 깨진 직후)
    this.move ??= 0;          // 키 입력 상태는 게임 상태가 아니라서 잠수함을 잃어도 이어 간다
    this.target ??= null;     // 터치로 끌고 있을 때 가려는 x
    this.firing ??= false;
  }

  /** 기체를 바꾼다 (새 게임을 시작할 때). 아이템 무기가 없으면 기본 공격도 따라 바뀐다 */
  setShip(id) {
    this.ship = isShip(id) ? id : DEFAULT_SHIP;
    if (this.ammo <= 0) this.weapon = this.base;
  }

  get base() { return SHIPS[this.ship].base; }
  get speed() { return SHIPS[this.ship].speed + this.boost * BOOST_STEP; }
  get shotSpeed() { return SHOT_SPEED + this.velo * VELO_STEP; }

  get maxX() { return W - 8 - (this.twin ? TWIN_GAP : 0); }

  /** 맞는 영역 (두 대면 그만큼 넓다) */
  rect() {
    return { x0: this.x - 6, x1: this.x + 6 + (this.twin ? TWIN_GAP : 0), y0: PLAYER_Y - 6, y1: PLAYER_Y + 6 };
  }

  setMove(dir) { this.move = dir; if (dir) this.target = null; }
  setFire(on) { this.firing = on; }
  moveTo(x) { this.target = x; }

  /**
   * 새 무기로 바꾼다 (무기마다 정해진 탄수). 이미 쓰던 무기를 또 먹어도 탄이 새로 찬다.
   * 황금 잠수함은 기본 공격이 아이템 무기보다 세서 바꾸지 않고, 대신 연사 강화를 받는다
   */
  setWeapon(type) {
    if (!WEAPON_DEF[type]) return;
    if (this.ship === HIDDEN_SHIP) { this.rapid = Math.max(this.rapid, RAPID_TICKS); return; }
    this.weapon = type;
    this.ammo = WEAPON_AMMO[type] ?? 40;
  }

  /**
   * 어뢰는 한 줄(쌍둥이면 두 줄)씩 나가고 화면에 두 번(쌍둥이 네 발)까지만 있을 수 있다.
   * 확산탄은 한 번에 세 발이라 그만큼 늘어난다. 쏜 '묶음' 수(기체 수)를 돌려준다
   */
  tryFire() {
    const def = WEAPON_DEF[this.weapon];
    const ships = this.twin ? 2 : 1;
    const per = def.shots * ships;
    const rounds = this.rapid > 0 ? (def.rapidRounds ?? 8) : (def.rounds ?? 2);               // 연사 중에는 줄줄이 이어 나간다
    if (this.shots.length + per > per * (rounds + this.reload)) return 0;
    for (let i = 0; i < ships; i++) {
      const x = this.x + i * TWIN_GAP;
      if (def.plain) {                                  // 기본 공격: 곧장 위로 (기체마다 줄 수·관통이 다르다)
        for (const ox of def.offsets ?? [0]) this.shots.push(this.plainShot(def, x + ox));
        continue;
      }
      for (const a of def.angles) {
        const ang = -Math.PI / 2 + a, sp = def.speed + this.velo * VELO_STEP;
        this.shots.push({
          x, y: PLAYER_Y - 8, kind: this.weapon, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          pierce: !!def.pierce, homing: !!def.homing, blast: !!def.blast, hit: new Set(),
          ...(def.life ? { life: def.life, w: def.w0 } : {}),
        });
      }
    }
    return ships;
  }

  /** 기본 공격 한 발. 어뢰는 {x, y} 만, 다른 기체의 공격은 종류·속도 배율·관통 정보가 더 붙는다 */
  plainShot(def, x) {
    const s = { x, y: PLAYER_Y - 8 };
    if (!def.kind) return s;
    Object.assign(s, { kind: def.kind, k: def.k ?? 1, w: def.w });
    if (def.pierce) Object.assign(s, { pierce: true, maxHit: def.maxHit, hit: new Set() });
    return s;
  }

  /** 유도탄: 앞쪽에서 가장 가까운 목표 쪽으로 조금씩 방향을 튼다 */
  steer(s, targets) {
    let best = null, bestD = Infinity;
    for (const t of targets) {
      if (t.y > s.y + 4) continue;
      const d = (t.x - s.x) ** 2 + (t.y - s.y) ** 2;
      if (d < bestD) { best = t; bestD = d; }
    }
    if (!best) return;
    const sp = Math.hypot(s.vx, s.vy);
    let diff = Math.atan2(best.y - s.y, best.x - s.x) - Math.atan2(s.vy, s.vx);
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const ang = Math.atan2(s.vy, s.vx) + Math.max(-TURN, Math.min(TURN, diff));
    s.vx = Math.cos(ang) * sp;
    s.vy = Math.sin(ang) * sp;
  }

  /** 날아가는 어뢰를 한 틱 움직인다 (클리어·사망 연출 중에도 허공에 멈추지 않게 따로 부른다) */
  moveShots(targets = []) {
    for (const s of this.shots) {
      if (s.vy === undefined) { s.y -= this.shotSpeed * (s.k ?? 1); continue; }
      if (s.homing) this.steer(s, targets);
      s.x += s.vx;
      s.y += s.vy;
      if (s.life !== undefined) {                       // 음파 링: 날아가며 넓어지다 사라진다
        s.life--;
        s.w = Math.min(SONIC_MAX_W, s.w + 0.35);
        if (s.life <= 0) s.dead = true;
      }
    }
    this.shots = this.shots.filter((s) => s.y > -8 && s.x > -8 && s.x < W + 8 && !s.dead);
  }

  /** 한 틱. canFire 가 false 면 움직이기만 한다. targets 는 유도탄이 노릴 {x, y} 목록. 쏜 수를 돌려준다 */
  step(canFire = true, targets = []) {
    const speed = this.speed;
    if (this.move) this.x += this.move * speed;
    else if (this.target !== null) {
      const dx = this.target - this.x;
      this.x += Math.max(-speed * 1.8, Math.min(speed * 1.8, dx));
    }
    this.x = Math.max(8, Math.min(this.maxX, this.x));
    if (this.invuln > 0 && --this.invuln === 0) this.quiet = false;
    if (this.rapid > 0) this.rapid--;
    this.moveShots(targets);
    if (this.cooldown > 0) this.cooldown--;
    if (canFire && this.firing && this.cooldown <= 0) {
      const n = this.tryFire();
      if (n) {
        if (this.ammo > 0 && --this.ammo === 0) this.weapon = this.base;         // 마지막 탄을 쐈으면 기본 공격으로
        const cd = Math.max(MIN_COOLDOWN, WEAPON_DEF[this.weapon].cooldown - this.reload);
        this.cooldown = this.rapid > 0 ? Math.max(RAPID_COOLDOWN, cd - 3) : cd;
        return n;
      }
    }
    return 0;
  }
}
