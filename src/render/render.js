import { W, H } from '../game/paths.js';
import { PLAYER_Y, TWIN_GAP } from '../game/player.js';
import { BEAM_HALF0, BEAM_SLOPE } from '../game/enemy.js';
import { ULT_MAX, WAVE_HALF_W, ENDING_SKIP } from '../game/game.js';
import { WEAPON_TICKS } from '../game/weapons.js';
import { TAU } from '../game/geom.js';
import { t } from '../app/i18n.js';

/** 논리 좌표(224×288)를 canvas 에 그릴 때 곱하는 배율 */
const S = 2;

const COLOR = {
  sub: '#ffd23f',
  subDark: '#c98f00',
  glass: '#bfefff',
  captive: '#ff5a5a',
  captiveDark: '#992222',
  jelly: '#ff7aa8',
  puffer: '#ffb347',
  boss: '#9b5cff',
  bossHit: '#35d0ba',
  ink: '#ff6b6b',
  text: '#ffffff',
  accent: '#ffd23f',
  tide: '#35d0ff',
};
/** 보스별 단계 색 (체력 막대와 몸 색) */
const BOSS_COLOR = {
  kraken: ['#7a3dd8', '#d6489b', '#e5484d'],
  angler: ['#2f6fb0', '#3d9bd6', '#7fe0ff'],
  manta: ['#2fae8f', '#e0a526', '#e5484d'],
};

export function canvasSize() {
  return { width: W * S, height: H * S };
}

export const FONT = '"Neo둥근모", "Press Start 2P", "Malgun Gothic", monospace';
const text = (ctx, s, x, y, size, color, align = 'left') => {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
};
/** 어두운 그림자를 깔고 쓴다 */
const shadowText = (ctx, s, x, y, size, color, align = 'center') => {
  text(ctx, s, x + 1, y + 1, size, 'rgba(0,0,0,.7)', align);
  text(ctx, s, x, y, size, color, align);
};

