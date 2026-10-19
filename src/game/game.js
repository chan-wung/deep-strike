import { W, H } from './paths.js';
import { Formation } from './formation.js';
import { Enemy, KINDS, inBeam } from './enemy.js';
import { Player, PLAYER_Y, TWIN_GAP } from './player.js';
import { buildStage, isBonus, BONUS_FISH } from './stage.js';

export const TICRATE = 60;
const START_LIVES = 3;
const PERFECT_BONUS = 10000;

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
    this.newGame();
    this.phase = 'title';
  }

  newGame() {
    this.paused = false;
    this.score = 0;
    this.lives = START_LIVES;
    this.stage = 1;
    this.extraAt = 20000;
    this.stats = { shots: 0, hits: 0 };
    this.player.reset();
    this.startStage();
  }

  startStage() {
    this.enemies = buildStage(this.stage);
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

  get diveSpeed() { return Math.min(1.7 + 0.08 * (this.stage - 1), 2.8); }
  get maxDivers() { return Math.min(2 + (this.stage >> 1), 6); }
  get diveInterval() { return Math.max(40, 130 - 7 * (this.stage - 1)); }
  get maxBullets() { return 4 + Math.min(this.stage, 6); }

  addScore(n) {
    this.score += n;
    if (this.score > this.hiScore) this.hiScore = this.score;
    while (this.score >= this.extraAt) {
      this.lives++;
      this.extraAt = this.extraAt === 20000 ? 70000 : this.extraAt + 70000;
    }
  }

  popup(x, y, text, key) { this.popups.push({ x, y, text, key, timer: 60 }); }
  boom(x, y, kind = 'enemy') { this.fx.push({ x, y, t: 0, max: kind === 'player' ? 50 : 22, kind }); }

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
    };
  }

  /** 대열·적·탄·효과를 한 틱 움직인다 (충돌은 play 에서만) */
  moveWorld() {
    this.formation.update();
    const env = this.makeEnv();
    for (const e of this.enemies) e.step(env);
    for (const b of this.bullets) { b.x += b.vx; b.y += b.vy; }
    this.bullets = this.bullets.filter((b) => b.y < H + 8 && b.x > -8 && b.x < W + 8);
    for (const p of this.popups) p.timer--;
    this.popups = this.popups.filter((p) => p.timer > 0);
    for (const f of this.fx) f.t++;
    this.fx = this.fx.filter((f) => f.t < f.max);
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');
  }

  play() {
    const { player } = this;
    this.playTime++;
    this.stats.shots += player.step(true);
    this.moveWorld();

    if (!this.bonus) {
      const entered = !this.enemies.some((e) => e.state === 'wait' || e.state === 'enter');
      if (entered) this.formation.breathing = true;
      if (entered && --this.diveTimer <= 0) {
        this.diveTimer = Math.round(this.diveInterval * (0.7 + 0.6 * this.rng()));
        this.launch();
      }
    }

    this.shotsVsEnemies();
    if (!this.bonus) {
      this.beamCheck();
      if (this.phase !== 'play') return;
      this.bulletsVsPlayer();
      this.bodiesVsPlayer();
      if (this.phase !== 'play') return;
    }
    this.rescueStep();
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');

    if (this.enemies.length === 0) {
      this.bullets = [];
      if (this.rescue) { this.dock(); }
      if (this.bonus) this.finishBonus();
      else { this.phase = 'clear'; this.timer = 2 * TICRATE; }
    }
  }

  finishBonus() {
    const perfect = this.bonusKills >= BONUS_FISH;
    const bonus = perfect ? PERFECT_BONUS : 0;
    this.addScore(bonus);
    this.result = { hits: this.bonusKills, total: BONUS_FISH, perfect, bonus };
    this.phase = 'bonusResult';
    this.timer = 4 * TICRATE;
  }

  /** 소용돌이로 잠수함을 납치할 수 있나: 예비 잠수함이 있고, 쌍둥이가 아니고, 이미 납치 중이 아닐 때 */
  canCapture() {
    return !this.bonus && this.lives >= 2 && !this.player.twin && !this.capture && !this.rescue
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
    e.beginDive(env, tx, d);
    if (e.kind !== 'boss') return;
    e.group = e.id;
    const mates = pool.filter((m) => m !== e && m.kind === 'butterfly')
      .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
      .slice(0, 2);
    mates.forEach((m, i) => { m.group = e.id; m.beginDive(env, tx + (i ? 14 : -14), d); });
  }

  enemyFire(e) {
    if (this.bullets.length >= this.maxBullets) return;
    const dx = this.player.x - e.x, dy = PLAYER_Y - e.y;
    if (dy < 20) return;
    let ang = Math.atan2(dy, dx) + (this.rng() - 0.5) * 0.3;
    ang = Math.max(Math.PI * 0.25, Math.min(Math.PI * 0.75, ang));
    const sp = Math.min(1.5 + 0.08 * this.stage, 2.8);
    this.bullets.push({ x: e.x, y: e.y + 6, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
  }

  shotsVsEnemies() {
    const { player } = this;
    for (const s of player.shots) {
      const sb = boxAt(s.x, s.y, 1.5, 4);
      const e = this.enemies.find((en) => en.hittable && overlap(sb, en.rect()));
      if (e) { s.dead = true; this.stats.hits++; this.hitEnemy(e); continue; }
      const c = this.enemies.find((en) => en.carrying && overlap(sb, boxAt(en.x, en.y - 12, 6, 6)));
      if (c) { s.dead = true; c.carrying = false; this.boom(c.x, c.y - 12); }   // 납치된 잠수함을 직접 쏘면 잃는다
    }
    player.shots = player.shots.filter((s) => !s.dead);
  }

  hitEnemy(e) {
    if (--e.hp > 0) return;
    this.kill(e);
  }

  kill(e) {
    const info = KINDS[e.kind];
    const diving = e.diving;
    let pts = diving ? info.dive : info.score;
    if (e.kind === 'boss' && diving && e.group) {
      const mates = this.enemies.filter((m) => m !== e && m.group === e.group && m.diving).length;
      if (mates === 1) pts = 800; else if (mates >= 2) pts = 1600;
    }
    if (e.kind === 'fish') this.bonusKills++;
    this.addScore(pts);
    this.popup(e.x, e.y, String(pts));
    this.boom(e.x, e.y);
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
    if (this.capture) return;
    for (const e of this.enemies) {
      if (inBeam(e, player.x, PLAYER_Y)) {
        this.capture = { boss: e, t: 0, sx: player.x, sy: PLAYER_Y, x: player.x, y: PLAYER_Y, a: 0 };
        e.state = 'hold';
        this.phase = 'captured';
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
    const e = this.enemies.find((en) => en.hittable && overlap(en.rect(), pr));
    if (e) { this.boom(e.x, e.y); e.carrying = false; e.state = 'gone'; this.hitPlayer(); }
  }

  /** 쌍둥이면 한 대만 잃고 계속, 한 대뿐이면 폭발 */
  hitPlayer() {
    const { player } = this;
    if (player.twin) {
      player.twin = false;
      player.invuln = 120;
      this.boom(player.x + TWIN_GAP, PLAYER_Y, 'player');
      return;
    }
    this.boom(player.x, PLAYER_Y, 'player');
    this.phase = 'dying';
    this.timer = 90;
    this.bullets = [];
    this.rescue = null;
    for (const e of this.enemies) e.recall();
  }

  /** 잠수함 하나를 잃었다: 남아 있으면 다시 준비, 아니면 끝 */
  loseShip() {
    this.lives--;
    this.bullets = [];
    this.rescue = null;
    for (const e of this.enemies) e.recall();
    if (this.lives <= 0) { this.phase = 'over'; return; }
    this.player.reset(false);
    this.phase = 'ready';
    this.readyKind = 'ready';
    this.timer = 2 * TICRATE;
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
  }
}
