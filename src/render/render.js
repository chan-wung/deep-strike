import { W, H } from '../game/paths.js';
import { PLAYER_Y, TWIN_GAP } from '../game/player.js';
import { BEAM_HALF0, BEAM_SLOPE } from '../game/enemy.js';
import { t } from '../app/i18n.js';

/** 논리 좌표(224×288)를 canvas 에 그릴 때 곱하는 배율 */
const S = 2;
const TAU = Math.PI * 2;

const COLOR = {
  deep: '#02101e',
  mid: '#0a3a5c',
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
};

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

function drawBackground(ctx, frame) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLOR.mid);
  g.addColorStop(1, COLOR.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 3; i++) {                       // 위에서 비치는 햇빛 줄기
    const x = 40 + i * 70 + Math.sin(frame * 0.01 + i * 2) * 14;
    ctx.fillStyle = 'rgba(190,240,255,.05)';
    ctx.beginPath();
    ctx.moveTo(x - 6, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 50, H); ctx.lineTo(x - 30, H);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,255,255,.22)';          // 올라가는 거품: 프레임만으로 위치가 정해진다
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 30; i++) {
    const sp = 0.2 + ((i * 37) % 10) * 0.05;
    const x = (i * 53) % W + Math.sin(frame * 0.02 + i) * 5;
    const y = H - ((frame * sp + i * 41) % (H + 12));
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, TAU);
    ctx.stroke();
  }
}

function drawSub(ctx, x, y, body = COLOR.sub, dark = COLOR.subDark, frame = 0) {
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

function drawOctopus(ctx, frame, hit) {
  const c = hit ? COLOR.bossHit : COLOR.boss;
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

function drawFx(ctx, f) {
  const k = f.t / f.max;
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = f.kind === 'player' ? '#ffd23f' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * (f.kind === 'player' ? 22 : 12), 0, TAU); ctx.stroke();
  ctx.fillStyle = f.kind === 'player' ? '#ff9f43' : '#9ff';
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + k;
    ctx.beginPath();
    ctx.arc(f.x + Math.cos(a) * k * 14, f.y + Math.sin(a) * k * 14, 1.6 * (1 - k) + 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const { player, frame } = game;
  if (player.invuln > 0 && (frame >> 2) % 2) return;     // 쌍둥이 한 대를 잃은 직후에는 깜빡인다
  drawSub(ctx, player.x, PLAYER_Y, COLOR.sub, COLOR.subDark, frame);
  if (player.twin) drawSub(ctx, player.x + TWIN_GAP, PLAYER_Y, COLOR.sub, COLOR.subDark, frame);
}

function drawShots(ctx, game) {
  ctx.fillStyle = '#fff';
  for (const s of game.player.shots) {
    ctx.beginPath(); ctx.roundRect(s.x - 1.2, s.y - 4, 2.4, 8, 1.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath(); ctx.arc(s.x, s.y + 7, 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
  }
  for (const b of game.bullets) {
    ctx.fillStyle = COLOR.ink;
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd0d0';
    ctx.beginPath(); ctx.arc(b.x - 0.7, b.y - 0.7, 0.8, 0, TAU); ctx.fill();
  }
}

function drawHud(ctx, game) {
  text(ctx, t('hud.score'), 8, 12, 9, COLOR.accent);
  text(ctx, String(game.score), 8, 24, 10, COLOR.text);
  text(ctx, t('hud.hi'), W / 2, 12, 9, COLOR.accent, 'center');
  text(ctx, String(game.hiScore), W / 2, 24, 10, COLOR.text, 'center');
  for (let i = 0; i < game.lives - 1; i++) drawSub(ctx, 14 + i * 20, H - 10, COLOR.sub, COLOR.subDark, 0);
  text(ctx, t('hud.stage', { n: game.stage }), W - 8, H - 6, 9, COLOR.accent, 'right');
}

function drawOverlay(ctx, game) {
  const { phase } = game;
  const cx = W / 2;
  if (phase === 'title') {
    ctx.fillStyle = 'rgba(2,16,30,.55)';
    ctx.fillRect(0, 0, W, H);
    shadowText(ctx, t('title'), cx, 96, 22, COLOR.accent);
    shadowText(ctx, t('title.sub'), cx, 120, 8, COLOR.text);
    ctx.save(); ctx.translate(cx, 160); ctx.scale(2.2, 2.2); drawSub(ctx, 0, Math.sin(game.frame * 0.05) * 2, COLOR.sub, COLOR.subDark, game.frame); ctx.restore();
    if ((game.frame >> 5) % 2 === 0) shadowText(ctx, t('title.start'), cx, 214, 10, COLOR.text);
    shadowText(ctx, t('title.controls'), cx, 236, 8, '#9fd8ff');
    shadowText(ctx, t('title.touch'), cx, 250, 8, '#9fd8ff');
  } else if (phase === 'ready') {
    const label = game.readyKind === 'ready' ? t('msg.ready') : game.bonus ? t('msg.bonus') : t('msg.stage', { n: game.stage });
    shadowText(ctx, label, cx, 150, 16, COLOR.accent);
  } else if (phase === 'clear') {
    shadowText(ctx, t('msg.clear'), cx, 150, 16, COLOR.accent);
  } else if (phase === 'captured') {
    shadowText(ctx, t('msg.captured'), cx, 150, 16, '#ff7a7a');
  } else if (phase === 'bonusResult' && game.result) {
    const r = game.result;
    shadowText(ctx, t('msg.bonus'), cx, 120, 14, COLOR.accent);
    shadowText(ctx, t('bonus.hits', { n: r.hits, m: r.total }), cx, 150, 12, COLOR.text);
    if (r.perfect) shadowText(ctx, t('bonus.perfect', { n: r.bonus }), cx, 176, 12, '#9ff');
  } else if (phase === 'over') {
    ctx.fillStyle = 'rgba(2,16,30,.6)';
    ctx.fillRect(0, 0, W, H);
    const { shots, hits } = game.stats;
    shadowText(ctx, t('msg.over'), cx, 110, 20, '#ff7a7a');
    shadowText(ctx, t('over.shots', { n: shots }), cx, 146, 10, COLOR.text);
    shadowText(ctx, t('over.hits', { n: hits }), cx, 162, 10, COLOR.text);
    shadowText(ctx, t('over.ratio', { n: shots ? Math.round(hits / shots * 100) : 0 }), cx, 178, 10, COLOR.accent);
    if ((game.frame >> 5) % 2 === 0) shadowText(ctx, t('msg.over.again'), cx, 214, 10, COLOR.text);
  }
  if (game.paused) {
    ctx.fillStyle = 'rgba(2,16,30,.65)';
    ctx.fillRect(0, 0, W, H);
    shadowText(ctx, t('msg.paused'), cx, 140, 20, COLOR.accent);
    shadowText(ctx, t('msg.resume'), cx, 164, 8, COLOR.text);
  }
}

export function draw(ctx, game) {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  const { frame, phase } = game;
  drawBackground(ctx, frame);
  for (const e of game.enemies) {
    if (e.state === 'wait' || e.state === 'gone') continue;
    if (e.beamLen > 0) drawBeam(ctx, e, frame);
  }
  for (const e of game.enemies) {
    if (e.state === 'wait' || e.state === 'gone') continue;
    drawEnemy(ctx, e, frame);
  }
  if (phase !== 'title') {
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
