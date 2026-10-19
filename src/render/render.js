import { W, H } from '../game/paths.js';
import { PLAYER_Y, TWIN_GAP } from '../game/player.js';
import { BEAM_HALF0, BEAM_SLOPE } from '../game/enemy.js';
import { ULT_MAX } from '../game/game.js';
import { t } from '../app/i18n.js';

/** 논리 좌표(224×288)를 canvas 에 그릴 때 곱하는 배율 */
const S = 2;
const TAU = Math.PI * 2;

const COLOR = {
  sub: '#ffd23f',
  subDark: '#c98f00',
  glass: '#bfefff',
  captive: '#ff5a5a',
  jelly: '#ff7aa8',
  puffer: '#ffb347',
  boss: '#9b5cff',
  bossHit: '#35d0ba',
  ink: '#ff6b6b',
  text: '#ffffff',
  accent: '#ffd23f',
  tide: '#35d0ff',
};
const KRAKEN_COLOR = ['#7a3dd8', '#d6489b', '#e5484d'];

export function canvasSize() {
  return { width: W * S, height: H * S };
}

const FONT = '"Neo둥근모", "Press Start 2P", "Malgun Gothic", monospace';
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

function drawFish(ctx, e, frame) {
  const hue = 190 + e.wave * 35;
  ctx.fillStyle = `hsl(${hue} 80% 60%)`;
  const wag = Math.sin(frame * 0.3 + e.id) * 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 5.5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-3 + wag, -9); ctx.lineTo(3 + wag, -9); ctx.closePath(); ctx.fill();   // 꼬리
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-1.2, 2.5, 1, 0, TAU); ctx.arc(1.2, 2.5, 1, 0, TAU); ctx.fill();
}

function drawEnemy(ctx, e, frame) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.state === 'enter' || e.state === 'dive' || e.state === 'beamMove' || e.state === 'toSlot') ctx.rotate(e.a - Math.PI / 2);
  if (e.kind === 'bee') drawJelly(ctx, frame);
  else if (e.kind === 'butterfly') drawPuffer(ctx, frame);
  else if (e.kind === 'boss') drawOctopus(ctx, frame, e.hp < 2);
  else if (e.kind === 'fish') drawFish(ctx, e, frame);
  else if (e.kind === 'ship') { ctx.rotate(Math.PI); drawSub(ctx, 0, 0, COLOR.captive, '#992222', frame); }
  ctx.restore();
  if (e.speedMul > 1) {                               // 돌진 중인 적은 뒤로 물살 꼬리를 끈다
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(e.x + dx, e.y - 8); ctx.lineTo(e.x + dx, e.y - 18); ctx.stroke(); }
  }
  if (e.carrying) drawSub(ctx, e.x, e.y - 12, COLOR.captive, '#992222', frame);   // 납치한 잠수함을 머리에 이고 있다
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
  if (k.state === 'dying' && (frame >> 1) % 2) ctx.globalAlpha = 0.5;
  ctx.translate(k.x, k.y);
  ctx.scale(4.2, 4.2);
  drawOctopus(ctx, frame, false, KRAKEN_COLOR[k.phase - 1]);
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

function drawKrakenBar(ctx, k) {
  const x = 52, w = 166, y = 30;
  text(ctx, t('msg.boss.name'), 6, y + 6, 8, COLOR.accent);
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = KRAKEN_COLOR[k.phase - 1];
  ctx.fillRect(x + 1, y + 1, (w - 2) * (k.hp / k.maxHp), 4);
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 5);
}

/** 필살기 해일: 바닥에서 위로 올라오는 파도 */
function drawWave(ctx, w, frame) {
  const y = w.y;
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
}

