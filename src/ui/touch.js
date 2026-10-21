import { W, H } from '../game/paths.js';
import { shipArrowAt, shipCardAt, selectGoAt, pickBtnAt, secretTitleAt } from '../render/render.js';
import { SHIP_ORDER, HIDDEN_SHIP, RANDOM } from '../game/ships.js';

/**
 * 모바일 터치 조작: 화면을 누르고 있는 동안 자동으로 발사하고, 누른 채 좌우로 끌면 잠수함이 따라온다.
 * 터치 기기이거나 주소에 ?touch=1 이 있을 때만 켠다.
 */
export const isTouchDevice = () =>
  new URLSearchParams(location.search).has('touch')
  || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  || 'ontouchstart' in window;

/** 손가락이 시작점에서 dx(화면 픽셀) 움직였을 때 잠수함이 갈 논리 x. rectW 는 화면에 보이는 캔버스 너비 */
export const dragTarget = (startX, dx, rectW) => startX + (dx / rectW) * W;

/** 화면 좌표(clientX, clientY)를 논리 좌표로. object-fit: contain 이라 캔버스 안에서 실제 그려진 영역 기준이다 */
export function logicalPoint(rect, clientX, clientY) {
  const k = Math.min(rect.width / W, rect.height / H);
  const left = rect.left + (rect.width - W * k) / 2, top = rect.top + (rect.height - H * k) / 2;
  return { x: (clientX - left) / k, y: (clientY - top) / k };
}

/** 포인터 캡처(손가락이 요소 밖으로 나가도 계속 추적). 일부 환경에서 실패해도 조작은 계속되게 */
const capture = (el, id) => { try { el.setPointerCapture(id); } catch { /* 무시 */ } };

export function setupTouch(game, canvas, root = document.body) {
  document.body.classList.add('touch');

  let origin = null;
  const ult = document.getElementById('ult');             // 필살기 버튼은 터치 기기에서만 보인다
  if (ult) {
    ult.hidden = false;
    ult.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); game.ult(); });
  }

  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#lang, #pause, #mute, #music, #ult, #share, #save, #name, #rotate')) return;
    if (game.paused) { game.resume(); return; }          // 멈춘 화면은 아무 곳이나 터치하면 계속
    if (game.phase === 'select' || (game.phase === 'over' && !game.naming)) {   // 기체 고르기·결과 화면: 카드나 ◀ ▶ 를 누르면 기체를 고른다
      const p = logicalPoint(canvas.getBoundingClientRect(), e.clientX, e.clientY);
      if (game.phase === 'select') {
        const card = shipCardAt(game.phase, p.x, p.y);
        if (card >= 0) { game.pickShip(SHIP_ORDER[card]); return; }          // 카드는 고르기만 한다 (출발은 아래 버튼)
        const btn = pickBtnAt(game.phase, p.x, p.y, game.goldUnlocked);
        if (btn) { game.pickShip(btn === 'gold' ? HIDDEN_SHIP : RANDOM); return; }   // 카드 아래 줄: 히든 기체 · 랜덤
        if (secretTitleAt(game.phase, p.y)) { game.secretTap(); return; }              // 제목을 여러 번 누르면 히든 기체가 열린다
        if (!selectGoAt(game.phase, p.y)) return;                              // 카드·버튼이 아닌 곳은 무시
      } else {
        const dir = shipArrowAt(game.phase, p.x, p.y);
        if (dir) { game.selectShip(dir); return; }
      }
    }
    game.start();
    origin = { x: e.clientX, px: game.player.x, id: e.pointerId };
    game.setFire(true);
    capture(root, e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (!origin || e.pointerId !== origin.id) return;
    const r = canvas.getBoundingClientRect();                   // object-fit: contain 이라 실제로 보이는 너비는 더 좁을 수 있다
    game.moveTo(dragTarget(origin.px, e.clientX - origin.x, Math.min(r.width, r.height * W / H)));
  });
  const end = (e) => {
    if (!origin || e.pointerId !== origin.id) return;
    origin = null;
    game.setFire(false);
    game.moveTo(null);
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
}
