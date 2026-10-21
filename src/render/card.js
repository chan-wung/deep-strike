import { t } from '../app/i18n.js';
import { drawSub, FONT } from './render.js';

const CW = 600, CH = 315;

/** 공유용 기록 카드 (600×315). rec: { score, stage, ratio, bosses, date } */
export function makeCard(rec) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#0e6e96');
  g.addColorStop(1, '#021a2e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = 'rgba(190,240,255,.07)';                // 햇빛 줄기
  for (const x of [120, 300, 470]) {
    ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 120, CH); ctx.lineTo(x - 60, CH); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.25)';              // 거품
  for (let i = 0; i < 18; i++) {
    ctx.beginPath(); ctx.arc((i * 97) % CW, (i * 61) % CH, 3 + (i % 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,210,63,.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, CW - 20, CH - 20);

  const label = (s, x, y, size, color, align = 'left') => {
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillText(s, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  };

  label(t('title'), 36, 66, 36, '#ffd23f');
  const who = rec.name && rec.name !== '---' ? `${rec.name}  ·  ` : '';
  label(`${who}${t('hud.score')}`, 36, 120, 16, '#9fd8ff');
  label(String(rec.score), 36, 182, 60, '#ffffff');
  label(`${t('hud.stage', { n: rec.stage })}  ·  ${t('card.ratio')} ${rec.ratio}%`, 36, 226, 20, '#ffffff');
  if (rec.cleared) label(`★ ${t('card.allclear')}`, 36, 258, 18, '#ffd23f');
  else if (rec.bosses > 0) label(t('card.bosses', { n: rec.bosses }), 36, 258, 18, '#ff9fb0');
  if (rec.date) label(rec.date, 36, 292, 14, '#9fd8ff');

  ctx.save();
  ctx.translate(478, 168);
  ctx.scale(8, 8);
  drawSub(ctx, 0, 0);
  ctx.restore();
  return c;
}

export const cardBlob = (rec) => new Promise((resolve) => makeCard(rec).toBlob(resolve, 'image/png'));