const ITEM_STYLE = { rapid: ['#ffd23f', 'R'], shield: ['#5fe3ff', 'S'], charge: ['#7aa8ff', 'W'] };

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
  if (player.shield || protectedByWave) {                                                    // 방어막(해일 중에도 보호됨)
    ctx.strokeStyle = protectedByWave ? 'rgba(200,245,255,.8)' : `rgba(95,227,255,${0.55 + 0.25 * Math.sin(frame * 0.2)})`;
    ctx.fillStyle = 'rgba(95,227,255,.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, PLAYER_Y, r + 1, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

function drawShots(ctx, game) {
  const rapid = game.player.rapid > 0;
  for (const s of game.player.shots) {
    ctx.fillStyle = rapid ? '#fff1a8' : '#fff';
    ctx.beginPath(); ctx.roundRect(s.x - 1.2, s.y - 4, 2.4, 8, 1.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath(); ctx.arc(s.x, s.y + 7, 1.2, 0, TAU); ctx.fill();
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
  if (game.boss && game.boss.state !== 'dead') drawKrakenBar(ctx, game.boss);
  if (game.phase === 'over') return;
  for (let i = 0; i < Math.min(game.lives - 1, 5); i++) drawSub(ctx, 14 + i * 16, H - 10, COLOR.sub, COLOR.subDark, 0);
  text(ctx, t('hud.stage', { n: game.stage }), W - 8, H - 6, 9, COLOR.accent, 'right');
  if (!game.bonus) drawGauge(ctx, game);
}

/** 내 기록 상위 5개. 이번 판 순위(rank)는 강조한다 */
function drawRecords(ctx, game, y0) {
  shadowText(ctx, t('records'), W / 2, y0, 9, COLOR.accent);
  const rows = game.records.slice(0, 5);
  rows.forEach((r, i) => {
    const y = y0 + 14 + i * 12, color = game.rank === i + 1 ? COLOR.accent : COLOR.text;
    shadowText(ctx, String(i + 1), 40, y, 9, color, 'left');
    shadowText(ctx, String(r.score), 58, y, 9, color, 'left');
    shadowText(ctx, `S${r.stage}`, 128, y, 9, color, 'left');
    shadowText(ctx, `${r.ratio}%`, 164, y, 9, color, 'left');
    shadowText(ctx, (r.diff || 'normal')[0].toUpperCase(), 196, y, 9, '#9fd8ff', 'left');
  });
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
    shadowText(ctx, `◀ ${t('diff.label')}: ${t(`diff.${game.difficulty}`)} ▶`, cx, 184, 10, '#9ff');
    if ((game.frame >> 5) % 2 === 0) shadowText(ctx, t('title.start'), cx, 212, 10, COLOR.text);
    shadowText(ctx, t('title.controls'), cx, 238, 8, '#9fd8ff');
    shadowText(ctx, t('title.touch'), cx, 252, 8, '#9fd8ff');
  } else if (phase === 'ready') {
    if (game.readyKind === 'ready') shadowText(ctx, t('msg.ready'), cx, 150, 16, COLOR.accent);
    else if (game.boss) {
      if ((game.frame >> 3) % 2 === 0) shadowText(ctx, t('msg.warning'), cx, 128, 18, '#ff5a5a');
      shadowText(ctx, t('msg.boss'), cx, 152, 14, COLOR.accent);
      shadowText(ctx, t('msg.boss.name'), cx, 172, 11, COLOR.text);
    } else shadowText(ctx, game.bonus ? t('msg.bonus') : t('msg.stage', { n: game.stage }), cx, 150, 16, COLOR.accent);
  } else if (phase === 'clear') {
    shadowText(ctx, game.boss ? t('msg.bossdown') : t('msg.clear'), cx, 150, 16, COLOR.accent);
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
    shadowText(ctx, t('msg.over'), cx, 62, 20, '#ff7a7a');
    shadowText(ctx, `${t('hud.score')} ${game.score}`, cx, 86, 12, COLOR.text);
    shadowText(ctx, t('over.ratio', { n: shots ? Math.round(hits / shots * 100) : 0 }), cx, 102, 9, COLOR.accent);
    shadowText(ctx, `${t('over.shots', { n: shots })} · ${t('over.hits', { n: hits })}`, cx, 116, 8, '#9fd8ff');
    if (game.rank && (game.frame >> 4) % 2 === 0) {
      shadowText(ctx, game.rank === 1 ? t('over.record.best') : t('over.record.rank', { n: game.rank }), cx, 136, 11, '#9ff');
    }
    drawRecords(ctx, game, 156);
    shadowText(ctx, `◀ ${t(`diff.${game.difficulty}`)} ▶`, cx, 236, 9, '#9fd8ff');
    if ((game.frame >> 5) % 2 === 0) shadowText(ctx, t('msg.over.again'), cx, 252, 9, COLOR.text);
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
  if (game.boss && game.boss.state !== 'dead' && phase !== 'title') drawKraken(ctx, game.boss, frame);
  if (phase !== 'title') {
    for (const it of game.items) drawItem(ctx, it, frame);
    if (phase !== 'dying' && phase !== 'captured' && phase !== 'over') drawPlayer(ctx, game);
    if (game.capture) {
      const c = game.capture;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); drawSub(ctx, 0, 0, COLOR.captive, '#992222', frame); ctx.restore();
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