const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** 스테이지가 오를수록 깊은 바다: 밝은 청록에서 어두운 심해로. 보스 스테이지는 붉게 물든다 */
function drawBackground(ctx, game) {
  const { frame } = game;
  const d = Math.min(1, (game.stage - 1) / 9);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb(mix([14, 110, 150], [8, 10, 36], d)));
  g.addColorStop(1, rgb(mix([4, 40, 70], [1, 3, 14], d)));
  ctx.fillStyle = g;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  for (let i = 0; i < 3; i++) {                       // 위에서 비치는 햇빛 줄기 (깊을수록 희미)
    const x = 40 + i * 70 + Math.sin(frame * 0.01 + i * 2) * 14;
    ctx.fillStyle = `rgba(190,240,255,${0.055 * (1 - d)})`;
    ctx.beginPath();
    ctx.moveTo(x - 6, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 50, H); ctx.lineTo(x - 30, H);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(255,255,255,${0.22 - d * 0.1})`;   // 올라가는 거품: 프레임만으로 위치가 정해진다
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 30; i++) {
    const sp = 0.2 + ((i * 37) % 10) * 0.05;
    const x = (i * 53) % W + Math.sin(frame * 0.02 + i) * 5;
    const y = H - ((frame * sp + i * 41) % (H + 12));
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, TAU);
    ctx.stroke();
  }

  if (d > 0.3) {                                      // 깊은 곳의 발광 플랑크톤
    for (let i = 0; i < 18; i++) {
      const x = (i * 71) % W + Math.sin(frame * 0.012 + i) * 10;
      const y = H - ((frame * 0.12 * (1 + (i % 3)) + i * 29) % H);
      const a = (d - 0.3) * 1.1 * (0.5 + 0.5 * Math.sin(frame * 0.05 + i));
      ctx.fillStyle = `hsla(${170 + (i * 23) % 120} 90% 62% / ${a})`;
      ctx.beginPath(); ctx.arc(x, y, 1.4, 0, TAU); ctx.fill();
    }
  }

  if (game.boss) {
    ctx.fillStyle = `rgba(150,10,40,${0.12 + 0.05 * Math.sin(frame * 0.06)})`;
    ctx.fillRect(-12, -12, W + 24, H + 24);
  }
}

export function drawSub(ctx, x, y, body = COLOR.sub, dark = COLOR.subDark, frame = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = dark;                               // 프로펠러
  ctx.fillRect(-10, -2 + Math.sin(frame * 0.5) * 1.2, 2.5, 4);
  ctx.fillStyle = body;                               // 선체와 사령탑
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 7.5, 4.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(-2.5, -5, 5, 5);
  ctx.fillRect(-0.7, -8, 1.4, 4);                     // 어뢰가 나가는 관
  ctx.fillStyle = COLOR.glass;
  ctx.beginPath(); ctx.arc(-2.5, 1.5, 1.4, 0, TAU); ctx.arc(2, 1.5, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
}

function eyes(ctx, dx, y, r = 1.6) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-dx, y, r, 0, TAU); ctx.arc(dx, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#102030';
  ctx.beginPath(); ctx.arc(-dx, y + 0.3, r * 0.5, 0, TAU); ctx.arc(dx, y + 0.3, r * 0.5, 0, TAU); ctx.fill();
}

function drawJelly(ctx, frame) {
  ctx.fillStyle = COLOR.jelly;
  ctx.beginPath(); ctx.arc(0, -1, 6, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COLOR.jelly;
  ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2.4, -1);
    ctx.quadraticCurveTo(i * 2.4 + Math.sin(frame * 0.2 + i) * 2, 3, i * 2.4 + Math.sin(frame * 0.2 + i + 1) * 2.5, 7);
    ctx.stroke();
  }
  eyes(ctx, 2.4, -3, 1.3);
}

function drawPuffer(ctx, frame) {
  const puff = 1 + Math.sin(frame * 0.12) * 0.06;
  ctx.fillStyle = COLOR.puffer;
  ctx.beginPath(); ctx.arc(0, 0, 5.6 * puff, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffe3a8';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {                       // 가시
    const a = i * TAU / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 5.4, Math.sin(a) * 5.4);
    ctx.lineTo(Math.cos(a) * 7.6 * puff, Math.sin(a) * 7.6 * puff);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffe3a8';
  ctx.beginPath(); ctx.ellipse(0, 2.5, 3.5, 2, 0, 0, TAU); ctx.fill();
  eyes(ctx, 2.4, -1.5, 1.5);
}

function drawOctopus(ctx, frame, hit, color) {
  const c = color ?? (hit ? COLOR.bossHit : COLOR.boss);
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) {                     // 다리
    ctx.beginPath();
    ctx.moveTo(i * 1.8, 2);
    ctx.quadraticCurveTo(i * 2.3 + Math.sin(frame * 0.18 + i) * 2.5, 6, i * 2.6 + Math.sin(frame * 0.18 + i + 1) * 3, 9);
    ctx.stroke();
  }
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.ellipse(0, -1.5, 7, 6.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.beginPath(); ctx.ellipse(-2.5, -5, 2.4, 1.2, -0.4, 0, TAU); ctx.fill();
  eyes(ctx, 2.8, -1.5, 1.8);
}

/** 전기뱀장어: 구불구불한 몸에 전기 불꽃 */
function drawEel(ctx, e, frame) {
  ctx.strokeStyle = '#c8ff3d';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const y = -9 + i * 2.2, x = Math.sin(frame * 0.25 + i * 0.7 + e.id) * 3;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#e8ff7a';
  ctx.beginPath(); ctx.arc(Math.sin(frame * 0.25 + 5.6 + e.id) * 3, 8.5, 3, 0, TAU); ctx.fill();
  eyes(ctx, 1.2, 8, 0.9);
  if ((frame + e.id) % 14 < 5) {                                       // 지직
    ctx.strokeStyle = '#fffbb0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -4); ctx.lineTo(-2, -1); ctx.lineTo(-5, 2); ctx.lineTo(-2, 5);
    ctx.moveTo(5, -2); ctx.lineTo(2, 1); ctx.lineTo(5, 4);
    ctx.stroke();
  }
}

/** 가오리: 펄럭이는 마름모 날개 */
function drawRay(ctx, e, frame) {
  const flap = Math.sin(frame * 0.2 + e.id) * 3;
  ctx.fillStyle = '#8e7bff';
  ctx.beginPath();
  ctx.moveTo(-9, -1 - flap); ctx.lineTo(0, -5); ctx.lineTo(9, -1 - flap); ctx.lineTo(0, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b9aeff';
  ctx.beginPath(); ctx.ellipse(0, 0, 3, 4.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8e7bff';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(Math.sin(frame * 0.2) * 2, -10); ctx.stroke();
  eyes(ctx, 1.8, 2.5, 1);
}

/** 거북: 맞을수록 껍질 색이 바뀐다 (체력 3 → 2 → 1) */
function drawTurtle(ctx, e, frame) {
  const shell = ['#d9732b', '#c9b23a', '#3fa65a'][Math.max(0, e.hp - 1)] ?? '#3fa65a';
  ctx.fillStyle = '#9bd17a';
  const paddle = Math.sin(frame * 0.15 + e.id) * 1.5;
  ctx.beginPath(); ctx.ellipse(-6.5, -1 + paddle, 2.2, 1.4, 0.5, 0, TAU); ctx.ellipse(6.5, -1 - paddle, 2.2, 1.4, -0.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 6, 2.6, 0, TAU); ctx.fill();            // 머리
  ctx.fillStyle = shell;
  ctx.beginPath(); ctx.ellipse(0, 0, 7, 5.6, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
  ctx.fillStyle = '#102030';
  ctx.beginPath(); ctx.arc(-1.1, 6.6, 0.6, 0, TAU); ctx.arc(1.1, 6.6, 0.6, 0, TAU); ctx.fill();
}

/** 폭탄 복어: 가시 돋친 어두운 몸, 가운데에서 붉은 불이 깜빡인다 */
function drawMine(ctx, e, frame) {
  ctx.strokeStyle = '#7d8797';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
    ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a5363';
  ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, TAU); ctx.fill();
  const blink = 0.5 + 0.5 * Math.sin(frame * 0.3 + e.id);
  ctx.fillStyle = `rgba(255,70,70,${0.4 + 0.6 * blink})`;
  ctx.beginPath(); ctx.arc(0, 0, 2.2 + blink * 0.8, 0, TAU); ctx.fill();
}

function drawFish(ctx, e, frame) {
  const hue = 190 + e.wave * 35;
  ctx.fillStyle = `hsl(${hue} 80% 60%)`;
  const wag = Math.sin(frame * 0.3 + e.id) * 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 5.5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-3 + wag, -9); ctx.lineTo(3 + wag, -9); ctx.closePath(); ctx.fill();   // 꼬리
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-1.2, 2.5, 1, 0, TAU); ctx.arc(1.2, 2.5, 1, 0, TAU); ctx.fill();
}

/** 아이템을 품은 적: 아이템 색으로 맥동하는 후광과 반짝이는 별 */
function drawSparkle(ctx, e, frame) {
  const c = ITEM_STYLE[e.carries][0];
  const p = 0.5 + 0.5 * Math.sin(frame * 0.18 + e.id);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalAlpha = 0.22 + 0.25 * p;
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(0, 0, 10 + p * 2, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const a = frame * 0.05 + i * TAU / 3;
    const x = Math.cos(a) * 12, y = Math.sin(a) * 12;
    const sz = 1.2 + (0.5 + 0.5 * Math.sin(frame * 0.3 + i * 2 + e.id)) * 1.8;
    ctx.beginPath();
    ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y);
    ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz);
    ctx.stroke();
  }
  ctx.restore();
}

/** 적 종류별 그리기 (원점은 적의 중심) */
const ENEMY_DRAW = {
  bee: (ctx, e, frame) => drawJelly(ctx, frame),
  butterfly: (ctx, e, frame) => drawPuffer(ctx, frame),
  boss: (ctx, e, frame) => drawOctopus(ctx, frame, e.hp < 2),
  fish: drawFish,
  eel: drawEel,
  ray: drawRay,
  turtle: drawTurtle,
  mine: drawMine,
  ship: (ctx, e, frame) => { ctx.rotate(Math.PI); drawSub(ctx, 0, 0, COLOR.captive, COLOR.captiveDark, frame); },
};

function drawEnemy(ctx, e, frame) {
  if (e.carries) drawSparkle(ctx, e, frame);
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.state === 'enter' || e.state === 'dive' || e.state === 'beamMove' || e.state === 'toSlot') ctx.rotate(e.a - Math.PI / 2);
  ENEMY_DRAW[e.kind]?.(ctx, e, frame);
  ctx.restore();
  if (e.speedMul > 1) {                               // 돌진 중인 적은 뒤로 물살 꼬리를 끈다
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(e.x + dx, e.y - 8); ctx.lineTo(e.x + dx, e.y - 18); ctx.stroke(); }
  }
  if (e.carrying) drawSub(ctx, e.x, e.y - 12, COLOR.captive, COLOR.captiveDark, frame);   // 납치한 잠수함을 머리에 이고 있다
}

/** 문어의 소용돌이: 아래로 벌어지는 원뿔과 아래로 흘러내리는 고리 */
function drawBeam(ctx, e, frame) {
  const y0 = e.y + 8, len = e.beamLen;
  if (len <= 0) return;
  const half = (d) => BEAM_HALF0 + d * BEAM_SLOPE;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
  g.addColorStop(0, 'rgba(170,255,255,.5)');
  g.addColorStop(1, 'rgba(170,255,255,.12)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(e.x - half(0), y0); ctx.lineTo(e.x - half(len), y0 + len);
  ctx.lineTo(e.x + half(len), y0 + len); ctx.lineTo(e.x + half(0), y0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,255,255,.7)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) {
    const f = (frame * 0.03 + k / 6) % 1, d = f * len;
    ctx.beginPath();
    ctx.ellipse(e.x, y0 + d, half(d), 2.5, 0, 0, TAU);
    ctx.stroke();
  }
}

function drawKraken(ctx, k, frame) {
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.scale(4.2, 4.2);
  drawOctopus(ctx, frame, false, BOSS_COLOR.kraken[k.phase - 1]);
  if (k.phase === 3) {                                // 격노: 눈이 붉게
    ctx.fillStyle = 'rgba(255,40,40,.55)';
    ctx.beginPath(); ctx.arc(-2.8, -1.2, 1.1, 0, TAU); ctx.arc(2.8, -1.2, 1.1, 0, TAU); ctx.fill();
  }
  if (k.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.ellipse(0, -1.5, 7, 6.4, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** 심해 아귀: 입을 벌려 돌진하고, 머리의 빛 미끼가 환하다 */
function drawAngler(ctx, b, frame) {
  const col = BOSS_COLOR.angler[b.phase - 1];
  ctx.save();
  ctx.translate(b.x, b.y);
  const open = b.lunge ? 1 : 0.35;
  ctx.fillStyle = col;                                              // 몸
  ctx.beginPath(); ctx.ellipse(0, -2, 32, 23, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 4, 26, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col;                                              // 지느러미
  ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(-44, -16 + Math.sin(frame * 0.2) * 3); ctx.lineTo(-30, 8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(30, -6); ctx.lineTo(44, -16 + Math.sin(frame * 0.2 + 1) * 3); ctx.lineTo(30, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0a1420';                                        // 입
  ctx.beginPath(); ctx.ellipse(0, 12, 22, 4 + open * 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';                                           // 이빨
  const mouth = 3 + open * 7;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 4.6 - 2, 12 - mouth); ctx.lineTo(i * 4.6, 12 - mouth + 5); ctx.lineTo(i * 4.6 + 2, 12 - mouth); ctx.fill();
    ctx.beginPath(); ctx.moveTo(i * 4.6 - 2, 12 + mouth); ctx.lineTo(i * 4.6, 12 + mouth - 5); ctx.lineTo(i * 4.6 + 2, 12 + mouth); ctx.fill();
  }
  ctx.fillStyle = '#ffe14a';                                        // 눈
  ctx.beginPath(); ctx.arc(-13, -9, 5.5, 0, TAU); ctx.arc(13, -9, 5.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#102030';
  ctx.fillRect(-13.6, -13, 1.6, 8); ctx.fillRect(12.4, -13, 1.6, 8);
  if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(0, -2, 32, 23, 0, 0, TAU); ctx.fill(); }
  const lx = b.lureX - b.x, ly = b.lureY - b.y;                      // 빛 미끼
  ctx.strokeStyle = '#7fe0ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(lx * 0.4, -26, lx, ly - 2); ctx.stroke();
  const glow = 0.6 + 0.4 * Math.sin(frame * 0.2);
  ctx.fillStyle = `rgba(127,224,255,${0.25 * glow})`;
  ctx.beginPath(); ctx.arc(lx, ly, 13, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9fbff';
  ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, TAU); ctx.fill();
  ctx.restore();
}

/** 거대 가오리: 넓은 날개를 펄럭인다 */
function drawManta(ctx, b, frame) {
  const col = BOSS_COLOR.manta[b.phase - 1];
  const flap = Math.sin(frame * 0.1) * 7;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.strokeStyle = col;                                            // 꼬리
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(Math.sin(frame * 0.1) * 8, -24, Math.sin(frame * 0.1 + 1) * 6, -38); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-44, -4 - flap); ctx.quadraticCurveTo(-24, -22, 0, -10); ctx.quadraticCurveTo(24, -22, 44, -4 - flap);
  ctx.quadraticCurveTo(26, 14, 0, 24); ctx.quadraticCurveTo(-26, 14, -44, -4 - flap);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)';                           // 배
  ctx.beginPath(); ctx.ellipse(0, 4, 13, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe14a';
  ctx.beginPath(); ctx.arc(-9, 10, 3.2, 0, TAU); ctx.arc(9, 10, 3.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#102030';
  ctx.beginPath(); ctx.arc(-9, 10.6, 1.4, 0, TAU); ctx.arc(9, 10.6, 1.4, 0, TAU); ctx.fill();
  if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(0, 4, 40, 18, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

const BOSS_DRAW = { kraken: drawKraken, angler: drawAngler, manta: drawManta };

function drawBoss(ctx, b, frame) {
  ctx.save();
  if (b.state === 'dying' && (frame >> 1) % 2) ctx.globalAlpha = 0.5;      // 쓰러질 때 깜빡인다
  BOSS_DRAW[b.kind](ctx, b, frame);
  ctx.restore();
}

let darkCanvas = null;
/** 심해 아귀의 암전: 화면이 어두워지고 빛 미끼 주변과 잠수함 곁만 보인다. 탄은 그 위에 그려 계속 보인다 */
function drawDarkness(ctx, game) {
  const b = game.boss, a = b.darkness;
  if (a <= 0) return;
  if (!darkCanvas) { darkCanvas = document.createElement('canvas'); darkCanvas.width = W * S; darkCanvas.height = H * S; }
  const d = darkCanvas.getContext('2d');
  d.setTransform(1, 0, 0, 1, 0, 0);
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, darkCanvas.width, darkCanvas.height);
  d.fillStyle = `rgba(0,4,12,${0.9 * a})`;
  d.fillRect(0, 0, darkCanvas.width, darkCanvas.height);
  d.globalCompositeOperation = 'destination-out';
  const spot = (x, y, r) => {
    const g = d.createRadialGradient(x * S, y * S, r * 0.15 * S, x * S, y * S, r * S);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g;
    d.fillRect((x - r) * S, (y - r) * S, 2 * r * S, 2 * r * S);
  };
  spot(b.lureX, b.lureY, 52);
  spot(game.player.x + (game.player.twin ? TWIN_GAP / 2 : 0), PLAYER_Y, 28);
  ctx.drawImage(darkCanvas, 0, 0, W, H);
}

function drawBossBar(ctx, k) {
  const x = 52, w = 166, y = 30;
  text(ctx, t(k.nameKey), 6, y + 6, 8, COLOR.accent);
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = BOSS_COLOR[k.kind][k.phase - 1];
  ctx.fillRect(x + 1, y + 1, (w - 2) * (k.hp / k.maxHp), 4);
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 5);
}

/** 필살기 해일: 바닥에서 위로 올라오는 파도 */
function drawWave(ctx, w, frame) {
  const y = w.y;
  ctx.save();
  ctx.beginPath();
  ctx.rect(w.x - WAVE_HALF_W, 0, WAVE_HALF_W * 2, H + 12);   // 쓴 자리의 좁은 기둥만 훑는다
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, 'rgba(120,220,255,.38)');
  g.addColorStop(1, 'rgba(40,140,220,.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, H - y + 12);
  ctx.fillStyle = 'rgba(225,250,255,.9)';
  ctx.beginPath();
  ctx.moveTo(-4, y + 10);
  for (let x = -4; x <= W + 4; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.09 + frame * 0.5) * 4);
  ctx.lineTo(W + 4, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 14; i++) {                      // 물보라
    const x = (i * 37 + frame * 3) % W;
    ctx.beginPath(); ctx.arc(x, y - 3 - ((i * 7 + frame) % 9), 1 + (i % 2), 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(190,240,255,.45)';                 // 기둥의 양옆 가장자리
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w.x - WAVE_HALF_W, y); ctx.lineTo(w.x - WAVE_HALF_W, H);
  ctx.moveTo(w.x + WAVE_HALF_W, y); ctx.lineTo(w.x + WAVE_HALF_W, H);
  ctx.stroke();
}

const ITEM_STYLE = {
  rapid: ['#ffd23f', 'R'], shield: ['#5fe3ff', 'S'], charge: ['#7aa8ff', 'W'],
  spread: ['#ff9f43', 'V'], laser: ['#ff6fb5', 'L'], homing: ['#6fe38f', 'H'],
  blast: ['#ff7a3d', 'B'], sonic: ['#8fe8ff', 'N'],
  boost: ['#c9a6ff', 'P'], velo: ['#ffe98a', 'T'], reload: ['#ffa6c9', 'F'],
};

function drawItem(ctx, it, frame) {
  const [c, glyph] = ITEM_STYLE[it.type];
  ctx.save();
  ctx.translate(it.x + Math.sin(frame * 0.15 + it.x) * 1.2, it.y);
  ctx.globalAlpha = 0.25 + 0.1 * Math.sin(frame * 0.2);
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(2,16,30,.85)';
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, TAU); ctx.fill(); ctx.stroke();
  text(ctx, glyph, 0, 2.6, 7, c, 'center');
  ctx.restore();
}

function drawFx(ctx, f) {
  if (f.t < 0) return;
  const k = f.t / f.max, player = f.kind === 'player';
  ctx.save();
  ctx.globalAlpha = 1 - k;
  if (k < 0.3) {                                      // 터지는 순간의 섬광
    ctx.fillStyle = player ? '#fff3c0' : '#ffffff';
    ctx.beginPath(); ctx.arc(f.x, f.y, (player ? 10 : 6) * (1 - k / 0.3) + 2, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = player ? '#ffd23f' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * (player ? 26 : 13), 0, TAU); ctx.stroke();
  ctx.fillStyle = player ? '#ff9f43' : '#9ff';
  const n = player ? 16 : 10;
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + (i % 2 ? 0.3 : 0);
    const r = k * (8 + (i % 3) * 6) * (player ? 1.6 : 1);
    ctx.beginPath();
    ctx.arc(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 1.6 * (1 - k) + 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const { player, frame } = game;
  const cx = player.x + (player.twin ? TWIN_GAP / 2 : 0), r = player.twin ? 17 : 11;
  const protectedByWave = !!game.wave;
  if (player.invuln > 0 && !protectedByWave && !player.shield && (frame >> 2) % 2) return;   // 맞은 직후에는 깜빡인다
  if (player.rapid > 0 && (player.rapid > 120 || (frame >> 2) % 2)) {                        // 연사 강화: 노란 기운 (끝나 가면 깜빡)
    ctx.fillStyle = 'rgba(255,210,63,.2)';
    ctx.beginPath(); ctx.arc(cx, PLAYER_Y, r + 2, 0, TAU); ctx.fill();
  }
  drawSub(ctx, player.x, PLAYER_Y, COLOR.sub, COLOR.subDark, frame);
  if (player.twin) drawSub(ctx, player.x + TWIN_GAP, PLAYER_Y, COLOR.sub, COLOR.subDark, frame);
  [player.boost, player.velo, player.reload].forEach((lv, row) => {                          // 영구 강화 단계: 잠수함 아래 점
    for (let i = 0; i < lv; i++) {
      ctx.fillStyle = ITEM_STYLE[['boost', 'velo', 'reload'][row]][0];
      ctx.fillRect(player.x - 5 + i * 4, PLAYER_Y + 9 + row * 2.5, 3, 1.6);
    }
  });
  if (player.shield || protectedByWave) {                                                    // 방어막(해일 중에도 보호됨)
    ctx.strokeStyle = protectedByWave ? 'rgba(200,245,255,.8)' : `rgba(95,227,255,${0.8 + 0.2 * Math.sin(frame * 0.2)})`;
    ctx.fillStyle = 'rgba(95,227,255,.22)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, PLAYER_Y, r + 3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';                                                // 방울의 반짝이는 하이라이트
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, PLAYER_Y, r, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  }
}

function drawShots(ctx, game) {
  const rapid = game.player.rapid > 0;
  for (const s of game.player.shots) {
    if (s.kind === 'laser') {                          // 레이저: 길게 뻗은 분홍 광선에 흰 심지
      ctx.fillStyle = 'rgba(255,111,181,.35)';
      ctx.fillRect(s.x - 3, s.y - 12, 6, 24);
      ctx.fillStyle = '#ff6fb5';
      ctx.fillRect(s.x - 1.4, s.y - 12, 2.8, 24);
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x - 0.6, s.y - 12, 1.2, 24);
    } else if (s.kind === 'spread') {                  // 확산: 가는 방향으로 기운 주황 탄
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
      ctx.fillStyle = '#ffb561';
      ctx.beginPath(); ctx.roundRect(-1.3, -4, 2.6, 8, 1.3); ctx.fill();
      ctx.restore();
    } else if (s.kind === 'homing') {                  // 유도: 초록 구슬과 꼬리
      ctx.fillStyle = 'rgba(111,227,143,.35)';
      ctx.beginPath(); ctx.arc(s.x - s.vx * 2, s.y - s.vy * 2, 2.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x - s.vx, s.y - s.vy, 2.8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6fe38f';
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#eafff0';
      ctx.beginPath(); ctx.arc(s.x - 0.6, s.y - 0.6, 1, 0, TAU); ctx.fill();
    } else if (s.kind === 'blast') {                   // 폭발 어뢰: 붉은 주황 탄두
      ctx.fillStyle = 'rgba(255,120,60,.35)';
      ctx.beginPath(); ctx.arc(s.x, s.y + 3, 4.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7a3d';
      ctx.beginPath(); ctx.roundRect(s.x - 2, s.y - 5, 4, 10, 2); ctx.fill();
      ctx.fillStyle = '#fff2c0';
      ctx.beginPath(); ctx.arc(s.x, s.y - 3, 1.2, 0, TAU); ctx.fill();
    } else if (s.kind === 'sonic') {                   // 음파 링: 위로 휜 파란 호, 날아갈수록 넓어지고 흐려진다
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.life / 12);
      ctx.strokeStyle = '#8fe8ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.w, s.w * 0.45, 0, Math.PI, TAU); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 3, s.w * 0.7, s.w * 0.3, 0, Math.PI, TAU); ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = rapid ? '#fff1a8' : '#fff';
      ctx.beginPath(); ctx.roundRect(s.x - 1.2, s.y - 4, 2.4, 8, 1.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.arc(s.x, s.y + 7, 1.2, 0, TAU); ctx.fill();
    }
  }
  for (const b of game.bullets) {
    ctx.fillStyle = COLOR.ink;
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd0d0';
    ctx.beginPath(); ctx.arc(b.x - 0.7, b.y - 0.7, 0.8, 0, TAU); ctx.fill();
  }
}

function drawGauge(ctx, game) {
  const gx = 96, gy = H - 12, gw = 56, full = game.gauge >= ULT_MAX;
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(gx, gy, gw, 6);
  ctx.fillStyle = full && (game.frame >> 3) % 2 ? '#ffffff' : COLOR.tide;
  ctx.fillRect(gx + 1, gy + 1, (gw - 2) * Math.min(1, game.gauge / ULT_MAX), 4);
  ctx.strokeStyle = '#9fd8ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, 5);
  if (full) shadowText(ctx, t('hud.ult'), gx + gw / 2, gy - 3, 8, '#9ff');
}

function drawHud(ctx, game) {
  text(ctx, t('hud.score'), 8, 12, 9, COLOR.accent);
  text(ctx, String(game.score), 8, 24, 10, COLOR.text);
  text(ctx, t('hud.hi'), W / 2, 12, 9, COLOR.accent, 'center');
  text(ctx, String(game.hiScore), W / 2, 24, 10, COLOR.text, 'center');
  if (game.boss && game.boss.state !== 'dead') drawBossBar(ctx, game.boss);
  if (game.phase === 'over') return;
  for (let i = 0; i < Math.min(game.lives - 1, 5); i++) drawSub(ctx, 14 + i * 16, H - 10, COLOR.sub, COLOR.subDark, 0);
  text(ctx, t('hud.stage', { n: game.stage }), W - 8, H - 6, 9, COLOR.accent, 'right');
  if (!game.bonus) drawGauge(ctx, game);
  drawWeapon(ctx, game.player, game.frame);
  if (game.player.shield) {                                                   // 방어막이 남아 있다는 표시 (한 번 맞으면 사라진다)
    const c = ITEM_STYLE.shield[0];
    ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(11, H - 40, 4, 0, TAU); ctx.stroke();
    text(ctx, t('hud.shield'), 19, H - 37, 8, c);
  }
}

/** 새 무기를 쓰는 동안: 이름과 남은 시간 막대 (끝나 가면 깜빡) */
function drawWeapon(ctx, player, frame) {
  if (player.weaponT <= 0 || player.weapon === 'torpedo') return;
  if (player.weaponT < 180 && (frame >> 3) % 2) return;
  const c = ITEM_STYLE[player.weapon][0];
  text(ctx, t(`weapon.${player.weapon}`), 8, H - 28, 8, c);
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(8, H - 25, 44, 4);
  ctx.fillStyle = c;
  ctx.fillRect(9, H - 24, 42 * player.weaponT / WEAPON_TICKS, 2);
}

/** 지금 모드의 내 기록 상위 5개 (순위 · 이름 · 점수 · 스테이지 · 클리어 ★). 이번 판 순위(rank)는 강조한다 */
function drawRecords(ctx, game, y0) {
  shadowText(ctx, `${t('records')} · ${t(`diff.${game.difficulty}`)}`, W / 2, y0, 9, COLOR.accent);
  const mine = game.rankMode === game.difficulty ? game.rank : null;
  game.records.slice(0, 5).forEach((r, i) => {
    const y = y0 + 14 + i * 12, color = mine === i + 1 ? COLOR.accent : COLOR.text;
    shadowText(ctx, String(i + 1), 18, y, 9, color, 'left');
    shadowText(ctx, r.name, 32, y, 9, color, 'left');
    shadowText(ctx, String(r.score), 160, y, 9, color, 'right');
    shadowText(ctx, `S${r.stage}`, 168, y, 9, '#9fd8ff', 'left');
    if (r.cleared) shadowText(ctx, '★', 204, y, 9, COLOR.accent, 'left');
  });
}

/** 엔딩: 이야기가 한 줄씩 떠오르고, 남은 잠수함 보너스를 보여 준 뒤 키를 기다린다 */
function drawEnding(ctx, game) {
  const cx = W / 2, T = game.timer;
  ctx.fillStyle = 'rgba(2,16,30,.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = Math.min(1, T / 40);
  shadowText(ctx, t('msg.allclear'), cx, 58, 16, COLOR.accent);
  const lines = t('ending.story');
  lines.forEach((s, i) => {
    const a = Math.min(1, (T - 50 - i * 100) / 40);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    shadowText(ctx, s, cx, 98 + i * 18, 8, COLOR.text);
  });
  const bonusAt = 50 + lines.length * 100;
  if (T > bonusAt) {
    ctx.globalAlpha = Math.min(1, (T - bonusAt) / 40);
    shadowText(ctx, t('ending.bonus', { n: game.ending?.bonus ?? 0 }), cx, 196, 10, '#9ff');
  }
  ctx.globalAlpha = 1;
  drawSub(ctx, cx, 224 + Math.sin(T * 0.05) * 3, COLOR.sub, COLOR.subDark, T);
  if (T >= ENDING_SKIP && (game.frame >> 5) % 2 === 0) shadowText(ctx, t('ending.continue'), cx, 254, 8, COLOR.text);
}

function drawOverlay(ctx, game) {
  const { phase } = game;
  const cx = W / 2;
  if (phase === 'title') {
    ctx.fillStyle = 'rgba(2,16,30,.55)';
    ctx.fillRect(0, 0, W, H);
    shadowText(ctx, t('title'), cx, 80, 22, COLOR.accent);
    shadowText(ctx, t('title.sub'), cx, 102, 8, COLOR.text);
    ctx.save(); ctx.translate(cx, 138); ctx.scale(2.2, 2.2); drawSub(ctx, 0, Math.sin(game.frame * 0.05) * 2, COLOR.sub, COLOR.subDark, game.frame); ctx.restore();
    const star = game.clears.has(game.difficulty) ? ' ★' : '';
    shadowText(ctx, `◀ ${t('diff.label')}: ${t(`diff.${game.difficulty}`)}${star} ▶`, cx, 184, 10, '#9ff');
    if (game.hiScore > 0) shadowText(ctx, t('title.best', { n: game.hiScore }), cx, 198, 8, '#9fd8ff');
    if ((game.frame >> 5) % 2 === 0) shadowText(ctx, t('title.start'), cx, 212, 10, COLOR.text);
    if (game.endlessUnlocked) shadowText(ctx, t('title.unlocked'), cx, 226, 8, COLOR.accent);
    else shadowText(ctx, t('title.unlock'), cx, 226, 7, '#9fd8ff');
    shadowText(ctx, t('title.controls'), cx, 238, 8, '#9fd8ff');
    shadowText(ctx, t('title.touch'), cx, 252, 8, '#9fd8ff');
    shadowText(ctx, t(`hint.captive.${game.cfg.captive}`), cx, 268, 7, COLOR.accent);
  } else if (phase === 'ready') {
    if (game.readyKind === 'ready') shadowText(ctx, t('msg.ready'), cx, 150, 16, COLOR.accent);
    else if (game.boss) {
      if ((game.frame >> 3) % 2 === 0) shadowText(ctx, t('msg.warning'), cx, 128, 18, '#ff5a5a');
      shadowText(ctx, t('msg.boss'), cx, 152, 14, COLOR.accent);
      shadowText(ctx, t(game.boss.nameKey), cx, 172, 11, COLOR.text);
    } else {
      shadowText(ctx, game.bonus ? t('msg.bonus') : t('msg.stage', { n: game.stage }), cx, 150, 16, COLOR.accent);
      if (game.stage === 1) shadowText(ctx, t(`hint.captive.${game.cfg.captive}`), cx, 172, 7, COLOR.text);   // 첫 스테이지에서 난이도별 납치 규칙을 알려 준다
    }
  } else if (phase === 'clear') {
    shadowText(ctx, game.boss ? t('msg.bossdown', { name: t(game.boss.nameKey) }) : t('msg.clear'), cx, 150, 16, COLOR.accent);
  } else if (phase === 'captured') {
    shadowText(ctx, t('msg.captured'), cx, 150, 16, '#ff7a7a');
  } else if (phase === 'bonusResult' && game.result) {
    const r = game.result;
    shadowText(ctx, t('msg.bonus'), cx, 120, 14, COLOR.accent);
    shadowText(ctx, t('bonus.hits', { n: r.hits, m: r.total }), cx, 150, 12, COLOR.text);
    if (r.perfect) shadowText(ctx, t('bonus.perfect', { n: r.bonus }), cx, 176, 12, '#9ff');
  } else if (phase === 'over') {
    ctx.fillStyle = 'rgba(2,16,30,.72)';
    ctx.fillRect(0, 0, W, H);
    const { shots, hits } = game.stats;
    if (game.cleared) shadowText(ctx, t('msg.allclear'), cx, 62, 16, COLOR.accent);
    else shadowText(ctx, t('msg.over'), cx, 62, 20, '#ff7a7a');
    shadowText(ctx, `${t('hud.score')} ${game.score}`, cx, 86, 12, COLOR.text);
    shadowText(ctx, t('over.ratio', { n: game.hitRatio }), cx, 102, 9, COLOR.accent);
    shadowText(ctx, `${t('over.shots', { n: shots })} · ${t('over.hits', { n: hits })}`, cx, 116, 8, '#9fd8ff');
    if (game.naming) shadowText(ctx, t('name.prompt'), cx, 136, 8, '#9ff');
    else if (game.rank && game.rankMode === game.difficulty && (game.frame >> 4) % 2 === 0) {
      shadowText(ctx, game.rank === 1 ? t('over.record.best') : t('over.record.rank', { n: game.rank }), cx, 136, 11, '#9ff');
    }
    drawRecords(ctx, game, 156);
    if (!game.naming) {                       // 이름을 쓰는 동안에는 아래쪽을 입력 칸이 쓴다
      shadowText(ctx, `◀ ${t(`diff.${game.difficulty}`)}${game.clears.has(game.difficulty) ? ' ★' : ''} ▶`, cx, 236, 9, '#9fd8ff');
      if ((game.frame >> 5) % 2 === 0) shadowText(ctx, t('msg.over.again'), cx, 252, 9, COLOR.text);
    }
  } else if (phase === 'ending') {
    drawEnding(ctx, game);
  }
  if (game.paused) {
    ctx.fillStyle = 'rgba(2,16,30,.65)';
    ctx.fillRect(0, 0, W, H);
    shadowText(ctx, t('msg.paused'), cx, 140, 20, COLOR.accent);
    shadowText(ctx, t('msg.resume'), cx, 164, 8, COLOR.text);
  }
}

export function draw(ctx, game) {
  const { frame, phase } = game;
  let sx = 0, sy = 0;                                  // 화면 흔들림
  if (game.shakeT > 0) {
    const m = game.shakeMag * game.shakeT / game.shakeMax;
    sx = Math.sin(frame * 2.7) * m;
    sy = Math.cos(frame * 3.3) * m;
  }
  ctx.setTransform(S, 0, 0, S, sx * S, sy * S);
  drawBackground(ctx, game);
  for (const e of game.enemies) {
    if (e.state === 'wait' || e.state === 'gone') continue;
    if (e.beamLen > 0) drawBeam(ctx, e, frame);
  }
  for (const e of game.enemies) {
    if (e.state === 'wait' || e.state === 'gone') continue;
    drawEnemy(ctx, e, frame);
  }
  if (game.boss && game.boss.state !== 'dead' && phase !== 'title') drawBoss(ctx, game.boss, frame);
  if (phase !== 'title') {
    for (const it of game.items) drawItem(ctx, it, frame);
    if (game.boss && game.boss.kind === 'angler') drawDarkness(ctx, game);
    if (phase !== 'dying' && phase !== 'captured' && phase !== 'over' && phase !== 'ending') drawPlayer(ctx, game);
    if (game.capture) {
      const c = game.capture;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); drawSub(ctx, 0, 0, COLOR.captive, COLOR.captiveDark, frame); ctx.restore();
    }
    if (game.rescue) {
      const r = game.rescue;
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a); drawSub(ctx, 0, 0, COLOR.sub, COLOR.subDark, frame); ctx.restore();
    }
    drawShots(ctx, game);
    if (game.wave) drawWave(ctx, game.wave, frame);
    for (const f of game.fx) drawFx(ctx, f);
    for (const p of game.popups) {
      ctx.globalAlpha = Math.min(1, p.timer / 20);
      shadowText(ctx, p.key ? t(p.key) : p.text, p.x, p.y - (60 - p.timer) * 0.2, 8, COLOR.text);
      ctx.globalAlpha = 1;
    }
    drawHud(ctx, game);
  }
  drawOverlay(ctx, game);
}
