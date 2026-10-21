import { W, H } from './paths.js';
import { TAU, overlap, boxAt } from './geom.js';
import { Formation } from './formation.js';
import { Enemy, KINDS, inBeam } from './enemy.js';
import { createBoss } from './bosses.js';
import { Player, PLAYER_Y, TWIN_GAP, RAPID_TICKS, UPGRADE_MAX } from './player.js';
import { buildStage, isBonus, isBoss, bonusKind, pickBonusPlan, BONUS_FISH, BONUS_TARGETS, BONUS_WHALE_HP, BONUS_PEARLS } from './stage.js';
import { WEAPONS, UPGRADES, WEAPON_DEF, pickItem, pickWeapon } from './weapons.js';
import { SHIPS, SHIP_ORDER, DEFAULT_SHIP, isShip } from './ships.js';
import { SPECIALS } from './specials.js';
import { addRecord, cleanName, qualifies } from '../app/records.js';

export const TICRATE = 60;
/** 시작 잠수함 수 */
export const LIVES = 3;
/** 추가 잠수함을 주는 점수: 처음 한 번, 그 뒤로는 이만큼씩 */
const FIRST_EXTRA = 30000;
const NEXT_EXTRA = 100000;
const PERFECT_BONUS = 10000;
/** 황금 고래를 한 번 맞힐 때 받는 점수 */
const WHALE_HIT_SCORE = 50;
/** 진주 하나의 점수와 진주가 떠다니는 시간 */
const PEARL_SCORE = 100;
const PEARL_LIFE = 420;
const PEARL_GAP = 26;
/** 엔딩: 이 스테이지의 보스를 쓰러뜨리면 끝난다 */
export const FINAL_STAGE = 20;
/** 이 스테이지부터 적 탄이 빨라지고 동시 급강하가 하나 늘어난다. FINAL_PUSH_FROM 부터는 한 번 더 */
export const LATE_FROM = 8;
const LATE_BULLET = 1.2;
export const FINAL_PUSH_FROM = 15;
const FINAL_PUSH_BULLET = 1.1;
/** 이 스테이지부터 급강하하는 적이 세 발씩 쏜다 (그 전에는 3 스테이지부터 두 발) */
const TRIPLE_SHOT_FROM = 12;
/** 엔딩에서 남은 잠수함 한 대마다 주는 점수 */
const CLEAR_BONUS_PER_LIFE = 10000;
/** 엔딩이 나온 뒤 이만큼 지나야 키로 넘길 수 있다 */
export const ENDING_SKIP = 2 * TICRATE;
const BOSS_SCORE = 5000;
/** 콤보: 이 시간(1.5초) 안에 또 잡으면 이어지고, COMBO_STEP 마리마다 배율이 0.5 씩 올라 COMBO_MAX 배까지 */
export const COMBO_TICKS = 90;
const COMBO_STEP = 10;
const COMBO_MAX = 3;
/** 필살기: 폭탄을 하나 써서 기체의 필살기(specials.js)를 일으킨다. 시작 폭탄 수는 기체마다 다르다 (노랑 3 · 다트 2 · 해머 4) */
export const START_BOMBS = SHIPS[DEFAULT_SHIP].bombs;
export const MAX_BOMBS = 6;
const MAX_BULLETS_BOSS = 48;
const MAX_MINIONS = 6;
/** 기체 고르기 화면이 나온 뒤 이만큼 지나야 키로 출발한다 (타이틀을 넘긴 입력이 그대로 출발이 되지 않게) */
export const SELECT_LOCK = 15;
/** 게임 오버 결과 화면이 나온 뒤 이만큼 지나야 키로 다시 시작한다 (연타하다 결과를 못 보는 일을 막는다) */
export const OVER_LOCK = TICRATE;
/** 잠수함을 잃고 곧바로 되살아난 뒤 맞지 않는 시간 (3초, 깜빡인다) */
const RESPAWN_INVULN = 3 * TICRATE;
/** 잠수함이 터지는 연출 시간 (이 동안 세상은 계속 움직인다) */
const DYING_TICKS = 50;

/** 아이템을 품고 나오는 적의 비율 */
const ITEM_DROP = 0.12;

/** 아이템: 적을 잡으면 가끔 떨어진다. rapid 연사 강화 · shield 방어막(한 번 막기) · charge 해일 게이지 +40 */
export const ITEM_TYPES = ['rapid', 'shield', 'charge'];
/** 아이템은 화면 안을 튕겨 다니다가 ITEM_LIFE 틱 뒤에 사라진다 (마지막 2초는 깜빡) */
const ITEM_VX = 1.5;
const ITEM_VY = 1.2;
export const ITEM_LIFE = 600;
export const ITEM_BLINK = 120;
const ITEM_MIN_Y = 40;
/** 폭발 어뢰가 터지는 반경 */
const BLAST_RADIUS = 18;
/** 영구 강화를 이미 최대로 올렸을 때 아이템을 먹으면 받는 점수 */
const MAXED_UPGRADE_SCORE = 1000;
/** 돌진 급강하가 나오기 시작하는 스테이지 */
const DASH_FROM = 4;
/** 편대 급강하(같은 종류 두세 마리가 함께 내려온다)가 나오기 시작하는 스테이지 */
const SQUAD_FROM = 6;

