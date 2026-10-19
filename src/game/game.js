import { W, H } from './paths.js';
import { Formation } from './formation.js';
import { Enemy, KINDS, inBeam } from './enemy.js';
import { createBoss } from './bosses.js';
import { Player, PLAYER_Y, TWIN_GAP, RAPID_TICKS } from './player.js';
import { buildStage, isBonus, isBoss, BONUS_FISH } from './stage.js';

export const TICRATE = 60;
const START_LIVES = 3;
const PERFECT_BONUS = 10000;
const BOSS_SCORE = 5000;
/** 필살기(해일): 게이지가 가득 차면 쓴다. 바닥에서 위로 쓸어 올라가며 탄을 지우고 적에게 피해를 준다 */
export const ULT_MAX = 100;
const WAVE_SPEED = 6;
const WAVE_DAMAGE = 1;
const WAVE_BOSS_DAMAGE = 10;
/** 해일 기둥의 반폭: 쓴 순간 잠수함 위치를 중심으로 이만큼 좌우만 훑는다 (전체 폭 약 70px) */
export const WAVE_HALF_W = 35;
const MAX_BULLETS_BOSS = 48;
const MAX_MINIONS = 6;

/** 난이도: lives 시작 잠수함 수 · bullet 적 탄 속도 배율 · interval 급강하 간격 배율 · divers 동시 급강하 수 가감 · drop 아이템 확률 · bossHp 크라켄 체력 배율 */
export const DIFFICULTIES = {
  easy: { lives: 4, bullet: 0.85, interval: 1.3, divers: -1, drop: 0.18, bossHp: 0.8 },
  normal: { lives: START_LIVES, bullet: 1, interval: 1, divers: 0, drop: 0.12, bossHp: 1 },
  hard: { lives: START_LIVES, bullet: 1.2, interval: 0.75, divers: 1, drop: 0.08, bossHp: 1.3 },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

/** 아이템: 적을 잡으면 가끔 떨어진다. rapid 연사 강화 · shield 방어막(한 번 막기) · charge 해일 게이지 +40 */
export const ITEM_TYPES = ['rapid', 'shield', 'charge'];
const ITEM_FALL = 1.1;
const CHARGE_AMOUNT = 40;
/** 돌진 급강하가 나오기 시작하는 스테이지 */
const DASH_FROM = 4;
/** 편대 급강하(같은 종류 두세 마리가 함께 내려온다)가 나오기 시작하는 스테이지 */
const SQUAD_FROM = 6;
const TAU = Math.PI * 2;

const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const boxAt = (x, y, hw, hh) => ({ x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh });

/**
 * 게임 규칙 전체. 화면·키보드를 모르므로 node 에서 그대로 테스트할 수 있다.
 * phase: title → ready → play → (dying | captured → ready | over) / (clear | bonusResult → ready)
 * lives 는 지금 타는 잠수함까지 센 숫자다 (화면에는 lives - 1 개를 예비로 보여 준다)
 */
export class Game {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.player = new Player();
    this.formation = new Formation();
    this.phase = 'title';
    this.hiScore = 0;
    this.frame = 0;
    this.paused = false;
    this.records = [];          // 내 기록 (main 이 저장소에서 읽어 채운다)
    this.rank = null;
    this.difficulty = 'normal';
    this.events = [];           // 효과음용 이벤트 이름. main 이 매 프레임 비운다
    this.shakeT = 0; this.shakeMax = 1; this.shakeMag = 0;
    this.newGame();
    this.phase = 'title';
  }

  get cfg() { return DIFFICULTIES[this.difficulty]; }

  /** 타이틀·게임 오버 화면에서만 바꾼다. 다음 새 게임부터 적용 */
  setDifficulty(name) {
    if (DIFFICULTIES[name] && (this.phase === 'title' || this.phase === 'over')) this.difficulty = name;
  }
  cycleDifficulty(step = 1) {
    const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
    this.setDifficulty(DIFFICULTY_ORDER[(i + step + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length]);
  }

  emit(name) { if (this.events.length < 64) this.events.push(name); }
  /** 화면 흔들림: mag 픽셀로 t 틱 동안 점점 잦아든다 */
  shake(mag, t) { this.shakeMag = mag; this.shakeT = this.shakeMax = t; }

  newGame() {
    this.paused = false;
    this.score = 0;
    this.lives = this.cfg.lives;
    this.stage = 1;
    this.extraAt = 20000;
    this.gauge = 0;
    this.stats = { shots: 0, hits: 0, bosses: 0 };
    this.lastRecord = null;     // 게임 오버 때 한 번 만들어지는 기록 (main 이 저장한다)
    this.rank = null;
    this.player.reset();
    this.startStage();
  }

  startStage() {
    this.boss = isBoss(this.stage) ? createBoss(this.stage, this.cfg.bossHp) : null;
    this.enemies = this.boss ? [] : buildStage(this.stage);
    this.assignItems(this.enemies);
    this.wave = null;
    this.items = [];
    this.shakeT = 0;
    if (this.boss) this.emit('warning');
    this.bonus = isBonus(this.stage);
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
    this.readyKind = 'stage';
    this.timer = 2 * TICRATE;
  }

  /** title / over 에서 키를 누르면 새 게임 */
  start() {
    if (this.phase === 'title' || this.phase === 'over') this.newGame();
  }

  setMove(dir) { this.player.setMove(dir); }
  setFire(on) { this.player.setFire(on); }
  moveTo(x) { this.player.moveTo(x); }

  /** 일시정지는 타이틀·게임 오버 화면에서는 의미가 없다 */
  get canPause() { return this.phase !== 'title' && this.phase !== 'over'; }
  pause() { if (this.canPause) this.paused = true; }
  resume() { this.paused = false; }
  togglePause() { if (this.paused) this.resume(); else this.pause(); }

  get gaugeFull() { return this.gauge >= ULT_MAX; }
  /** 지금 필살기를 쓸 수 있나 (보너스 스테이지에서는 못 쓴다) */
  get ultReady() { return this.phase === 'play' && !this.paused && !this.bonus && !this.wave && this.gaugeFull; }

  ult() {
    if (!this.ultReady) return false;
    this.gauge = 0;
    const { player } = this;
    this.wave = { x: player.x + (player.twin ? TWIN_GAP / 2 : 0), y: H + 10, hit: new Set(), boss: false };
    this.emit('ult');
    this.shake(2.5, 40);
    return true;
  }

  addGauge(n) { this.gauge = Math.min(ULT_MAX, this.gauge + n); }

  get diveSpeed() { return Math.min(1.7 + 0.08 * (this.stage - 1), 2.8); }
  get maxDivers() { return Math.max(1, Math.min(2 + (this.stage >> 1), 6) + this.cfg.divers); }
  get diveInterval() { return Math.max(40, 130 - 7 * (this.stage - 1)) * this.cfg.interval; }
  get maxBullets() { return 4 + Math.min(this.stage, 6); }

  addScore(n) {
    this.score += n;
    if (this.score > this.hiScore) this.hiScore = this.score;
    while (this.score >= this.extraAt) {
      this.lives++;
      this.extraAt = this.extraAt === 20000 ? 70000 : this.extraAt + 70000;
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
        this.moveWorld();
        this.player.step(false);
        if (--this.timer <= 0) this.phase = 'play';
        break;
      case 'play': this.play(); break;
      case 'dying':
        this.moveWorld();
        if (--this.timer <= 0) this.loseShip();
        break;
      case 'captured': this.capturedTick(); break;
      case 'clear':
        this.moveWorld();
        if (--this.timer <= 0) { this.stage++; this.startStage(); }
        break;
      case 'bonusResult':
        this.moveWorld();
        if (--this.timer <= 0) { this.stage++; this.startStage(); }
        break;
      default: break;
    }
  }

  makeEnv() {
    return {
      slot: (r, c) => this.formation.slot(r, c),
      playTime: this.playTime,
      diveSpeed: this.diveSpeed,
      shotsPerDive: this.stage >= 3 ? 2 : 1,
      fire: (e) => this.enemyFire(e),
      targetX: this.player.x,
      shoot: (x, y, a, s) => {
        if (this.bullets.length >= MAX_BULLETS_BOSS) return;
        const v = s * this.cfg.bullet;
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
    if (kind === 'mine') m.shotsLeft = 0;
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
    for (const it of this.items) it.y += ITEM_FALL;
    this.items = this.items.filter((it) => it.y < H + 8 && !it.taken);
    if (this.shakeT > 0) this.shakeT--;
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');
  }

  play() {
    const { player } = this;
    this.playTime++;
    const fired = player.step(true);
    if (fired) { this.stats.shots += fired; this.emit('shot'); }
    this.moveWorld();
    this.collectItems();
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

    const cleared = this.boss ? this.boss.dead : this.enemies.length === 0;
    if (cleared) {
      this.bullets = [];
      this.wave = null;
      if (this.rescue) { this.dock(); }
      if (this.bonus) this.finishBonus();
      else { this.phase = 'clear'; this.timer = 2 * TICRATE; this.emit('clear'); }
    }
  }

  /** 일부 적은 아이템을 품고 나온다 (난이도별 확률). 미리 정해 두어 화면에서 반짝이게 하고, 잡으면 반드시 떨어뜨린다. 보너스 물고기는 제외 */
  assignItems(list) {
    for (const e of list) {
      if (e.kind === 'fish' || this.rng() >= this.cfg.drop) continue;
      e.carries = ITEM_TYPES[Math.floor(this.rng() * ITEM_TYPES.length)];
    }
  }

  dropItem(x, y, type) {
    this.items.push({ x, y, type });
  }

  /** 잠수함에 닿은 아이템을 먹는다 */
  collectItems() {
    const pr = this.player.rect();
    for (const it of this.items) {
      if (it.taken || !overlap(boxAt(it.x, it.y, 5, 5), pr)) continue;
      it.taken = true;
      if (it.type === 'rapid') this.player.rapid = RAPID_TICKS;
      else if (it.type === 'shield') this.player.shield = true;
      else this.addGauge(CHARGE_AMOUNT);
      this.popup(it.x, it.y - 8, '', `item.${it.type}`);
      this.emit('pickup');
    }
    this.items = this.items.filter((it) => !it.taken);
  }

  /** 필살기 해일이 한 틱 올라간다 */
  waveStep() {
    const w = this.wave;
    if (!w) return;
    w.y -= WAVE_SPEED;
    this.player.invuln = Math.max(this.player.invuln, 2);        // 해일이 지나는 동안은 맞지 않는다
    const inColumn = (x, pad = 0) => Math.abs(x - w.x) <= WAVE_HALF_W + pad;
    this.bullets = this.bullets.filter((b) => b.y < w.y || !inColumn(b.x));   // 기둥 안에서 해일 아래에 잠긴 탄만 지워진다
    for (const e of this.enemies) {
      if (!e.hittable || w.hit.has(e.id) || e.y < w.y || !inColumn(e.x, 6)) continue;
      w.hit.add(e.id);
      e.hp -= WAVE_DAMAGE;
      if (e.hp <= 0) this.kill(e, true); else this.boom(e.x, e.y);
    }
    const b = this.boss;
    if (b && !w.boss && b.y + 24 >= w.y && inColumn(b.x, 30)) {
      w.boss = true;
      this.damageBoss(WAVE_BOSS_DAMAGE);
    }
    if (w.y < -20) this.wave = null;
  }

  /** 크라켄이 n 만큼 맞는다. 쓰러지면 점수·게이지 보상, 풀어 놓은 해파리와 탄은 사라진다 */
  damageBoss(n) {
    const b = this.boss;
    if (!b.damage(n)) { this.emit('bosshit'); return; }
    this.emit('bossdown');
    this.shake(6, 50);
    const pts = BOSS_SCORE * b.level;
    this.addScore(pts);
    this.popup(b.x, b.y, String(pts));
    this.stats.bosses++;
    this.gauge = ULT_MAX;
    this.bullets = [];
    for (const e of this.enemies) { this.boom(e.x, e.y); e.state = 'gone'; }
    for (let i = 0; i < 8; i++) this.fx.push({ x: b.x + (this.rng() - 0.5) * 56, y: b.y + (this.rng() - 0.5) * 36, t: -i * 8, max: 22, kind: 'enemy' });
  }

  finishBonus() {
    const perfect = this.bonusKills >= BONUS_FISH;
    const bonus = perfect ? PERFECT_BONUS : 0;
    this.addScore(bonus);
    this.result = { hits: this.bonusKills, total: BONUS_FISH, perfect, bonus };
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
    if (e.kind === 'mine') { e.beginDive(env, tx, d); e.shotsLeft = 0; return; }
    const plain = e.kind === 'bee' || e.kind === 'butterfly';
    if (plain && this.stage >= DASH_FROM && this.rng() < Math.min(0.5, (this.stage - DASH_FROM + 1) * 0.1)) { e.beginDash(tx); return; }
    e.beginDive(env, tx, d);
    if (plain) { this.maybeSquadron(e, pool, env, tx, d); return; }
    if (e.kind !== 'boss') return;
    e.group = e.id;
    const mates = pool.filter((m) => m !== e && m.kind === 'butterfly')
      .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
      .slice(0, 2);
    mates.forEach((m, i) => { m.group = e.id; m.beginDive(env, tx + (i ? 14 : -14), d); });
  }

  /** 편대 급강하: 같은 종류 가까운 두 마리(10 스테이지부터 네 마리)가 함께 내려온다 */
  maybeSquadron(e, pool, env, tx, d) {
    if (this.stage < SQUAD_FROM || this.rng() >= Math.min(0.35, (this.stage - SQUAD_FROM + 1) * 0.07)) return;
    const mates = pool.filter((m) => m !== e && m.kind === e.kind && m.state === 'formation')
      .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
      .slice(0, this.stage >= 10 ? 4 : 2);
    mates.forEach((m, i) => m.beginDive(env, tx + (i % 2 ? 1 : -1) * (8 + 6 * (i >> 1)), d));
  }

  enemyFire(e) {
    if (this.bullets.length >= this.maxBullets) return;
    const dx = this.player.x - e.x, dy = PLAYER_Y - e.y;
    if (dy < 20) return;
    let ang = Math.atan2(dy, dx) + (this.rng() - 0.5) * 0.3;
    ang = Math.max(Math.PI * 0.25, Math.min(Math.PI * 0.75, ang));
    const sp = Math.min(1.5 + 0.08 * this.stage, 2.8) * this.cfg.bullet;
    for (const o of e.kind === 'ray' ? [-0.35, 0, 0.35] : [0]) {
      this.bullets.push({ x: e.x, y: e.y + 6, vx: Math.cos(ang + o) * sp, vy: Math.sin(ang + o) * sp });
    }
  }

  shotsVsEnemies() {
    const { player } = this;
    for (const s of player.shots) {
      const sb = boxAt(s.x, s.y, 1.5, 4);
      const e = this.enemies.find((en) => en.hittable && overlap(sb, en.rect()));
      if (e) { s.dead = true; this.stats.hits++; this.hitEnemy(e); continue; }
      const b = this.boss;
      if (b && b.targetable && overlap(sb, b.rect())) { s.dead = true; this.stats.hits++; this.addGauge(1); this.damageBoss(1); continue; }
      const c = this.enemies.find((en) => en.carrying && overlap(sb, boxAt(en.x, en.y - 12, 6, 6)));
      if (c) { s.dead = true; c.carrying = false; this.boom(c.x, c.y - 12); }   // 납치된 잠수함을 직접 쏘면 잃는다
    }
    player.shots = player.shots.filter((s) => !s.dead);
  }

  hitEnemy(e) {
    if (--e.hp > 0) return;
    this.kill(e);
  }

  /** byWave: 해일로 잡은 경우 (게이지는 차지 않는다) */
  kill(e, byWave = false) {
    const info = KINDS[e.kind];
    const diving = e.diving;
    if (!byWave) this.addGauge(info.gauge * (diving ? 2 : 1));
    let pts = diving ? info.dive : info.score;
    if (e.kind === 'boss' && diving && e.group) {
      const mates = this.enemies.filter((m) => m !== e && m.group === e.group && m.diving).length;
      if (mates === 1) pts = 800; else if (mates >= 2) pts = 1600;
    }
    if (e.kind === 'fish') this.bonusKills++;
    this.addScore(pts);
    this.popup(e.x, e.y, String(pts));
    this.boom(e.x, e.y);
    if (e.carries) this.dropItem(e.x, e.y, e.carries);
    if (e.kind === 'mine' && !this.bonus) {                                           // 폭탄 복어는 터지며 사방으로 탄을 흩뿌린다
      const env = this.makeEnv();
      for (let i = 0; i < 8; i++) env.shoot(e.x, e.y, i * TAU / 8 + 0.2, 1.3);
    }
    if (e.carrying) {
      e.carrying = false;
      if (diving) this.rescue = { x: e.x, y: e.y - 12, a: 0 };
      else this.spawnHostileShip(e);
    }
    e.state = 'gone';
  }

  /** 대열에 있는 문어를 잡으면 납치된 잠수함은 구해지지 않고 적이 되어 덤벼든다 */
  spawnHostileShip(boss) {
    const s = new Enemy({ kind: 'ship', slotless: true });
    s.x = boss.x; s.y = boss.y - 12;
    s.beginDive(this.makeEnv(), this.player.x, this.rng() < 0.5 ? -1 : 1);
    this.enemies.push(s);
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
    if (e) { this.boom(e.x, e.y); e.carrying = false; e.state = 'gone'; this.hitPlayer(); }
  }

  /** 방어막이 있으면 한 번 막고, 쌍둥이면 한 대만 잃고 계속, 한 대뿐이면 폭발 */
  hitPlayer() {
    const { player } = this;
    if (player.shield) {
      player.shield = false;
      player.invuln = 90;
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
    this.timer = 90;
    this.bullets = [];
    this.rescue = null;
    for (const e of this.enemies) e.recall();
  }

  /** 잠수함 하나를 잃었다: 남아 있으면 다시 준비, 아니면 끝 */
  loseShip() {
    this.lives--;
    this.gauge = 0;                                   // 잠수함을 잃으면 모은 게이지도 잃는다
    this.bullets = [];
    this.rescue = null;
    for (const e of this.enemies) e.recall();
    if (this.lives <= 0) { this.finish(); return; }
    this.player.reset(false);
    this.phase = 'ready';
    this.readyKind = 'ready';
    this.timer = 2 * TICRATE;
  }

  /** 게임 오버: 이번 판 기록을 만들어 둔다 (저장은 main 이 한다) */
  finish() {
    this.phase = 'over';
    const { shots, hits, bosses } = this.stats;
    this.lastRecord = { score: this.score, stage: this.stage, ratio: shots ? Math.round(hits / shots * 100) : 0, bosses, diff: this.difficulty };
    this.emit('gameover');
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
