import { Game, TICRATE } from './game/game.js';
import { draw, canvasSize } from './render/render.js';
import { setLang, getLang } from './app/i18n.js';
import { isTouchDevice, setupTouch } from './ui/touch.js';

const MOVE_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const FIRE_KEYS = new Set(['Space', 'KeyZ', 'ArrowUp', 'KeyW']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const HI_KEY = 'deepstrike.hi';
const LANG_KEY = 'deepstrike.lang';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장이 막힌 환경 */ } },
};

const game = new Game();
game.hiScore = Number(store.get(HI_KEY)) || 0;
setLang(store.get(LANG_KEY) || (navigator.language?.startsWith('ko') ? 'ko' : 'en'));

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const size = canvasSize();
canvas.width = size.width;
canvas.height = size.height;

const langBtn = document.getElementById('lang');
const showLang = () => { langBtn.textContent = getLang() === 'ko' ? 'EN' : '한'; };
showLang();
langBtn.addEventListener('click', () => {
  setLang(getLang() === 'ko' ? 'en' : 'ko');
  store.set(LANG_KEY, getLang());
  showLang();
  langBtn.blur();
});

if (isTouchDevice()) setupTouch(game, canvas);

const moveHeld = new Set(), fireHeld = new Set();
const syncKeys = () => {
  let m = 0;
  for (const c of moveHeld) m += MOVE_KEYS[c];
  game.setMove(Math.sign(m));
  game.setFire(fireHeld.size > 0);
};

addEventListener('keydown', (e) => {
  if (e.code === 'F5' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code in MOVE_KEYS) { e.preventDefault(); moveHeld.add(e.code); syncKeys(); }
  if (FIRE_KEYS.has(e.code)) { e.preventDefault(); fireHeld.add(e.code); syncKeys(); }
  if (e.repeat) return;
  if (PAUSE_KEYS.has(e.code)) { e.preventDefault(); game.togglePause(); }   // 타이틀·게임 오버에서는 아무 일 없이 start 로 넘어간다
  game.start();
});
addEventListener('keyup', (e) => {
  moveHeld.delete(e.code);
  fireHeld.delete(e.code);
  syncKeys();
});
addEventListener('blur', () => { moveHeld.clear(); fireHeld.clear(); syncKeys(); });

const pauseBtn = document.getElementById('pause');
pauseBtn.addEventListener('click', () => { game.togglePause(); pauseBtn.blur(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });   // 다른 탭으로 가면 자동으로 멈춘다

let last = performance.now(), acc = 0, savedHi = game.hiScore;
function frame(now) {
  acc += Math.min(now - last, 250);       // 탭이 멈췄다 돌아와도 한꺼번에 몰아 돌리지 않게
  last = now;
  const step = 1000 / TICRATE;
  while (acc >= step) { game.tick(); acc -= step; }
  if (game.hiScore !== savedHi && game.phase !== 'play') { savedHi = game.hiScore; store.set(HI_KEY, String(savedHi)); }
  draw(ctx, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = game;     // 개발 중 콘솔에서 상태 확인용