/** pool 에서 e 와 가장 가까운 kind 종류 n 마리 (대열에 있는 것만) */
const nearestMates = (e, pool, kind, n) => pool
  .filter((m) => m !== e && m.kind === kind && m.state === 'formation')
  .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
  .slice(0, n);

/**
 * 게임 규칙 전체. 화면·키보드를 모르므로 node 에서 그대로 테스트할 수 있다.
 * phase: title → select → ready → play → (dying | captured → ready | over) / (clear | bonusResult → ready)
 *        마지막 보스(FINAL_STAGE)를 쓰러뜨리면 clear → ending → over
 * lives 는 지금 타는 잠수함까지 센 숫자다 (화면에는 lives - 1 개를 예비로 보여 준다)
 * 점수판은 하나다 (records). over 에서 점수판에 오를 점수면 naming 이 켜져 이름을 받는다
 */
export class Game {
  /** bonusPlan: 보너스 스테이지 계획을 고정한다 (테스트용). 없으면 판마다 난수로 뽑는다 */
  constructor({ rng = Math.random, bonusPlan = null } = {}) {
    this.rng = rng;
    this.ship = DEFAULT_SHIP;      // 타이틀·결과 화면에서 고른 기체. 새 게임이 시작될 때 적용된다
    this.fixedPlan = bonusPlan;
    this.player = new Player();
    this.formation = new Formation();
    this.phase = 'title';
    this.hiScore = 0;           // 지금 모드의 최고 점수
    this.frame = 0;
    this.paused = false;
    this.records = [];             // 내 기록 (main 이 저장소에서 읽어 채운다)
    this.naming = false;
    this.rank = null;
    this.events = [];           // 효과음용 이벤트 이름. main 이 매 프레임 비운다
    this.shakeT = 0; this.shakeMax = 1; this.shakeMag = 0;
    this.flashT = 0; this.flashMax = 1;
    this.newGame();
    this.phase = 'title';
  }

  /** 타이틀·게임 오버 화면 (새 판을 시작하는 상태) */
  get idle() { return this.phase === 'title' || this.phase === 'over'; }
  /** 이번 판 명중률 (0~100) */
  get hitRatio() {
    const { shots, hits } = this.stats;
    return shots ? Math.min(100, Math.round(hits / shots * 100)) : 0;
  }
  syncHi() { this.hiScore = this.records[0]?.score || 0; }

  emit(name) { if (this.events.length < 64) this.events.push(name); }
  /** 화면 번쩍임: t 틱 동안 하얗게 덮였다가 사라진다 (필살기) */
  flash(t) { this.flashT = this.flashMax = t; }
  /** 화면 흔들림: mag 픽셀로 t 틱 동안 점점 잦아든다 */
  shake(mag, t) { this.shakeMag = mag; this.shakeT = this.shakeMax = t; }

  newGame() {
    this.paused = false;
    this.score = 0;
    this.lives = LIVES;
    this.stage = 1;
    this.extraAt = FIRST_EXTRA;
    this.player.setShip(this.ship);
    this.bombs = this.startBombs;
    this.combo = 0;
    this.comboT = 0;
    this.bonusPlan = this.fixedPlan ?? pickBonusPlan(this.rng);   // 이번 판의 보너스 스테이지 { 스테이지: 패턴 }
    this.stats = { shots: 0, hits: 0, bosses: 0 };
    this.lastRecord = null;     // 게임 오버·엔딩 때 한 번 만들어지는 기록 (이름을 받아 submitName 으로 점수판에 넣는다)
    this.rank = null;
    this.naming = false;
    this.cleared = false;
    this.ending = null;
    this.player.reset();
    this.startStage();
  }

  startStage() {
    this.boss = isBoss(this.stage) ? createBoss(this.stage) : null;
    this.bonusKind = bonusKind(this.stage, this.bonusPlan);
    this.enemies = this.boss ? [] : buildStage(this.stage, this.rng, this.bonusPlan);
    this.assignItems(this.enemies);
    this.wave = null;
    this.items = [];
    this.shakeT = 0;
    this.flashT = 0;
    this.combo = 0;
    this.comboT = 0;
    if (this.boss) this.emit('warning');
    this.bonus = isBonus(this.stage, this.bonusPlan);
    this.pearlsLeft = this.bonusKind === 'pearl' ? BONUS_PEARLS : 0;       // 아직 흘려보내지 않은 진주
    this.pearlCd = 30;
    this.formation = new Formation();
    this.bullets = [];
    this.popups = [];
    this.fx = [];
    this.rescue = null;
    this.capture = null;
    this.result = null;
    this.bonusKills = 0;
    this.playTime = 0;
    this.diveTimer = 90;
    this.player.reset(true);
    this.phase = 'ready';
    this.timer = 2 * TICRATE;
  }

  /**
   * title 에서 키를 누르면 기체 고르기(select) 화면으로, select 에서는 고른 기체로 새 게임, over 에서는 바로 새 게임.
   * 엔딩에서는 결과 화면으로. 이름을 쓰는 중에는 아무 일도 없다
   */
  start() {
    if (this.naming) return;
    if (this.phase === 'ending') { if (this.timer >= ENDING_SKIP) this.enterResults(); return; }
    if (this.phase === 'over' && this.timer < OVER_LOCK) return;
    if (this.phase === 'title') { this.phase = 'select'; this.timer = 0; this.emit('select'); return; }
    if (this.phase === 'select' && this.timer < SELECT_LOCK) return;     // 타이틀을 넘긴 그 입력이 곧바로 출발로 이어지지 않게
    if (this.idle || this.phase === 'select') this.newGame();
  }

  setMove(dir) { this.player.setMove(dir); }
  setFire(on) { this.player.setFire(on); }
  moveTo(x) { this.player.moveTo(x); }

  /** 일시정지는 타이틀·기체 고르기·게임 오버 화면에서는 의미가 없다 */
  get canPause() { return !this.idle && this.phase !== 'select' && this.phase !== 'ending'; }
  pause() { if (this.canPause) this.paused = true; }
  resume() { this.paused = false; }
  togglePause() { if (this.paused) this.resume(); else this.pause(); }

  /** 이 기체의 필살기 이름 (wave · storm · carpet) */
  get special() { return SHIPS[this.ship].special; }
  /** 이 기체가 처음(새 게임·잠수함을 잃은 뒤)에 갖는 폭탄 수 */
  get startBombs() { return SHIPS[this.ship].bombs; }

  /** 기체를 고를 수 있는 때: 기체 고르기 화면, 그리고 게임 오버 결과 화면(이름을 쓰는 중은 제외) */
  get canPick() { return this.phase === 'select' || (this.phase === 'over' && !this.naming); }

  /** 기체를 한 칸 넘긴다 (dir: 1 다음 · -1 이전) */
  selectShip(dir) {
    if (!this.canPick) return false;
    const n = SHIP_ORDER.length;
    return this.pickShip(SHIP_ORDER[(SHIP_ORDER.indexOf(this.ship) + dir + n) % n]);
  }

  /** 기체를 직접 고른다 (카드를 눌렀을 때). 고를 수 없거나 알 수 없는 이름이면 false */
  pickShip(id) {
    if (!this.canPick || !isShip(id)) return false;
    if (id !== this.ship) { this.ship = id; this.emit('select'); }
    return true;
  }

  /** 저장된 기체 이름으로 처음 상태를 맞춘다 (알 수 없는 이름은 무시) */
  chooseShip(id) {
    if (isShip(id)) this.ship = id;
  }

  /** 지금 필살기를 쓸 수 있나 (폭탄이 있어야 하고, 보너스 스테이지에서는 못 쓴다) */
  get ultReady() { return this.phase === 'play' && !this.paused && !this.bonus && !this.wave && this.bombs > 0; }

  ult() {
    if (!this.ultReady) return false;
    this.bombs--;
    this.wave = SPECIALS[this.special].start(this);
    this.emit({ wave: 'ult', storm: 'storm', carpet: 'carpet' }[this.special]);
    this.shake(2.5, 40);
    this.flash(this.special === 'wave' ? 14 : 8);
    return true;
  }

  addBomb(n = 1) { this.bombs = Math.min(MAX_BOMBS, this.bombs + n); }

  /** 지금 콤보 배율 (1 ~ COMBO_MAX) */
  get comboMult() { return Math.min(COMBO_MAX, 1 + Math.floor(this.combo / COMBO_STEP) * 0.5); }

  get diveSpeed() { return Math.min(1.7 + 0.09 * (this.stage - 1), 3.0); }
  get late() { return this.stage >= LATE_FROM; }
  get finalPush() { return this.stage >= FINAL_PUSH_FROM; }
  /** 적 탄 속도 배율 (후반일수록 빨라진다) */
  get bulletMul() { return (this.late ? LATE_BULLET : 1) * (this.finalPush ? FINAL_PUSH_BULLET : 1); }
  /** 지금 틀어야 할 배경 음악 이름 (소리는 모르고 이름만 알려 준다). 타이틀·클리어·결과 화면은 조용하다 */
  get music() {
    if (this.phase === 'ending') return 'ending';
    if (['title', 'select', 'over', 'clear', 'bonusResult'].includes(this.phase)) return null;
    return this.boss ? 'boss' : this.bonus ? 'bonus' : 'stage';
  }
  get maxDivers() { return Math.max(1, Math.min(2 + (this.stage >> 1), 6) + (this.late ? 1 : 0) + (this.finalPush ? 1 : 0)); }
  get diveInterval() { return Math.max(34, 130 - 7 * (this.stage - 1)); }
  get maxBullets() { return 4 + Math.min(this.stage, 9); }

  addScore(n) {
    this.score += n;
    if (this.score > this.hiScore) this.hiScore = this.score;
    while (this.score >= this.extraAt) {
      this.lives++;
      this.extraAt = this.extraAt === FIRST_EXTRA ? NEXT_EXTRA : this.extraAt + NEXT_EXTRA;
      this.emit('life');
    }
  }

  popup(x, y, text, key) { this.popups.push({ x, y, text, key, timer: 60 }); }
  boom(x, y, kind = 'enemy') {
    this.fx.push({ x, y, t: 0, max: kind === 'player' ? 50 : 22, kind });
    this.emit(kind === 'player' ? 'dead' : 'boom');
  }

  tick() {
    if (this.paused) return;
    this.frame++;
    switch (this.phase) {
      case 'ready':
        this.coast();                            // 스테이지가 시작되기 전에도 움직일 수 있고 아이템도 먹는다
        if (--this.timer <= 0) this.phase = 'play';
        break;
      case 'play': this.play(); break;
      case 'dying':
        this.moveWorld();
        this.player.moveShots();
        if (--this.timer <= 0) this.loseShip();
        break;
      case 'captured': this.capturedTick(); break;
      case 'clear':
        this.coast();                            // 스테이지를 깬 뒤에도 움직이고 아이템을 먹는다
        if (--this.timer <= 0) {
          if (this.stage === FINAL_STAGE) this.allClear();
          else { this.stage++; this.startStage(); }
        }
        break;
      case 'ending': this.timer++; break;
      case 'over': this.timer++; break;
      case 'select': this.timer++; break;
      case 'bonusResult':
        this.coast();
        if (--this.timer <= 0) { this.stage++; this.startStage(); }
        break;
      default: break;
    }
  }

  /** 싸움이 없는 구간(준비·클리어·보너스 결과): 세상은 흐르고 잠수함은 움직이며 아이템을 먹는다 */
  coast() {
    this.moveWorld();
    this.player.step(false);
    this.collectItems();
  }

  makeEnv() {
    return {
      slot: (r, c) => this.formation.slot(r, c),
      playTime: this.playTime,
      diveSpeed: this.diveSpeed,
      shotsPerDive: this.stage >= TRIPLE_SHOT_FROM ? 3 : this.stage >= 3 ? 2 : 1,
      fire: (e) => this.enemyFire(e),
      targetX: this.player.x,
      shoot: (x, y, a, s) => {
        if (this.bullets.length >= MAX_BULLETS_BOSS) return;
        const v = s * this.bulletMul;
        this.bullets.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
      },
      minion: (x, y, kind) => this.spawnMinion(x, y, kind),
      rand: () => this.rng(),
    };
  }

  /** 보스가 풀어 놓는 졸개(해파리나 폭탄 복어): 곧바로 플레이어를 향해 급강하한다 */
  spawnMinion(x, y, kind = 'bee') {
    if (this.enemies.length >= MAX_MINIONS) return;
    const m = new Enemy({ kind, slotless: true });
    m.x = x; m.y = y;
    this.assignItems([m]);
    m.beginDive(this.makeEnv(), this.player.x, this.rng() < 0.5 ? -1 : 1);
    this.enemies.push(m);
  }

  /** 대열·적·탄·효과를 한 틱 움직인다 (충돌은 play 에서만) */
  moveWorld() {
    this.formation.update();
    const env = this.makeEnv();
    for (const e of this.enemies) e.step(env);
    for (const b of this.bullets) { b.x += b.vx; b.y += b.vy; }
    this.bullets = this.bullets.filter((b) => b.y < H + 8 && b.y > -16 && b.x > -8 && b.x < W + 8);
    for (const p of this.popups) p.timer--;
    this.popups = this.popups.filter((p) => p.timer > 0);
    for (const f of this.fx) f.t++;
    this.fx = this.fx.filter((f) => f.t < f.max);
    for (const it of this.items) {
      it.x += it.vx; it.y += it.vy; it.t++;
      if (it.x < 8 || it.x > W - 8) { it.x = Math.max(8, Math.min(W - 8, it.x)); it.vx = -it.vx; }
      if (it.y < ITEM_MIN_Y || it.y > H - 8) { it.y = Math.max(ITEM_MIN_Y, Math.min(H - 8, it.y)); it.vy = -it.vy; }
    }
    this.items = this.items.filter((it) => it.t < (it.life ?? ITEM_LIFE) && !it.taken);
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashT > 0) this.flashT--;
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');
  }

  play() {
    const { player } = this;
    this.playTime++;
    if (this.comboT > 0 && --this.comboT === 0) this.combo = 0;
    const fired = player.step(true, this.homingTargets());
    if (fired) { this.stats.shots += fired * WEAPON_DEF[player.weapon].shots; this.emit('shot'); }   // 확산탄은 알갱이 하나하나를 센다
    this.moveWorld();
    this.collectItems();
    if (this.bonusKind === 'pearl') this.spawnPearl();
    if (this.boss) this.boss.step(this.makeEnv());

    if (!this.bonus && !this.boss) {
      const entered = !this.enemies.some((e) => e.state === 'wait' || e.state === 'enter');
      if (entered) this.formation.breathing = true;
      if (entered && --this.diveTimer <= 0) {
        this.diveTimer = Math.round(this.diveInterval * (0.7 + 0.6 * this.rng()));
        this.launch();
      }
    }

    this.shotsVsEnemies();
    this.waveStep();
    if (!this.bonus) {
      this.beamCheck();
      if (this.phase !== 'play') return;
      this.bulletsVsPlayer();
      this.bodiesVsPlayer();
      if (this.phase !== 'play') return;
    }
    this.rescueStep();
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');

    const cleared = this.boss ? this.boss.dead : this.bonus ? this.bonusOver : this.enemies.length === 0;
    if (cleared) {
      this.bullets = [];
      this.wave = null;
      if (this.rescue) { this.dock(); }
      if (this.bonus) this.finishBonus();
      else { this.phase = 'clear'; this.timer = 2 * TICRATE; this.emit('clear'); }
    }
  }

  /** 일부 적은 아이템을 품고 나온다 . 미리 정해 두어 화면에서 반짝이게 하고, 잡으면 반드시 떨어뜨린다. 보너스 물고기는 제외 */
  assignItems(list) {
    for (const e of list) {
      if (e.bonus || this.rng() >= ITEM_DROP) continue;
      e.carries = pickItem(this.rng, this.stage);
    }
  }

  /** 유도탄이 노릴 수 있는 것들 (유도탄이 날아가고 있을 때만 모은다) */
  homingTargets() {
    if (!this.player.shots.some((s) => s.homing)) return [];
    const out = this.enemies.filter((e) => e.hittable);
    if (this.boss && this.boss.targetable) out.push(this.boss);
    return out;
  }

  dropItem(x, y, type) {
    this.items.push({ x, y, type, vx: x < W / 2 ? ITEM_VX : -ITEM_VX, vy: ITEM_VY, t: 0 });   // 가까운 벽의 반대쪽(화면 안쪽)으로 먼저 흐른다
  }

  /** 진주 줍기 보너스: 일정한 간격으로 위에서 진주를 하나씩 흘려보낸다 */
  spawnPearl() {
    if (this.pearlsLeft <= 0 || --this.pearlCd > 0) return;
    this.pearlCd = PEARL_GAP;
    this.pearlsLeft--;
    this.items.push({ x: 20 + this.rng() * (W - 40), y: ITEM_MIN_Y, type: 'pearl', vx: (this.rng() < 0.5 ? -1 : 1) * 1.3, vy: 1.1, t: 0, life: PEARL_LIFE });
  }

  /** 보너스 스테이지가 끝났나: 적이 다 사라지고 진주도 다 흘러간 뒤 */
  get bonusOver() {
    return this.enemies.length === 0 && this.pearlsLeft <= 0 && !this.items.some((it) => it.type === 'pearl');
  }

  /** 이 보너스 패턴에서 채울 수 있는 만큼 (물고기 수 · 표적 수 · 고래 체력 · 진주 수) */
  get bonusTotal() {
    return { vortex: BONUS_FISH, target: BONUS_TARGETS, whale: BONUS_WHALE_HP, pearl: BONUS_PEARLS }[this.bonusKind] ?? BONUS_FISH;
  }

  /** 잠수함에 닿은 아이템을 먹는다 */
  collectItems() {
    const pr = this.player.rect();
    for (const it of this.items) {
      if (it.taken || !overlap(boxAt(it.x, it.y, 5, 5), pr)) continue;
      it.taken = true;
      if (it.type === 'pearl') {                                   // 보너스 진주: 줍기만 하면 된다
        this.bonusKills++;
        this.addScore(PEARL_SCORE);
        this.popup(it.x, it.y - 8, String(PEARL_SCORE));
        this.emit('pickup');
        continue;
      }
      if (it.type === 'rapid') this.player.rapid = RAPID_TICKS;
      else if (it.type === 'shield') this.player.shield = true;
      else if (WEAPONS.includes(it.type)) this.player.setWeapon(it.type);
      else if (UPGRADES.includes(it.type)) {
        if (this.player[it.type] < UPGRADE_MAX) this.player[it.type]++;
        else this.addScore(MAXED_UPGRADE_SCORE);
      }
      else this.addBomb(1);
      this.popup(it.x, it.y - 8, '', `item.${it.type}`);
      this.emit('pickup');
    }
    this.items = this.items.filter((it) => !it.taken);
  }

  /** 필살기(대해일·어뢰 폭풍·심해 폭격)가 한 틱 진행된다 */
  waveStep() {
    const w = this.wave;
    if (w && SPECIALS[w.kind].step(this, w)) this.wave = null;
  }

  /** 크라켄이 n 만큼 맞는다. 쓰러지면 점수·게이지 보상, 풀어 놓은 해파리와 탄은 사라진다 */
  damageBoss(n) {
    const b = this.boss;
    if (!b.targetable) return;                      // 쓰러지는 중인 보스는 더 맞지 않는다
    const before = b.phase;
    if (!b.damage(n)) {
      if (b.phase > before) {                       // 사나워질 때마다 이 스테이지에 나오는 무기를 하나 떨어뜨린다
        const weapon = pickWeapon(this.rng, this.stage);
        if (weapon) this.dropItem(b.x, b.y + 24, weapon);
      }
      this.emit('bosshit');
      return;
    }
    this.emit('bossdown');
    this.shake(6, 50);
    const pts = BOSS_SCORE * b.level;
    this.addScore(pts);
    this.popup(b.x, b.y, String(pts));
    this.stats.bosses++;
    this.addBomb(1);                                  // 보스를 쓰러뜨리면 폭탄 하나
    this.bullets = [];
    for (const e of this.enemies) { this.boom(e.x, e.y); e.state = 'gone'; }
    for (let i = 0; i < 8; i++) this.fx.push({ x: b.x + (this.rng() - 0.5) * 56, y: b.y + (this.rng() - 0.5) * 36, t: -i * 8, max: 22, kind: 'enemy' });
  }

  finishBonus() {
    const total = this.bonusTotal;
    const perfect = this.bonusKills >= total;
    const bonus = perfect ? PERFECT_BONUS : 0;
    this.addScore(bonus);
    this.result = { hits: this.bonusKills, total, perfect, bonus, kind: this.bonusKind };
    this.emit(perfect ? 'perfect' : 'clear');
    this.phase = 'bonusResult';
    this.timer = 4 * TICRATE;
  }

  /** 소용돌이로 잠수함을 납치할 수 있나: 예비 잠수함이 있고, 쌍둥이가 아니고, 이미 납치 중이 아닐 때 */
  canCapture() {
    return !this.bonus && !this.boss && this.lives >= 2 && !this.player.twin && !this.capture && !this.rescue
      && !this.enemies.some((e) => e.carrying || e.state === 'beamMove' || e.state === 'beam' || e.state === 'hold');
  }

  launch() {
    const divers = this.enemies.filter((e) => e.diving).length;
    if (divers >= this.maxDivers) return;
    const pool = this.enemies.filter((e) => e.state === 'formation' && !e.slotless);
    if (!pool.length) return;
    const e = pool[Math.floor(this.rng() * pool.length)];
    const d = this.rng() < 0.5 ? -1 : 1;
    const tx = Math.max(30, Math.min(W - 30, this.player.x));
    if (e.kind === 'boss' && this.canCapture() && this.rng() < 0.6) { e.beginBeam(tx, d); return; }
    const env = this.makeEnv();
    if (e.kind === 'eel') { e.beginSweep(tx); return; }
    if (e.kind === 'ray') { e.beginZigzag(env, tx, d); return; }
    if (e.kind === 'turtle') { e.beginHeavy(env, tx, d); return; }
    const plain = e.kind === 'bee' || e.kind === 'butterfly';
    if (plain && this.stage >= DASH_FROM && this.rng() < Math.min(0.5, (this.stage - DASH_FROM + 1) * 0.1)) { e.beginDash(tx); return; }
    e.beginDive(env, tx, d);
    if (plain) { this.maybeSquadron(e, pool, env, tx, d); return; }
    if (e.kind !== 'boss') return;
    e.group = e.id;
    nearestMates(e, pool, 'butterfly', 2).forEach((m, i) => { m.group = e.id; m.beginDive(env, tx + (i ? 14 : -14), d); });
  }

  /** 편대 급강하: 같은 종류 가까운 두 마리(10 스테이지부터 네 마리)가 함께 내려온다 */
  maybeSquadron(e, pool, env, tx, d) {
    if (this.stage < SQUAD_FROM || this.rng() >= Math.min(0.35, (this.stage - SQUAD_FROM + 1) * 0.07)) return;
    nearestMates(e, pool, e.kind, this.stage >= 10 ? 4 : 2)
      .forEach((m, i) => m.beginDive(env, tx + (i % 2 ? 1 : -1) * (8 + 6 * (i >> 1)), d));
  }

  enemyFire(e) {
    if (this.bullets.length >= this.maxBullets) return;
    const dx = this.player.x - e.x, dy = PLAYER_Y - e.y;
    if (dy < 20) return;
    let ang = Math.atan2(dy, dx) + (this.rng() - 0.5) * 0.3;
    ang = Math.max(Math.PI * 0.25, Math.min(Math.PI * 0.75, ang));
    const sp = Math.min(1.5 + 0.09 * this.stage, 3.0) * this.bulletMul;
    for (const o of e.kind === 'ray' ? [-0.35, 0, 0.35] : [0]) {
      this.bullets.push({ x: e.x, y: e.y + 6, vx: Math.cos(ang + o) * sp, vy: Math.sin(ang + o) * sp });
    }
  }

  shotsVsEnemies() {
    const { player } = this;
    for (const s of player.shots) {
      const sb = boxAt(s.x, s.y, s.w ?? 1.5, s.kind === 'laser' ? 9 : 4);
      if (s.pierce) { this.pierceShot(s, sb); continue; }
      const e = this.enemies.find((en) => en.hittable && overlap(sb, en.rect()));
      if (e) {
        s.dead = true; this.countHit(s); this.hitEnemy(e);
        if (s.blast) this.explode(s.x, s.y, e, false);
        continue;
      }
      const b = this.boss;
      if (b && b.targetable && overlap(sb, b.rect())) {
        s.dead = true; this.countHit(s); this.damageBoss(1);
        if (s.blast) this.explode(s.x, s.y, null, true);
        continue;
      }
      const c = this.enemies.find((en) => en.carrying && overlap(sb, boxAt(en.x, en.y - 12, 6, 6)));
      if (c) { s.dead = true; this.loseCaptive(c); }   // 납치된 잠수함을 직접 쏘면 잃는다
    }
    player.shots = player.shots.filter((s) => !s.dead);
  }

  /** 레이저: 겹친 적을 모두 맞히되 한 발이 같은 적(보스 포함)은 한 번만. 탄은 사라지지 않는다 */
  pierceShot(s, sb) {
    for (const e of [...this.enemies]) {
      if (!e.hittable || s.hit.has(e.id) || !overlap(sb, e.rect())) continue;
      s.hit.add(e.id);
      this.countHit(s);
      this.hitEnemy(e);
    }
    const b = this.boss;
    if (b && b.targetable && !s.hit.has(b) && overlap(sb, b.rect())) {
      s.hit.add(b);
      this.countHit(s);
      this.damageBoss(1);
    }
    if (s.maxHit && s.hit.size >= s.maxHit) s.dead = true;      // 관통 어뢰는 정해진 수만큼 꿰뚫으면 사라진다
  }

  /** 폭발 어뢰가 터진다: 반경 안의 적(맞은 적 first 는 빼고)을 모두 맞히고, 보스는 직접 맞지 않았으면 한 번만 맞는다 */
  explode(x, y, first, bossHit) {
    const area = boxAt(x, y, BLAST_RADIUS, BLAST_RADIUS);
    this.boom(x, y);
    for (const e of [...this.enemies]) {
      if (e === first || !e.hittable || !overlap(area, e.rect())) continue;
      this.hitEnemy(e);
    }
    const b = this.boss;
    if (!bossHit && b && b.targetable && overlap(area, b.rect())) this.damageBoss(1);
  }

  /** 쏜 한 발은 몇 명을 맞혀도 명중 한 번으로만 센다 (관통·폭발이 명중률을 부풀리지 않게) */
  countHit(s) {
    if (s.counted) return;
    s.counted = true;
    this.stats.hits++;
  }

  hitEnemy(e) {
    if (e.kind === 'whale') {                                  // 황금 고래는 맞을 때마다 점수
      this.bonusKills++;
      this.addScore(WHALE_HIT_SCORE);
      e.flash = 5;
      this.emit('bosshit');
    }
    if (--e.hp > 0) return;
    this.kill(e);
  }

  /** byWave: 해일로 잡은 경우 (게이지는 차지 않는다) */
  kill(e, byWave = false) {
    const info = KINDS[e.kind];
    const diving = e.diving;
    let pts = diving ? info.dive : info.score;
    if (e.kind === 'boss' && diving && e.group) {
      const mates = this.enemies.filter((m) => m !== e && m.group === e.group && m.diving).length;
      if (mates === 1) pts = 800; else if (mates >= 2) pts = 1600;
    }
    if (e.kind === 'fish') this.bonusKills++;
    if (!this.bonus) {                                                                // 보너스 스테이지는 점수가 정해져 있어 콤보를 쓰지 않는다
      this.combo++;
      this.comboT = COMBO_TICKS;
      if (this.combo % COMBO_STEP === 0) this.emit('combo');
      pts = Math.round(pts * this.comboMult);
    }
    this.addScore(pts);
    this.popup(e.x, e.y, String(pts));
    this.boom(e.x, e.y);
    if (e.carries) this.dropItem(e.x, e.y, e.carries);
    if (e.kind === 'mine' && !this.bonus) {                                           // 폭탄 복어는 터지며 사방으로 탄을 흩뿌린다
      const env = this.makeEnv();
      for (let i = 0; i < 8; i++) env.shoot(e.x, e.y, i * TAU / 8 + 0.2, 1.3);
    }
    if (e.carrying) this.freeCaptive(e, diving);
    e.state = 'gone';
  }

  /** 납치한 문어가 잡혔다: 급강하 중에 잡아야 구출하고, 대열에서 잡으면 잃는다 (원작 방식) */
  freeCaptive(e, diving) {
    e.carrying = false;
    if (diving) this.rescue = { x: e.x, y: e.y - 12, a: 0 };
    else this.boom(e.x, e.y - 12);
  }

  /** 납치된 잠수함을 잃는다 (직접 맞았거나 납치범이 들이받혔다) */
  loseCaptive(e) {
    e.carrying = false;
    this.boom(e.x, e.y - 12);
  }

  beamCheck() {
    const { player } = this;
    if (this.capture || this.wave) return;
    for (const e of this.enemies) {
      if (inBeam(e, player.x, PLAYER_Y)) {
        this.capture = { boss: e, t: 0, sx: player.x, sy: PLAYER_Y, x: player.x, y: PLAYER_Y, a: 0 };
        e.state = 'hold';
        this.phase = 'captured';
        this.emit('capture');
        this.bullets = [];
        return;
      }
    }
  }

  capturedTick() {
    const c = this.capture;
    this.moveWorld();
    c.t++;
    const k = Math.min(1, c.t / 100);
    c.x = c.sx + (c.boss.x - c.sx) * k;
    c.y = c.sy + (c.boss.y + 12 - c.sy) * k;
    c.a = c.t * 0.25;
    if (c.t === 100) { c.boss.carrying = true; c.boss.beamLen = 0; c.boss.state = 'toSlot'; }
    if (c.t >= 150) { this.capture = null; this.loseShip(); }
  }

  bulletsVsPlayer() {
    const { player } = this;
    if (player.invuln > 0) return;
    const pr = player.rect();
    const i = this.bullets.findIndex((b) => overlap(boxAt(b.x, b.y, 1.5, 3), pr));
    if (i >= 0) { this.bullets.splice(i, 1); this.hitPlayer(); }
  }

  bodiesVsPlayer() {
    const { player } = this;
    if (player.invuln > 0) return;
    const pr = player.rect();
    if (this.boss && this.boss.contact(pr)) { this.hitPlayer(); return; }                  // 아귀의 돌진처럼 몸으로 들이받는 보스
    const e = this.enemies.find((en) => en.hittable && overlap(en.rect(), pr));
    if (e) { this.boom(e.x, e.y); e.carrying = false; e.state = 'gone'; this.hitPlayer(); }   // 부딪힌 납치범은 잠수함째 사라진다
  }

  /** 방어막이 있으면 한 번 막고, 쌍둥이면 한 대만 잃고 계속, 한 대뿐이면 폭발 */
  hitPlayer() {
    const { player } = this;
    if (player.shield) {
      player.shield = false;
      player.invuln = 30;                           // 방어막은 깨지는 즉시 사라지고, 깜빡임 없이 잠깐만 맞지 않는다
      player.quiet = true;
      this.emit('shield');
      this.shake(2, 10);
      return;
    }
    if (player.twin) {
      player.twin = false;
      player.invuln = 120;
      this.boom(player.x + TWIN_GAP, PLAYER_Y, 'player');
      this.shake(3, 14);
      return;
    }
    this.boom(player.x, PLAYER_Y, 'player');
    this.shake(4, 24);
    this.phase = 'dying';
    this.timer = DYING_TICKS;
    this.clearField();
  }

  /** 잠수함이 죽거나 잡혔을 때: 탄과 구출 중인 잠수함을 치우고, 출격 중인 적은 대열로 돌려보낸다 */
  clearField() {
    this.bullets = [];
    this.rescue = null;
    for (const e of this.enemies) e.recall();
  }

  /** 잠수함 하나를 잃었다: 남아 있으면 다시 준비, 아니면 끝 */
  loseShip() {
    this.lives--;
    this.combo = 0;
    this.comboT = 0;
    this.bombs = this.startBombs;                   // 잠수함을 잃으면 폭탄은 이 기체의 처음 개수로 돌아간다
    this.clearField();
    if (this.lives <= 0) { this.finish(); return; }
    this.player.reset(false);
    this.player.invuln = RESPAWN_INVULN;              // 멈추지 않고 곧바로 이어서, 3초 동안 맞지 않는다
    this.phase = 'play';
  }

  /** 이번 판 기록을 만들어 둔다. 점수판에는 이름을 받은 뒤 submitName 이 넣는다 */
  buildRecord(cleared) {
    this.lastRecord = {
      score: this.score, stage: this.stage, ratio: this.hitRatio,
      bosses: this.stats.bosses, cleared, ship: this.ship,
    };
  }

  /** 결과 화면. 점수판에 오를 점수면 이름을 받는다 */
  enterResults() {
    this.phase = 'over';
    this.timer = 0;
    this.naming = qualifies(this.records, this.score);
  }

  /** 게임 오버 */
  finish() {
    this.buildRecord(false);
    this.enterResults();
    this.emit('gameover');
  }

  /** 마지막 보스를 쓰러뜨렸다: 남은 잠수함 보너스를 준다 */
  allClear() {
    const bonus = this.lives * CLEAR_BONUS_PER_LIFE;
    this.addScore(bonus);
    this.cleared = true;
    this.ending = { bonus };
    this.buildRecord(true);
    this.phase = 'ending';
    this.timer = 0;
    this.emit('ending');
  }

  /** 이름을 받아 이번 기록을 점수판에 올린다. date 는 main 이 넘긴다. 올렸으면 true */
  submitName(name, date = '') {
    if (!this.naming || !this.lastRecord) return false;
    const rec = { ...this.lastRecord, name: cleanName(name), date };
    const { list, rank } = addRecord(this.records, rec);
    this.records = list;
    this.rank = rank;
    this.lastRecord = rec;
    this.naming = false;
    return true;
  }

  /** 구출한 잠수함이 옆으로 내려와 붙는 동안 */
  rescueStep() {
    const r = this.rescue;
    if (!r) return;
    const { player } = this;
    const tx = player.x + TWIN_GAP, dx = tx - r.x, dy = PLAYER_Y - r.y, dist = Math.hypot(dx, dy);
    r.a += 0.2;
    if (dist < 3) { this.dock(); return; }
    r.x += dx / dist * 2.2;
    r.y += dy / dist * 2.2;
  }

  dock() {
    this.rescue = null;
    this.player.twin = true;
    this.player.x = Math.min(this.player.x, this.player.maxX);
    this.popup(this.player.x + TWIN_GAP / 2, PLAYER_Y - 14, '', 'msg.twin');
    this.emit('rescue');
  }
}
